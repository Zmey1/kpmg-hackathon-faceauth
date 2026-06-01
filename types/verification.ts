export type VerificationPhase =
  | 'aligning'
  | 'quality'
  | 'liveness'
  | 'matching'
  | 'done';

export interface LivenessResult {
  passed: boolean;
  reason?: string;
  eyeScore: number;          // min of left/right eye open probability
  smilingProbability: number;
  headYaw: number;           // headEulerAngleY in degrees
  headRoll: number;          // headEulerAngleZ in degrees
}

export interface VerificationMetrics {
  success: boolean;
  livenessPass: boolean;
  livenessResult?: LivenessResult;
  matchScore: number;
  processingMs: number;
  matchedUser?: { name: string; employeeId: string; role?: 'Official' | 'PD'; position?: string };
}
