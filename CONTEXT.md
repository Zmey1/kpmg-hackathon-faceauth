/cle# Project Context

App: React Native (Expo 52) offline face auth. KPMG Hackathon 7.0. Deadline: 05.06.2026.
Goal: field workers tap button → face scanned → PASS/FAIL. No internet needed. Results sync to AWS later.
Must integrate into existing "Datalake 3.0" RN app. Model < 20MB, speed < 1 sec, accuracy > 95%.

## Pipeline (one button tap)
Photo → ML Kit face detect (fast mode) → passive liveness (eyes+pose) → MobileNetV2 liveness (224×224, threshold 0.5) → MobileFaceNet 112×112 → 192-dim embedding → dot product vs stored templates (threshold 0.65) → PASS/FAIL → enqueue to sync queue

## Anti-Spoofing Status
- LBP texture entropy (64×64 crop, threshold 4.2) — unreliable, high false-pass rate on screen replays
- MobileNetV2 liveness TFLite — primary anti-spoof check (based on knottx/flutter_liveness)
  - Model: `assets/models/mobilenetv2_liveness.tflite`; Input: [1,224,224,3] float32 /255; Output: [1,1] sigmoid
  - result[0] = liveness probability (1=real, 0=spoof) — inverted vs flutter_liveness reference
  - `spoofProb = 1 - result[0]`, `passed = spoofProb < 0.5`
  - Service: `services/miniFASNetAntiSpoofService.ts`

## Services
- `faceQualityService` — ML Kit detect, returns bbox + eye probs + head angles
- `livenessService` — passive check (eyes open + head pose), uses ML Kit data from quality photo
- `textureAnalysisService` — LBP entropy anti-spoofing on 64×64 face crop
- `miniFASNetAntiSpoofService` — MiniFASNet V2 TFLite screen-replay detection on 80×80 face crop
- `mobileFaceNetService` — TFLite model load + embedding; `dotProduct()` for normalized vecs
- `faceTemplateStore` — JSON files per user, in-memory cache
- `verificationService` — matches embedding vs templates
- `syncService` — queue items, upload to AWS on reconnect, purge local templates after confirm
- `attendanceService` — fetch GET /attendance from server for dashboard
- `backgroundSyncTask` — WorkManager background sync via expo-background-fetch (fires on network, even when app killed)

## Sync API contract
POST `{apiEndpoint}/sync`       body: `{ items: SyncQueueItem[] }`  response: `{ syncedIds: string[] }`
GET  `{apiEndpoint}/attendance` query: `?limit=N`                    response: `{ events: AttendanceEvent[] }`
Config in `constants/aws.ts`. `startSyncListener()` called in App.tsx on boot.
Auto-sync triggers: boot (if already online), network restore event, WorkManager background task (~15 min interval).
Mock server: `node scripts/mock-sync-server.js` — auto-detects LAN IP and patches `constants/aws.ts`.

## Models / Constants
- `assets/models/mobilefacenet.tflite` — float32, 192-dim output
- `constants/model.ts` — threshold 0.65, embedding size 192, LBP_ENTROPY_THRESHOLD 4.2
- `constants/aws.ts` — auto-patched by mock server; replace apiEndpoint before demo

## Infrastructure (not deployed yet)
- `infra/main.tf` — Terraform: DynamoDB (PAY_PER_REQUEST) + Lambda (Node.js 20.x) + API Gateway HTTP API
- `infra/lambda/index.js` — Lambda handler mirroring mock server exactly
- Deploy: `cd infra && terraform apply -var="region=ap-south-1"`; copy api_url output into `constants/aws.ts`

## Navigation
Home → Verification → Result | Home → RegistrationForm → FaceRegistrationCamera → Home
Home → RegisteredUsers | Home → Dashboard (attendance history from server)

## Screens
- `HomeScreen` — status cards (offline mode, templates, sync queue), action buttons
- `VerificationScreen` — camera + full pipeline (quality → liveness → LBP → embedding → match)
- `ResultScreen` — PASS/FAIL result display
- `RegistrationFormScreen` — enter employee ID + name
- `FaceRegistrationCameraScreen` — capture 3–5 face samples, generate templates
- `RegisteredUsersScreen` — list locally registered users
- `DashboardScreen` — attendance history pulled from server (summary stats + event list)

## Dev Workflow
1. `node scripts/mock-sync-server.js` — starts server, auto-patches LAN IP into constants/aws.ts
2. `npx expo run:android` — builds and installs (JS + model bundled into APK via bundleInDebug=true)
3. Unplug USB — app runs fully offline; syncs automatically when network available

## TODO (priority order)
1. ~~Anti-spoofing: implement MiniFASNet TFLite~~ — DONE: LBP (Phase 2b) + MiniFASNet V2 (Phase 2c)
2. Deploy AWS infra: run terraform, update apiEndpoint in constants/aws.ts
3. Integration into existing Datalake 3.0 app
4. Final presentation / demo prep

## Evaluation (100 marks)
Innovation 30 · Feasibility 30 · Scalability/Sync 20 · Presentation/Docs 20
