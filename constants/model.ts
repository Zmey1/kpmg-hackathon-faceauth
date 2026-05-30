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
