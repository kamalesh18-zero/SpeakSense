import {
  ScriptItem,
  RecordingItem,
  AnnotationItem,
  ContrastiveAnalysisResult,
  BenchmarkMetrics,
  User,
  BenchmarkProfile,
  BenchmarkAnalysisResult,
  AnalysisHistoryItem,
} from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('speaksense_auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('speaksense_auth_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('speaksense_auth_token');
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

// ----------------- Authentication -----------------

export async function registerUser(payload: {
  full_name: string;
  email: string;
  password: string;
  mobile?: string;
}): Promise<{ status: string; token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }
  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<{ status: string; token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Invalid email or password');
  }
  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      clearAuthToken();
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

export async function logoutUser() {
  const token = getAuthToken();
  if (token) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }).catch(() => {});
    clearAuthToken();
  }
}

export async function updateUserProfile(payload: {
  full_name: string;
  mobile?: string;
  avatar_color?: string;
}): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update profile' }));
    throw new Error(err.detail || 'Profile update failed');
  }
  const data = await res.json();
  return data.user;
}

// ----------------- Benchmark Profiles -----------------

export async function fetchBenchmarkProfiles(): Promise<BenchmarkProfile[]> {
  const res = await fetch(`${API_BASE}/benchmarks`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load benchmark profiles');
  return res.json();
}

export async function fetchBenchmarkProfile(categoryKey: string): Promise<BenchmarkProfile> {
  const res = await fetch(`${API_BASE}/benchmarks/${categoryKey}`);
  if (!res.ok) throw new Error(`Failed to load benchmark profile ${categoryKey}`);
  return res.json();
}

export async function updateBenchmarkProfile(
  categoryKey: string,
  payload: Partial<BenchmarkProfile>
): Promise<BenchmarkProfile> {
  const res = await fetch(`${API_BASE}/benchmarks/${categoryKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update benchmark profile');
  const data = await res.json();
  return data.profile;
}

export async function resetBenchmarkProfiles(): Promise<BenchmarkProfile[]> {
  const res = await fetch(`${API_BASE}/benchmarks/reset`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to reset benchmark profiles');
  const data = await res.json();
  return data.profiles;
}

// ----------------- Single-Audio Benchmark Analysis -----------------

export async function analyzeBenchmarkSpeech(params: {
  audioFile?: File | Blob;
  audioPath?: string;
  categoryKey: string;
  transcript?: string;
  scriptId?: string;
}): Promise<BenchmarkAnalysisResult> {
  const formData = new FormData();
  if (params.audioFile) {
    const filename = params.audioFile instanceof File ? params.audioFile.name : 'recording.wav';
    formData.append('audio_file', params.audioFile, filename);
  }
  if (params.audioPath) {
    formData.append('audio_path', params.audioPath);
  }
  formData.append('category_key', params.categoryKey);
  if (params.transcript) {
    formData.append('transcript', params.transcript);
  }
  if (params.scriptId) {
    formData.append('script_id', params.scriptId);
  }

  const res = await fetch(`${API_BASE}/analyze/benchmark`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Benchmark analysis failed' }));
    throw new Error(err.detail || 'Analysis failed');
  }
  return res.json();
}

// ----------------- User History -----------------

export async function fetchUserHistory(): Promise<AnalysisHistoryItem[]> {
  const res = await fetch(`${API_BASE}/user/history`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load user history');
  return res.json();
}

export async function deleteUserHistory(analysisId: string) {
  const res = await fetch(`${API_BASE}/user/history/${analysisId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete history item');
  return res.json();
}

// ----------------- Scripts & Annotations -----------------

export async function fetchScripts(): Promise<ScriptItem[]> {
  const res = await fetch(`${API_BASE}/scripts`);
  if (!res.ok) throw new Error('Failed to load scripts');
  return res.json();
}

export async function fetchRecordings(scriptId?: string): Promise<RecordingItem[]> {
  const url = scriptId ? `${API_BASE}/recordings?script_id=${scriptId}` : `${API_BASE}/recordings`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load recordings');
  return res.json();
}

export async function fetchAnnotations(): Promise<AnnotationItem[]> {
  const res = await fetch(`${API_BASE}/annotations`);
  if (!res.ok) throw new Error('Failed to load annotations');
  return res.json();
}

export async function saveAnnotation(annotation: Partial<AnnotationItem>) {
  const res = await fetch(`${API_BASE}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annotation),
  });
  if (!res.ok) throw new Error('Failed to save annotation');
  return res.json();
}

export async function deleteAnnotation(id: string) {
  const res = await fetch(`${API_BASE}/annotations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete annotation');
  return res.json();
}

export async function uploadAudioFile(file: File, audioType: 'reference' | 'participant' = 'participant') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('audio_type', audioType);

  const res = await fetch(`${API_BASE}/audio/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Audio upload failed');
  }
  return res.json();
}

export async function executeSpeechAnalysis(params: {
  referencePath: string;
  participantPath: string;
  transcript: string;
  presetName: string;
  scriptId?: string;
}): Promise<ContrastiveAnalysisResult> {
  const formData = new FormData();
  formData.append('reference_path', params.referencePath);
  formData.append('participant_path', params.participantPath);
  formData.append('transcript', params.transcript);
  formData.append('preset_name', params.presetName);
  if (params.scriptId) {
    formData.append('script_id', params.scriptId);
  }

  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Analysis execution failed' }));
    throw new Error(err.detail || 'Analysis failed');
  }
  return res.json();
}

export async function fetchRecentAnalyses() {
  const res = await fetch(`${API_BASE}/analysis/recent`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load recent analyses');
  return res.json();
}

export async function fetchAnalysisById(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/analysis/${id}`);
  if (!res.ok) throw new Error('Failed to load analysis record');
  return res.json();
}

export async function runBenchmark(split: string = 'test'): Promise<BenchmarkMetrics> {
  const res = await fetch(`${API_BASE}/dataset/evaluate?split=${split}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to run benchmark');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function updateSettings(payload: any) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// ----------------- Gemini AI Features -----------------

export interface GeneratedSpeechScript {
  title: string;
  category: string;
  estimated_duration_sec: number;
  estimated_wpm: number;
  transcript: string;
  pause_markers: string[];
  emphasis_words: string[];
  coaching_tips: string[];
}

export async function generateSpeechScriptAI(payload: {
  topic: string;
  category?: string;
  duration_seconds?: number;
  tone?: string;
}): Promise<GeneratedSpeechScript> {
  const res = await fetch(`${API_BASE}/ai/generate-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate script' }));
    throw new Error(err.detail || 'Script generation failed');
  }
  return res.json();
}

export interface CoachAIResponse {
  coach_name: string;
  advice: string;
  key_takeaway: string;
  quick_drill: string;
}

export async function askCoachAI(payload: {
  question: string;
  context?: string;
}): Promise<CoachAIResponse> {
  const res = await fetch(`${API_BASE}/ai/ask-coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to consult Coach AI' }));
    throw new Error(err.detail || 'Coach AI consultation failed');
  }
  return res.json();
}

export interface FlawDoctorDiagnosis {
  overall_summary: string;
  primary_flaw_analysis: {
    name: string;
    acoustic_evidence: string;
    root_cause: string;
    audience_perception: string;
  };
  actionable_drills: Array<{
    name: string;
    duration: string;
    instruction: string;
  }>;
  score_potential: string;
}

export async function diagnoseFlawsAI(measurements: Record<string, any>): Promise<FlawDoctorDiagnosis> {
  const res = await fetch(`${API_BASE}/ai/flaw-doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ measurements }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to run Flaw Doctor diagnosis' }));
    throw new Error(err.detail || 'Flaw Doctor diagnosis failed');
  }
  return res.json();
}

export async function polishSpeechAI(text: string): Promise<{
  polished_text: string;
  enhancements_made: string[];
  estimated_duration_sec: number;
}> {
  const res = await fetch(`${API_BASE}/ai/polish-speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to polish speech' }));
    throw new Error(err.detail || 'Speech polish failed');
  }
  return res.json();
}


