const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'auth_token';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
  token: string;
}

export interface MeResponse {
  user: AuthUser;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function authFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  let data: { message?: string; code?: string } & T;
  try {
    data = await res.json();
  } catch {
    throw new AuthApiError('Invalid server response', res.status);
  }

  if (!res.ok) {
    throw new AuthApiError(data.message ?? 'Request failed', res.status, data.code);
  }

  return data;
}

export async function signup(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return authFetch<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  }, false);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return authFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
}

export async function logout(): Promise<void> {
  try {
    await authFetch<{ message: string }>('/api/auth/logout', { method: 'POST' });
  } catch {
    // Client-side logout still proceeds if server is unreachable
  }
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authFetch<MeResponse>('/api/auth/me');
  return data.user;
}
