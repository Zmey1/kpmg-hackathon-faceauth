# Project Context

## What This Is
React Native (Expo 52) offline face auth app. KPMG Hackathon 7.0. Deadline: 05.06.2026.
Field workers authenticate via face on Android/iOS. Zero internet required during auth.

## Stack
- `react-native-fast-tflite` — runs MobileFaceNet TFLite model on-device
- `@react-native-ml-kit/face-detection` — face detection + classification (eyes, smile, head pose)
- `react-native-vision-camera` — camera capture
- `expo-file-system` — local storage for templates + sync queue

## Pipeline (verification)
1. Capture photo → ML Kit quality check (1 face, eyes open, bounding box)
2. Reuse same face data → passive liveness check (eye open + smile prob + head pose)
3. Crop + resize 112×112 → MobileFaceNet embedding (192-dim, L2 normalized)
4. Cosine similarity vs stored templates → threshold 0.65 → PASS/FAIL
5. Enqueue result to sync queue

## Key Services
- `services/livenessService.ts` — `assessLiveness(face)` passive check, NO challenges
- `services/faceQualityService.ts` — ML Kit wrapper, returns full face data including smileProb/headAngles
- `services/mobileFaceNetService.ts` — TFLite inference, embedding generation
- `services/verificationService.ts` — cosine match against stored templates
- `services/syncService.ts` — offline queue → AWS upload on reconnect → purge local templates
- `services/faceTemplateStore.ts` — JSON file storage per user

## Sync Flow
Queue at `faceauth/sync_queue.json`. NetInfo listener auto-triggers `processQueue()` on reconnect. AWS endpoint in `constants/aws.ts` (placeholder URL, replace before demo).

## Active Bugs (fix these next)
1. **Liveness rejects real faces** — `smilingProbability: 0.005` fails because `SMILE_MIN = 0.01`. Real neutral faces return low but non-zero values. Fix: lower threshold to `0.001` or drop smile check entirely.
2. **Camera black after phone lock** — Vision Camera `isActive` needs `AppState === 'active'` guard. Fix: add `AppState.addEventListener` and include in `isActive` prop.

## Navigation
Home → Verification → Result | Home → RegistrationForm → FaceRegistrationCamera → Home
