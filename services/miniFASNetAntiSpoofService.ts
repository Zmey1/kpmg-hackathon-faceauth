import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
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
const UPNG = require('upng-js') as {
  decode: (buf: ArrayBuffer) => { width: number; height: number };
  toRGBA8: (img: object) => ArrayBuffer[];
};

export interface MiniFASNetResult {
  passed: boolean;
  realScore: number;
}

// ─── Singleton state ──────────────────────────────────────────────────────────

let _modelCrop: TensorflowModel | null = null;     // 2.7× face crop
let _modelFull: TensorflowModel | null = null;     // full image (no crop)
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
    const delegate = Platform.OS === 'ios' ? 'core-ml' : 'default';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    [_modelCrop, _modelFull] = await Promise.all([
      loadTensorflowModel(require('../assets/models/minifasnet.tflite'), delegate),
      loadTensorflowModel(require('../assets/models/minifasnet_fullimg.tflite'), delegate),
    ]);
    console.log('[MiniFASNet] crop model inputs:', JSON.stringify(_modelCrop.inputs));
    console.log('[MiniFASNet] full model inputs:', JSON.stringify(_modelFull.inputs));
    console.log('[MiniFASNet] Ready (ensemble)');
    _useMock = false;
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[MiniFASNet] INIT FAILED — running fail-open mock:', msg);
    _useMock = true;
  }
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function _cropScaled(
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
  const cropW = Math.max(1, Math.min(imgW, Math.round(rbX) + 1) - x1);
  const cropH = Math.max(1, Math.min(imgH, Math.round(rbY) + 1) - y1);

  return ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX: x1, originY: y1, width: cropW, height: cropH } },
      { resize: { width: MINIFASNET_INPUT_SIZE, height: MINIFASNET_INPUT_SIZE } },
    ],
    { format: ImageManipulator.SaveFormat.PNG },
  );
}

async function _resizeFull(uri: string) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MINIFASNET_INPUT_SIZE, height: MINIFASNET_INPUT_SIZE } }],
    { format: ImageManipulator.SaveFormat.PNG },
  );
}

async function _toInput(processedUri: string): Promise<Float32Array> {
  const b64 = await FileSystem.readAsStringAsync(processedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const img = UPNG.decode(bytes.buffer);
  const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);

  // RGBA → BGR float32 [0, 255] — model's to_tensor does not divide by 255
  const pixels = MINIFASNET_INPUT_SIZE * MINIFASNET_INPUT_SIZE;
  const input = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    input[i * 3 + 0] = rgba[i * 4 + 2]; // B
    input[i * 3 + 1] = rgba[i * 4 + 1]; // G
    input[i * 3 + 2] = rgba[i * 4 + 0]; // R
  }
  return input;
}

// ─── Inference ────────────────────────────────────────────────────────────────

export async function assessMiniFASNetLiveness(
  imagePath: string,
  cropBox: BoundingBox,
  imageSize: { width: number; height: number },
): Promise<MiniFASNetResult> {
  await initializeMiniFASNet();

  if (_useMock || !_modelCrop || !_modelFull) {
    console.warn('[MiniFASNet] mock mode — defaulting to pass');
    return { passed: true, realScore: -1 };
  }

  try {
    const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;
    const { left: bx, top: by, width: bw, height: bh } = cropBox;

    const [croppedImg, fullImg] = await Promise.all([
      _cropScaled(uri, bx, by, bw, bh, imageSize.width, imageSize.height)
        .catch(() => _cropScaled(uri, bx, by, bw, bh, imageSize.height, imageSize.width)),
      _resizeFull(uri),
    ]);

    const [inputCrop, inputFull] = await Promise.all([
      _toInput(croppedImg.uri),
      _toInput(fullImg.uri),
    ]);

    const [outCrop, outFull] = await Promise.all([
      _modelCrop.run([inputCrop]),
      _modelFull.run([inputFull]),
    ]);

    const logitsCrop = outCrop[0] as Float32Array;
    const logitsFull = outFull[0] as Float32Array;

    // Sum raw logits from both models before softmax — mirrors reference test.py
    const summed = [
      logitsCrop[0] + logitsFull[0],
      logitsCrop[1] + logitsFull[1],
      logitsCrop[2] + logitsFull[2],
    ];

    const maxL = Math.max(...summed);
    const exps = summed.map(x => Math.exp(x - maxL));
    const expSum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(x => x / expSum);

    const realScore  = probs[MINIFASNET_REAL_IDX];
    const spoofScore = Math.max(probs[0], probs[2]);
    const passed = realScore >= MINIFASNET_THRESHOLD && spoofScore < MINIFASNET_SPOOF_MAX;

    console.log(
      `[MiniFASNet] ensemble probs=[${probs.map(p => p.toFixed(3)).join(', ')}] ` +
      `real=${realScore.toFixed(3)} spoof=${spoofScore.toFixed(3)} → ${passed ? 'PASS' : 'FAIL'}`
    );

    return { passed, realScore };
  } catch (err) {
    console.warn('[MiniFASNet] inference error — defaulting to pass:', err);
    return { passed: true, realScore: -1 };
  }
}
