import { LivenessResult } from './verification';

export type RootStackParamList = {
  Home: undefined;
  Verification: undefined;
  Result: {
    success: boolean;
    livenessPass: boolean;
    livenessResult?: LivenessResult;
    matchScore: number;
    processingMs: number;
    matchedUser?: { name: string; employeeId: string };
  };
  RegistrationForm: undefined;
  FaceRegistrationCamera: {
    employeeId: string;
    name: string;
  };
  RegisteredUsers: undefined;
};
