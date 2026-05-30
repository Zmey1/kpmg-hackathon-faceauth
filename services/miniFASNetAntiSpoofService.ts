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

    // Crop face with 15% padding, resize to 80×80
    const padX = Math.round(cropBox.width  * 0.15);
    const padY = Math.round(cropBox.height * 0.15);
    const originX = Math.max(0, Math.round(cropBox.left - padX));
    const originY = Math.max(0, Math.round(cropBox.top  - padY));
    const cropW   = Math.min(imageSize.width  - originX, Math.round(cropBox.width  + padX * 2));
    const cropH   = Math.min(imageSize.height - originY, Math.round(cropBox.height + padY * 2));

    const processed = await ImageManipulator.manipulateAsync(
      uri,
      [
        { crop: { originX, originY, width: cropW, height: cropH } },
        { resize: { width: MINIFASNET_INPUT_SIZE, height: MINIFASNET_INPUT_SIZE } },
      ],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
    );

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

    // RGBA → BGR float32 normalized to [0, 1]
    // Model was trained on OpenCV BGR images; swap R and B channels to match.
    const pixels = MINIFASNET_INPUT_SIZE * MINIFASNET_INPUT_SIZE;
    const input = new Float32Array(pixels * 3);
    for (let i = 0; i < pixels; i++) {
      input[i * 3 + 0] = rgba[i * 4 + 2] / 255.0; // B
      input[i * 3 + 1] = rgba[i * 4 + 1] / 255.0; // G
      input[i * 3 + 2] = rgba[i * 4 + 0] / 255.0; // R
    }

    const outputData = await _model.run([input]);
    const logits = outputData[0] as Float32Array;

    if (!logits || logits.length < MINIFASNET_REAL_IDX + 1) {
      console.warn(`[MiniFASNet] Unexpected output length: ${logits?.length}`);
      return { passed: true, realScore: -1 };
    }

    // Model outputs raw logits (softmax not baked in). Apply softmax to get probabilities.
    const maxLogit = Math.max(...Array.from(logits));
    const exps = Array.from(logits).map(x => Math.exp(x - maxLogit));
    const expSum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(x => x / expSum);

    // index 1 = real face probability
    const realScore = probs[MINIFASNET_REAL_IDX];
    const passed = realScore >= MINIFASNET_THRESHOLD;

    console.log(
      `[MiniFASNet] probs=[${probs.map(p => p.toFixed(3)).join(', ')}] ` +
      `realScore=${realScore.toFixed(3)} threshold=${MINIFASNET_THRESHOLD} → ${passed ? 'PASS' : 'FAIL'}`
    );

    return { passed, realScore };
  } catch (err) {
    // Fail-open: don't block a real user due to an inference error
    console.warn('[MiniFASNet] inference error — defaulting to pass:', err);
    return { passed: true, realScore: -1 };
  }
}
