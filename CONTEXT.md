/cle# Project Context

App: React Native (Expo 52) offline face auth. KPMG Hackathon 7.0. Deadline: 05.06.2026.
Goal: field workers tap button → face scanned → PASS/FAIL. No internet needed. Results sync to AWS later.
Must integrate into existing "Datalake 3.0" RN app. Model < 20MB, speed < 1 sec, accuracy > 95%.

## Pipeline (one button tap)
Photo → ML Kit face detect (fast mode) → quality check (eyes open) → EdgeFace 112×112 → 512-dim embedding → dot product vs stored templates (threshold 0.99) → PASS/FAIL → enqueue to sync queue

## Face Recognition Model
- Model: `assets/models/edgeface_s_gamma_05.tflite` — EdgeFace-S γ=0.5, 512-dim output
- Input: fixed (NCHW mismatch from litert-torch conversion was resolved)
- Service: `services/mobileFaceNetService.ts` — delegate: `default` (CPU, android-gpu rejected the model)
- Threshold: 0.99 — **needs calibration**: run a different-person test, check `[Verify] score=` log, set threshold between that score and 1.0

## Services
- `faceQualityService` — ML Kit detect, returns bbox + eye probs; logs every pass/fail
- `mobileFaceNetService` — EdgeFace TFLite load + 512-dim embedding; `dotProduct()` for normalized vecs
- `faceTemplateStore` — JSON files per user, in-memory cache
- `verificationService` — matches embedding vs templates (unused in VerificationScreen — inline match)
- `syncService` — queue items, upload to AWS on reconnect
- `attendanceService` — fetch GET /attendance from server
- `backgroundSyncTask` — WorkManager background sync

## Liveness / Anti-Spoofing
All liveness checks removed (passive, LBP texture, MiniFASNet, active head-turn). Pipeline is quality → embed → match only.

## Types (generic)
- `VerificationPhase = string` — add any phase name without type edits
- `livenessPass` removed from navigation, ResultModal, syncService, attendanceService

## Sync API / Infra / Navigation / Screens
(unchanged — see git history)

## TODO (priority order)
1. ~~**Calibrate threshold**~~ — DONE: set to 0.65 (same-person ~0.75–0.85, different-person ~0.0–0.1)
2. **Fix sync abort error** — mock server at `172.19.40.195:3001` not running; every enqueue triggers a 12s timeout with no backoff. Add 60s backoff after failure + distinguish AbortError (timeout) from real errors in `syncService.ts`.
3. Deploy AWS infra: run terraform, update apiEndpoint in constants/aws.ts
4. Integration into existing Datalake 3.0 app
5. Final presentation / demo prep

## Evaluation (100 marks)
Innovation 30 · Feasibility 30 · Scalability/Sync 20 · Presentation/Docs 20
