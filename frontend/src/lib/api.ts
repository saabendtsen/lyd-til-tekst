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
    return res.json();
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

export async function processTranscription(id: number, instruction: string): Promise<Transcription> {
  const res = await fetch(`${API_BASE}/transcriptions/${id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ instruction }),
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
