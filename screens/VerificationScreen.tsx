import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { VerificationPhase } from '../types/verification';
import CameraOverlay from '../components/CameraOverlay';
import { generateEmbeddingFromImage, initializeMobileFaceNet, isMockMode, cosineSimilarity } from '../services/mobileFaceNetService';
import { getAllRegisteredUsers } from '../services/faceTemplateStore';
import { assessFaceQuality } from '../services/faceQualityService';
import { assessLiveness } from '../services/livenessService';
import { LivenessResult } from '../types/verification';
import { RegisteredUser } from '../types/face';
import { MOBILEFACENET_COSINE_THRESHOLD } from '../constants/model';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Verification'>;
};

const PHASE_STEP_LABEL: Record<VerificationPhase, string> = {
  aligning: 'Face Alignment',
  quality:  'Quality Check',
  liveness: 'Liveness Check',
  matching: 'Template Matching',
  done:     'Complete',
};


export default function VerificationScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const isFocused = useIsFocused();
  const cameraRef = useRef<Camera>(null);

  const [phase, setPhase] = useState<VerificationPhase>('aligning');
  const [isRunning, setIsRunning] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    Promise.all([
      initializeMobileFaceNet(),
      getAllRegisteredUsers(),
    ]).then(([, users]) => {
      setModelReady(true);
      setMockMode(isMockMode());
      setRegisteredUsers(users);
    });
  }, []);

  const runVerificationPipeline = useCallback(async () => {
    console.log('[Verify] pipeline start, isRunning:', isRunning, 'cameraRef:', !!cameraRef.current);
    if (isRunning || !cameraRef.current) return;
    setIsRunning(true);
    const startTime = Date.now();

    try {
      // ─── PHASE 1: Quality check ──────────────────────────────────────────
      setPhase('quality');
      console.log('[Verify] taking photo...');
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      console.log('[Verify] photo path:', photo.path);
      const quality = await assessFaceQuality(photo.path);
      console.log('[Verify] quality:', JSON.stringify(quality));
      if (!quality.passed) {
        setPhase('aligning');
        setIsRunning(false);
        return;
      }

      // ── PHASE 2: Passive liveness (reuses face data from quality check — no extra photo) ──
      setPhase('liveness');
      const livenessResult: LivenessResult = assessLiveness({
        leftEyeOpenProbability:  quality.leftEyeOpenProbability,
        rightEyeOpenProbability: quality.rightEyeOpenProbability,
        smilingProbability:      quality.smilingProbability,
        headEulerAngleY:         quality.headEulerAngleY,
        headEulerAngleZ:         quality.headEulerAngleZ,
      });
      if (!livenessResult.passed) {
        console.log('[Verify] liveness failed:', livenessResult.reason);
        setPhase('aligning');
        setIsRunning(false);
        return;
      }

      // ─── PHASE 3: Embedding + template match ────────────────────────────
      setPhase('matching');
      const embedding = await generateEmbeddingFromImage(photo.path, quality.boundingBox);
      console.log('[Verify] live embedding first 5:', embedding.slice(0, 5).map(v => v.toFixed(4)).join(', '));

      let bestScore = -1;
      let matchedUser: RegisteredUser | null = null;

      for (const user of registeredUsers) {
        for (const template of user.templates) {
          try {
            const storedNorm = Math.sqrt(template.embedding.reduce((s, v) => s + v * v, 0));
            const score = cosineSimilarity(embedding, template.embedding);
            console.log(
              `[Verify] user=${user.employeeId} template=${template.templateId} ` +
              `storedNorm=${storedNorm.toFixed(4)} score=${score.toFixed(4)} ` +
              `storedFirst5=[${template.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`
            );
            if (score > bestScore) {
              bestScore = score;
              matchedUser = user;
            }
          } catch {
            // dimension mismatch from a different model version — skip
          }
        }
      }

      const finalScore = Math.max(0, bestScore);
      console.log(`[Verify] bestScore=${finalScore.toFixed(4)} threshold=${MOBILEFACENET_COSINE_THRESHOLD} → ${finalScore >= MOBILEFACENET_COSINE_THRESHOLD ? 'PASS' : 'FAIL'} matchedUser=${matchedUser?.name ?? 'none'}`);
      const processingMs = Date.now() - startTime;
      const success = registeredUsers.length > 0 && finalScore >= MOBILEFACENET_COSINE_THRESHOLD;

      setPhase('done');
      setIsRunning(false);
      navigation.replace('Result', {
        success,
        livenessPass: livenessResult.passed,
        livenessResult,
        matchScore: finalScore,
        processingMs,
        matchedUser: success && matchedUser
          ? { name: matchedUser.name, employeeId: matchedUser.employeeId }
          : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      console.error('[Verify] pipeline error:', msg);
      setPhase('aligning');
      setIsRunning(false);
    }
  }, [isRunning, registeredUsers, navigation]);

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionBody}>
            Face authentication requires your front camera.{'\n'}
            All processing happens on-device — nothing is uploaded.
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.textButton} onPress={() => navigation.goBack()}>
            <Text style={styles.textButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── No front camera found ─────────────────────────────────────────────────
  if (!device) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>⚠️</Text>
          <Text style={styles.permissionTitle}>No Front Camera</Text>
          <Text style={styles.permissionBody}>
            A front-facing camera is required for face authentication.
          </Text>
          <TouchableOpacity style={styles.textButton} onPress={() => navigation.goBack()}>
            <Text style={styles.textButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── No registered users ───────────────────────────────────────────────────
  if (modelReady && registeredUsers.length === 0) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>👤</Text>
          <Text style={styles.permissionTitle}>No Registered Users</Text>
          <Text style={styles.permissionBody}>
            Register at least one employee before running verification.
          </Text>
          <TouchableOpacity style={styles.textButton} onPress={() => navigation.goBack()}>
            <Text style={styles.textButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && phase !== 'done' && appState === 'active'}
        photo
      />

      {/* Mock badge */}
      {mockMode && (
        <SafeAreaView style={styles.mockBadgeContainer} pointerEvents="none">
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>MOCK MODE</Text>
          </View>
        </SafeAreaView>
      )}

      <CameraOverlay phase={phase} />

      <SafeAreaView style={styles.bottomSafeArea}>
        <View style={styles.panel}>
          <View style={styles.panelInfo}>
            <View style={styles.stepRow}>
              <Text style={styles.stepKey}>Current step</Text>
              <Text style={styles.stepVal}>{PHASE_STEP_LABEL[phase]}</Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepKey}>Registered users</Text>
              <Text style={styles.stepVal}>{registeredUsers.length}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.captureButton, (isRunning || !modelReady) && styles.captureButtonBusy]}
            onPress={runVerificationPipeline}
            disabled={isRunning || !modelReady}
            activeOpacity={0.85}
          >
            {isRunning ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.captureButtonText}>Processing…</Text>
              </View>
            ) : (
              <Text style={styles.captureButtonText}>
                {modelReady ? 'Capture / Verify' : 'Loading model…'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: '#0F1117',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionCard: {
    backgroundColor: '#1A1E2E',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#252A3A',
  },
  permissionIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
  },
  grantButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  textButton: {
    paddingVertical: 8,
  },
  textButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
  mockBadgeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  mockBadge: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 8,
  },
  mockBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  panel: {
    backgroundColor: 'rgba(10, 12, 20, 0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 24,
    gap: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  panelInfo: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepKey: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  stepVal: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  challengeText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '600',
  },
  captureButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  captureButtonBusy: {
    backgroundColor: '#1D4ED8',
    opacity: 0.85,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '500',
  },
});
