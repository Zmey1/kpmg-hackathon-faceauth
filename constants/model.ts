export const MOBILEFACENET_MODEL_NAME = "MobileFaceNet";
export const MOBILEFACENET_MODEL_VERSION = "mobilefacenet-tflite-v1";
export const MOBILEFACENET_MODEL_PATH = "mobilefacenet.tflite";
export const MOBILEFACENET_INPUT_SIZE = 112;

// TODO: verify actual output dim of the selected .tflite model.
// Some MobileFaceNet exports use 128, 192, or 512.
export const MOBILEFACENET_EMBEDDING_SIZE = 192;

// Calibrated for real mobile camera captures: same-person ~0.65-0.85, different-person ~0.35-0.58.
// 0.55 was too permissive — raised to 0.65 to reduce false accepts.
export const MOBILEFACENET_COSINE_THRESHOLD = 0.65;

// LBP texture anti-spoofing — Shannon entropy of 256-bin LBP histogram on 64×64 face crop.
// Real faces (mid-range camera): ~4.8–6.5. Printed / screen photos: ~3.0–4.5.
// Raise toward 4.8 for stricter security; lower toward 3.8 if real users get false-rejected.
export const LBP_ENTROPY_THRESHOLD = 4.2;
export const LBP_ANALYSIS_SIZE = 64;

export const REGISTRATION_MIN_SAMPLES = 3;
export const REGISTRATION_MAX_SAMPLES = 5;

export const REGISTRATION_STEPS = [
  "Look straight at the camera",
  "Turn slightly left",
  "Turn slightly right",
  "Smile naturally",
  "Look straight again",
];

// ── MiniFASNet V2 anti-spoofing ───────────────────────────────────────────────
// Input:  [1, 80, 80, 3] NHWC float32 in [0, 1] range
// Output: [1, 3] softmax — index 1 = real face probability
export const MINIFASNET_MODEL_PATH   = 'minifasnet.tflite'; // for reference — Metro require() needs a string literal
export const MINIFASNET_INPUT_SIZE   = 80;
export const MINIFASNET_REAL_IDX     = 1;
// Lower = more permissive (fewer false-rejects). Raise toward 0.8 for stricter security.
export const MINIFASNET_THRESHOLD    = 0.75;
