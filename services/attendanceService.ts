import { AWS_CONFIG } from '../constants/aws';

export interface AttendanceEvent {
  id:           string;
  employeeId:   string;
  matchedName:  string | null;
  success:      boolean;
  livenessPass: boolean;
  matchScore:   number;
  processingMs: number;
  timestamp:    string;
  syncedAt:     string;
}

export async function fetchAttendanceHistory(limit = 100): Promise<AttendanceEvent[]> {
  const url = `${AWS_CONFIG.apiEndpoint}${AWS_CONFIG.attendancePath}?limit=${limit}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (AWS_CONFIG.apiKey) headers['x-api-key'] = AWS_CONFIG.apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AWS_CONFIG.timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { events?: AttendanceEvent[] };
    return body.events ?? [];
  } finally {
    clearTimeout(timeout);
  }
}
