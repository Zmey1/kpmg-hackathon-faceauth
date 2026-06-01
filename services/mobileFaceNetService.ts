/**
 * MobileFaceNet embedding service.
 *
 * Runtime: react-native-fast-tflite v2 (JSI bindings, no nitro-modules,
 * compatible with Kotlin 1.9.25 / Expo 52).
 * Model: mobilefacenet.tflite — original float32 weights (accuracy preserved).
 * Delegate: Core ML (iOS) / android-gpu (Android) for hardware acceleration.
 *
 * Preprocessing pipeline:
 *   1. expo-image-manipulator — crop face + resize to 112×112 in one call (native speed)
 *   2. expo-file-system       — read tiny 112×112 JPEG as base64
 *   3. jpeg-js                — decode JPEG → RGBA uint8
 *   4. (bilinear resize skipped — already 112×112)
 *   5. float32 normalize      — RGBA → RGB float32, [-1, 1]
 *   6. TFLite run             — embedding float32 array
 *   7. l2Normalize            — unit-length vector
 *
 * Fallback: if model load fails, deterministic MOCK embeddings are used so
 * the UI flow stays testable. MOCK embeddings are NOT real recognition.
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform, Image as RNImage } from 'react-native';
import { Asset } from 'expo-asset';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TensorflowModel } from 'react-native-fast-tflite';
import { MOBILEFACENET_EMBEDDING_SIZE } from '../constants/model';
import type { BoundingBox } from './faceQualityService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jpegjs = require('jpeg-js') as {
  decode: (
    data: ArrayBuffer,
    opts?: { useTArray?: boolean; maxMemoryUsageInMB?: number }
  ) => { width: number; height: number; data: Uint8Array };
};

export type FaceEmbedding = number[];

// ─── State ───────────────────────────────────────────────────────────────────

let _model: TensorflowModel | null = null;
let _inputH = 112;
let _inputW = 112;
let _embeddingSize = MOBILEFACENET_EMBEDDING_SIZE;
let _initPromise: Promise<void> | null = null;
let _useMock = false;

// ─── Initialization ──────────────────────────────────────────────────────────

export function initializeMobileFaceNet(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = _doInit();
  return _initPromise;
}

async function _doInit(): Promise<void> {
  console.log('[MobileFaceNet] init start');
  try {
    console.log('[MobileFaceNet] step 1 — resolving asset');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const asset = Asset.fromModule(require('../assets/models/mobilefacenet.tflite'));
    console.log('[MobileFaceNet] step 2 — asset.downloaded:', asset.downloaded, 'localUri:', asset.localUri);

    await asset.downloadAsync();
    console.log('[MobileFaceNet] step 3 — downloadAsync done. localUri:', asset.localUri);

    const modelUri = asset.localUri;
    if (!modelUri) throw new Error('expo-asset resolved null localUri after downloadAsync');

    console.log('[MobileFaceNet] step 4 — calling loadTensorflowModel, uri:', modelUri);
    // Use hardware delegate: Core ML on iOS, GPU on Android (falls back internally if unsupported)
    const delegate = Platform.OS === 'ios' ? 'core-ml' : 'android-gpu';
    _model = await loadTensorflowModel({ url: modelUri }, delegate);
    console.log('[MobileFaceNet] step 5 — model loaded');

    const inp = _model.inputs[0];
    const out = _model.outputs[0];
    console.log('[MobileFaceNet] inputs:', JSON.stringify(_model.inputs));
    console.log('[MobileFaceNet] outputs:', JSON.stringify(_model.outputs));

    if (inp.shape.length === 4) {
      _inputH = inp.shape[1];
      _inputW = inp.shape[2];
    }
    if (out.shape.length === 2) _embeddingSize = out.shape[1];
    else if (out.shape.length === 1) _embeddingSize = out.shape[0];

    console.log(`[MobileFaceNet] Ready — input ${_inputH}x${_inputW}, embedding dim ${_embeddingSize}`);
    _useMock = false;
  } catch (err: unknown) {
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[MobileFaceNet] INIT FAILED at one of the steps above ↑');
    console.error('[MobileFaceNet] error:', message);
    _useMock = true;
  }
}

// ─── Embedding generation ────────────────────────────────────────────────────

export async function generateEmbeddingFromImage(
  imagePath: string,
  cropBox?: BoundingBox,
  imageSize?: { width: number; height: number }
): Promise<FaceEmbedding> {
  await initializeMobileFaceNet();
  if (_useMock || !_model) return _mockEmbedding(imagePath);

  try {
    const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;

    let t = Date.now();
    const manipOps: ImageManipulator.Action[] = [];
    if (cropBox) {
      const { width: imgW, height: imgH } = imageSize ?? await _getImageSize(uri);
      const padX = Math.round(cropBox.width * 0.15);
      const padY = Math.round(cropBox.height * 0.15);
      const originX = Math.max(0, Math.round(cropBox.left - padX));
      const originY = Math.max(0, Math.round(cropBox.top - padY));
      const cropW = Math.min(imgW - originX, Math.round(cropBox.width + padX * 2));
      const cropH = Math.min(imgH - originY, Math.round(cropBox.height + padY * 2));
      manipOps.push({ crop: { originX, originY, width: cropW, height: cropH } });
    }
    manipOps.push({ resize: { width: _inputW, height: _inputH } });
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      manipOps,
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    console.log(`[Timing]   manipulateAsync (crop+resize): ${Date.now() - t}ms`);

    t = Date.now();
    const b64 = await FileSystem.readAsStringAsync(processed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log(`[Timing]   readAsStringAsync (base64): ${Date.now() - t}ms`);

    t = Date.now();
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const { data: rgba, width, height } = jpegjs.decode(bytes.buffer, {
      useTArray: true,
      maxMemoryUsageInMB: 64,
    });
    console.log(`[Timing]   atob+jpegDecode: ${Date.now() - t}ms`);

    const resized = (width === _inputW && height === _inputH)
      ? rgba
      : _bilinearResize(rgba, width, height, _inputW, _inputH);

    t = Date.now();
    const numPixels = _inputW * _inputH;
    const inputBuffer = new Float32Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
      inputBuffer[i * 3 + 0] = (resized[i * 4 + 0] - 128) / 128.0;
      inputBuffer[i * 3 + 1] = (resized[i * 4 + 1] - 128) / 128.0;
      inputBuffer[i * 3 + 2] = (resized[i * 4 + 2] - 128) / 128.0;
    }
    console.log(`[Timing]   pixelNormalize: ${Date.now() - t}ms`);

    t = Date.now();
    const [outputTensor] = await _model.run([inputBuffer]);
    console.log(`[Timing]   tfliteInference: ${Date.now() - t}ms`);

    const rawEmbedding = Array.from(outputTensor as Float32Array);
    if (rawEmbedding.length !== _embeddingSize) {
      console.warn(`[MobileFaceNet] Output length ${rawEmbedding.length} ≠ expected ${_embeddingSize}.`);
    }

    const embedding = l2Normalize(rawEmbedding);
    return embedding;
  } catch (err) {
    console.warn('[MobileFaceNet] Inference failed, falling back to mock:', err);
    return _mockEmbedding(imagePath);
  }
}

// ─── Image size helper ────────────────────────────────────────────────────────

function _getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), reject)
  );
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vector.slice();
  return vector.map(v => v / norm);
}

export function cosineSimilarity(a: FaceEmbedding, b: FaceEmbedding): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimension mismatch: ${a.length} vs ${b.length}. Same model version required.`
    );
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Use instead of cosineSimilarity when both vectors are already L2-normalized (norm=1).
// Equivalent result, skips two sqrt calls per comparison.
export function dotProduct(a: FaceEmbedding, b: FaceEmbedding): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ─── Bilinear resize (pure JS) ────────────────────────────────────────────────

function _bilinearResize(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const out = new Uint8Array(dstW * dstH * 4);
  const xScale = srcW / dstW;
  const yScale = srcH / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const sx = (dx + 0.5) * xScale - 0.5;
      const sy = (dy + 0.5) * yScale - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const y0 = Math.max(0, Math.floor(sy));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const di = (dy * dstW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        const tl = src[(y0 * srcW + x0) * 4 + c];
        const tr = src[(y0 * srcW + x1) * 4 + c];
        const bl = src[(y1 * srcW + x0) * 4 + c];
        const br = src[(y1 * srcW + x1) * 4 + c];
        out[di + c] = Math.round(
          tl * (1 - fx) * (1 - fy) + tr * fx * (1 - fy) +
          bl * (1 - fx) * fy       + br * fx * fy
        );
      }
    }
  }
  return out;
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

/** Deterministic pseudo-embedding for UI testing. *** NOT real recognition *** */
function _mockEmbedding(imagePath: string): FaceEmbedding {
  const seed = _hashString(imagePath);
  let state = seed;
  const raw: number[] = [];
  for (let i = 0; i < _embeddingSize; i++) {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    raw.push((state / 0x80000000) - 1);
  }
  return l2Normalize(raw);
}

function _hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return Math.abs(hash);
}

export function isMockMode(): boolean { return _useMock; }
export function getModelInfo() {
  return { inputH: _inputH, inputW: _inputW, embeddingSize: _embeddingSize };
}
