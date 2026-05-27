import FaceDetection from '@react-native-ml-kit/face-detection';

export type BoundingBox = { left: number; top: number; width: number; height: number };

export type FaceQualityResult = {
  passed: boolean;
  boundingBox?: BoundingBox;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  smilingProbability?: number;
  headEulerAngleY?: number;
  headEulerAngleZ?: number;
  reason?: string;
};

export async function assessFaceQuality(imagePath: string): Promise<FaceQualityResult> {
  if (!imagePath || imagePath.trim().length === 0) {
    return { passed: false, reason: 'No image path provided.' };
  }

  const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;

  let faces: Awaited<ReturnType<typeof FaceDetection.detect>>;
  try {
    faces = await FaceDetection.detect(uri, {
      performanceMode: 'accurate',
      classificationMode: 'all',
      landmarkMode: 'none',
      contourMode: 'none',
      minFaceSize: 0.1,
      trackingEnabled: false,
    });
  } catch (err) {
    console.warn('[FaceQuality] ML Kit detection failed:', err);
    return { passed: false, reason: 'Face detection failed.' };
  }

  if (faces.length === 0) {
    return { passed: false, reason: 'No face detected. Centre your face in the oval.' };
  }
  if (faces.length > 1) {
    return { passed: false, reason: 'Multiple faces detected. Ensure only one face is visible.' };
  }

  const face = faces[0];
  const { left, top, width, height } = face.frame;

  const leftEye = face.leftEyeOpenProbability ?? 1;
  const rightEye = face.rightEyeOpenProbability ?? 1;
  if (leftEye < 0.5 || rightEye < 0.5) {
    return { passed: false, reason: 'Eyes closed — open your eyes and try again.' };
  }

  console.log(
    `[FaceQuality] face detected bbox=(${left.toFixed(0)},${top.toFixed(0)},${width.toFixed(0)}x${height.toFixed(0)}) ` +
    `leftEye=${leftEye.toFixed(2)} rightEye=${rightEye.toFixed(2)}`
  );

  return {
    passed: true,
    boundingBox: { left, top, width, height },
    leftEyeOpenProbability:  leftEye,
    rightEyeOpenProbability: rightEye,
    smilingProbability:      face.smilingProbability,
    headEulerAngleY:         face.headEulerAngleY,
    headEulerAngleZ:         face.headEulerAngleZ,
  };
}
