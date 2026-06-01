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
    matchedUser?: { name: string; employeeId: string; role: 'Official' | 'PD'; position: string };
  };
  RegistrationForm: undefined;
  FaceRegistrationCamera: {
    employeeId: string;
    name: string;
    role: 'Official' | 'PD';
    position: string;
  };
  RegisteredUsers: undefined;
  Dashboard: {
    role?: 'Official' | 'PD';
    matchedUser?: { name: string; employeeId: string; position: string };
    fromManager?: boolean;
  };
};
