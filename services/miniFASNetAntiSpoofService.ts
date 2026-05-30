import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TensorflowModel } from 'react-native-fast-tflite';
import {
  MINIFASNET_INPUT_SIZE,
  MINIFASNET_REAL_IDX,
  MINIFASNET_THRESHOLD,
  MINIFASNET_SPOOF_MAX,
} from '../constants/model';
import type { BoundingBox } from './faceQualityService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jpegjs = require('jpeg-js') as {
  decode: (data: ArrayBuffer, opts?: { useTArray?: boolean; maxMemoryUsageInMB?: number }) =>
    { width: number; height: number; data: Uint8Array };
};

export interface MiniFASNetResult {
  passed: boolean;
  realScore: number;
}

// ─── Singleton state ──────────────────────────────────────────────────────────

let _model: TensorflowModel | null = null;
let _initPromise: Promise<void> | null = null;
let _useMock = false;

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initializeMiniFASNet(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = _doInit();
  return _initPromise;
}

async function _doInit(): Promise<void> {
  console.log('[MiniFASNet] init start');
  try {
    const asset = Asset.fromModule(require('../assets/models/minifasnet.tflite'));
    await asset.downloadAsync();
    const modelUri = asset.localUri;
    if (!modelUri) throw new Error('expo-asset resolved null localUri');

    // MiniFASNet ONNX→TFLite conversion uses ops incompatible with android-gpu delegate.
    const delegate = Platform.OS === 'ios' ? 'core-ml' : 'default';
    _model = await loadTensorflowModel({ url: modelUri }, delegate);

    console.log('[MiniFASNet] inputs:', JSON.stringify(_model.inputs));
    console.log('[MiniFASNet] outputs:', JSON.stringify(_model.outputs));
    console.log('[MiniFASNet] Ready');
    _useMock = false;
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[MiniFASNet] INIT FAILED — running fail-open mock:', msg);
    _useMock = true;
  }
}

// ─── Crop helper ─────────────────────────────────────────────────────────────

async function _cropForMiniFAS(
  uri: string,
  bx: number, by: number, bw: number, bh: number,
  imgW: number, imgH: number,
) {
  const CROP_SCALE = 2.7;
  const scale = Math.min((imgH - 1) / bh, Math.min((imgW - 1) / bw, CROP_SCALE));
  const newW = bw * scale;
  const newH = bh * scale;
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  let ltX = cx - newW / 2;
  let ltY = cy - newH / 2;
  let rbX = cx + newW / 2;
  let rbY = cy + newH / 2;

  if (ltX < 0)        { rbX -= ltX;            ltX = 0; }
  if (ltY < 0)        { rbY -= ltY;            ltY = 0; }
  if (rbX > imgW - 1) { ltX -= rbX - imgW + 1; rbX = imgW - 1; }
  if (rbY > imgH - 1) { ltY -= rbY - imgH + 1; rbY = imgH - 1; }

  const x1 = Math.max(0, Math.round(ltX));
  const y1 = Math.max(0, Math.round(ltY));
  const x2 = Math.min(imgW, Math.round(rbX) + 1);
  const y2 = Math.min(imgH, Math.round(rbY) + 1);
  const cropW = Math.max(1, x2 - x1);
  const cropH = Math.max(1, y2 - y1);

  return ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX: x1, originY: y1, width: cropW, height: cropH } },
      { resize: { width: MINIFASNET_INPUT_SIZE, height: MINIFASNET_INPUT_SIZE } },
    ],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
}

// ─── Inference ────────────────────────────────────────────────────────────────

export async function assessMiniFASNetLiveness(
  imagePath: string,
  cropBox: BoundingBox,
  imageSize: { width: number; height: number },
): Promise<MiniFASNetResult> {
  await initializeMiniFASNet();

  // Fail-open: if model failed to load, don't block real users
  if (_useMock || !_model) {
    console.warn('[MiniFASNet] mock mode — defaulting to pass');
    return { passed: true, realScore: -1 };
  }

  try {
    const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;

    // Port of MiniFASNet _get_new_box: scale=2.7 is encoded in the model filename.
    // The model needs 2.7× context around the face to detect lighting/depth/edge spoofing cues.
    const { left: bx, top: by, width: bw, height: bh } = cropBox;

    // photo.width/height are physical sensor dimensions but expo-image-manipulator applies
    // EXIF rotation automatically. Compute crop with reported dims first; if that overflows
    // (bounds error), retry with swapped dims to handle portrait/landscape mismatch.
    const processed = await _cropForMiniFAS(uri, bx, by, bw, bh, imageSize.width, imageSize.height)
      .catch(() => _cropForMiniFAS(uri, bx, by, bw, bh, imageSize.height, imageSize.width));

    const b64 = await FileSystem.readAsStringAsync(processed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const { data: rgba } = jpegjs.decode(bytes.buffer, {
      useTArray: true,
      maxMemoryUsageInMB: 16,
    });

    // RGBA → BGR raw float32 in [0, 255] — matches reference inference_tflite.py
    // (model trained on OpenCV BGR images; softmax not baked into TFLite graph)
    const pixels = MINIFASNET_INPUT_SIZE * MINIFASNET_INPUT_SIZE;
    const input = new Float32Array(pixels * 3);
    for (let i = 0; i < pixels; i++) {
      input[i * 3 + 0] = rgba[i * 4 + 2]; // B
      input[i * 3 + 1] = rgba[i * 4 + 1]; // G
      input[i * 3 + 2] = rgba[i * 4 + 0]; // R
    }

    const outputData = await _model.run([input]);
    const logits = outputData[0] as Float32Array;

    if (!logits || logits.length < MINIFASNET_REAL_IDX + 1) {
      console.warn(`[MiniFASNet] Unexpected output length: ${logits?.length}`);
      return { passed: true, realScore: -1 };
    }

    // Apply softmax to convert logits → probabilities; index 1 = real face
    const maxLogit = Math.max(...Array.from(logits));
    const exps = Array.from(logits).map(x => Math.exp(x - maxLogit));
    const expSum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(x => x / expSum);

    const realScore  = probs[MINIFASNET_REAL_IDX];
    const spoofScore = Math.max(probs[0], probs[2]); // max of print(0) and screen(2) classes
    const passed = realScore >= MINIFASNET_THRESHOLD && spoofScore < MINIFASNET_SPOOF_MAX;

    console.log(
      `[MiniFASNet] probs=[${probs.map(p => p.toFixed(3)).join(', ')}] ` +
      `real=${realScore.toFixed(3)} spoof=${spoofScore.toFixed(3)} → ${passed ? 'PASS' : 'FAIL'}`
    );

    return { passed, realScore };
  } catch (err) {
    // Fail-open: don't block a real user due to an inference error
    console.warn('[MiniFASNet] inference error — defaulting to pass:', err);
    return { passed: true, realScore: -1 };
  }
}
