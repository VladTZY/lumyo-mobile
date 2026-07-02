import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'auth_token';

// SecureStore has no web implementation; fall back to localStorage there.
const webStorage = Platform.OS === 'web' ? (globalThis as any).localStorage : null;

export async function getToken(): Promise<string | null> {
  if (webStorage) return webStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (webStorage) { webStorage.setItem(TOKEN_KEY, token); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  if (webStorage) { webStorage.removeItem(TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<{ data: T; token?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  // Extract JWT from response Authorization header (login/signup)
  const authHeader = response.headers.get('Authorization');
  const newToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  const text = await response.text();
  const data: T = text ? JSON.parse(text) : ({} as T);

  if (!response.ok) {
    const err = data as { message?: string; errors?: string[]; error?: string };
    const message =
      err.message ||
      (err.errors ? err.errors.join(', ') : null) ||
      err.error ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return { data, token: newToken };
}

export { request };
