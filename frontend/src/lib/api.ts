/**
 * API client for communicating with the backend.
 */

const API_BASE = import.meta.env.PROD
  ? '/lyd-til-tekst/api'
  : 'http://localhost:8090/api';

interface ApiError {
  detail: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ detail: 'Ukendt fejl' }));
    throw new Error(error.detail);
  }
  // Handle 204 No Content responses
  if (response.status === 204) {
    return {} as T;
  }
  return response.json();
}

// Auth
export interface User {
  id: number;
  username: string;
  email?: string;
}

export async function register(username: string, password: string, email?: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password, email }),
  });
  return handleResponse<User>(res);
}

export async function login(username: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  return handleResponse<User>(res);
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getMe(): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Transcription
export interface Transcription {
  id: number;
  filename?: string;
  duration_seconds: number;
  duration_formatted: string;
  raw_text: string;
  instruction?: string;
  processed_text?: string;
  has_audio: boolean;
  created_at: string;
  updated_at: string;
}

export interface TranscriptionList {
  transcriptions: Transcription[];
  total: number;
}

export async function transcribe(file: File, context?: string): Promise<Transcription> {
  const formData = new FormData();
  formData.append('file', file);
  if (context) {
    formData.append('context', context);
  }

  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  return handleResponse<Transcription>(res);
}

export async function getTranscriptions(skip = 0, limit = 50): Promise<TranscriptionList> {
  const res = await fetch(`${API_BASE}/transcriptions?skip=${skip}&limit=${limit}`, {
    credentials: 'include',
  });
  return handleResponse<TranscriptionList>(res);
}

export async function getTranscription(id: number): Promise<Transcription> {
  const res = await fetch(`${API_BASE}/transcriptions/${id}`, {
    credentials: 'include',
  });
  return handleResponse<Transcription>(res);
}

export async function updateTranscription(id: number, rawText: string): Promise<Transcription> {
  const res = await fetch(`${API_BASE}/transcriptions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ raw_text: rawText }),
  });
  return handleResponse<Transcription>(res);
}

export async function processTranscription(id: number, instruction: string, styleGuideId?: number): Promise<Transcription> {
  const body: { instruction: string; style_guide_id?: number } = { instruction };
  if (styleGuideId) {
    body.style_guide_id = styleGuideId;
  }

  const res = await fetch(`${API_BASE}/transcriptions/${id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return handleResponse<Transcription>(res);
}

export async function deleteTranscription(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/transcriptions/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const error: ApiError = await res.json().catch(() => ({ detail: 'Ukendt fejl' }));
    throw new Error(error.detail);
  }
}

// Audio
export function getAudioUrl(id: number): string {
  return `${API_BASE}/transcriptions/${id}/audio`;
}

export async function deleteAudio(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/transcriptions/${id}/audio`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const error: ApiError = await res.json().catch(() => ({ detail: 'Ukendt fejl' }));
    throw new Error(error.detail);
  }
}

// Style Guides
export interface StyleGuide {
  id: number;
  name: string;
  description?: string;
  examples?: string;
  guide_content?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function getStyleGuides(): Promise<StyleGuide[]> {
  const res = await fetch(`${API_BASE}/settings/style-guides`, {
    credentials: 'include',
  });
  return handleResponse<StyleGuide[]>(res);
}

export async function createStyleGuide(name: string, description?: string, examples?: string): Promise<StyleGuide> {
  const res = await fetch(`${API_BASE}/settings/style-guides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, description, examples }),
  });
  return handleResponse<StyleGuide>(res);
}

export async function getStyleGuide(id: number): Promise<StyleGuide> {
  const res = await fetch(`${API_BASE}/settings/style-guides/${id}`, {
    credentials: 'include',
  });
  return handleResponse<StyleGuide>(res);
}

export async function updateStyleGuide(
  id: number,
  data: { name?: string; description?: string; examples?: string; guide_content?: string }
): Promise<StyleGuide> {
  const res = await fetch(`${API_BASE}/settings/style-guides/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse<StyleGuide>(res);
}

export async function deleteStyleGuide(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/settings/style-guides/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const error: ApiError = await res.json().catch(() => ({ detail: 'Ukendt fejl' }));
    throw new Error(error.detail);
  }
}

export async function generateStyleGuide(id: number): Promise<StyleGuide> {
  const res = await fetch(`${API_BASE}/settings/style-guides/${id}/generate`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse<StyleGuide>(res);
}

export async function setDefaultStyleGuide(id: number): Promise<StyleGuide> {
  const res = await fetch(`${API_BASE}/settings/style-guides/${id}/default`, {
    method: 'PUT',
    credentials: 'include',
  });
  return handleResponse<StyleGuide>(res);
}

// Usage tracking
export interface UsageRecord {
  id: number;
  provider: string;
  model: string;
  operation: string;
  api_tier?: string;
  audio_seconds?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd: number;
  cost_dkk: number;
  transcription_id?: number;
  style_guide_id?: number;
  created_at: string;
}

export interface OperationSummary {
  operation: string;
  count: number;
  total_cost_usd: number;
  total_cost_dkk: number;
}

export interface MonthlySummary {
  month: string;
  count: number;
  total_cost_usd: number;
  total_cost_dkk: number;
}

export interface UsageSummary {
  total_cost_usd: number;
  total_cost_dkk: number;
  exchange_rate: number;
  total_requests: number;
  by_operation: OperationSummary[];
  by_month: MonthlySummary[];
}

export async function getUsage(skip = 0, limit = 100): Promise<UsageRecord[]> {
  const res = await fetch(`${API_BASE}/usage?skip=${skip}&limit=${limit}`, {
    credentials: 'include',
  });
  return handleResponse<UsageRecord[]>(res);
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const res = await fetch(`${API_BASE}/usage/summary`, {
    credentials: 'include',
  });
  return handleResponse<UsageSummary>(res);
}

// Image Generation
export interface ImageGeneration {
  id: number;
  prompt: string;
  image_url: string;
  text_response?: string;
  turn_number: number;
  parent_id?: number;
  transcription_id?: number;
  created_at: string;
}

export interface ImageGenerationList {
  generations: ImageGeneration[];
  total: number;
}

export interface GenerateImageRequest {
  prompt: string;
  session_id?: number;
  transcription_id?: number;
  aspect_ratio?: string;
  resolution?: string;
}

export async function generateImage(request: GenerateImageRequest): Promise<ImageGeneration> {
  const res = await fetch(`${API_BASE}/images/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  });
  return handleResponse<ImageGeneration>(res);
}

export function getImageDataUrl(id: number): string {
  return `${API_BASE}/images/${id}/data`;
}

export async function getImageGenerations(skip = 0, limit = 20): Promise<ImageGenerationList> {
  const res = await fetch(`${API_BASE}/images/?skip=${skip}&limit=${limit}`, {
    credentials: 'include',
  });
  return handleResponse<ImageGenerationList>(res);
}

export async function deleteImageGeneration(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/images/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const error: ApiError = await res.json().catch(() => ({ detail: 'Ukendt fejl' }));
    throw new Error(error.detail);
  }
}

export async function getImagesForTranscription(transcriptionId: number): Promise<ImageGeneration[]> {
  const res = await fetch(`${API_BASE}/images/transcription/${transcriptionId}`, {
    credentials: 'include',
  });
  return handleResponse<ImageGeneration[]>(res);
}
