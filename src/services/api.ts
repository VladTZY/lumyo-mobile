import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'auth_token';

const USER_KEY = 'auth_user';

// SecureStore has no web implementation; fall back to localStorage there.
const webStorage = Platform.OS === 'web' ? (globalThis as any).localStorage : null;

async function getItem(key: string): Promise<string | null> {
  if (webStorage) return webStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (webStorage) { webStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (webStorage) { webStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

export const getToken = () => getItem(TOKEN_KEY);
export const setToken = (token: string) => setItem(TOKEN_KEY, token);
export const removeToken = () => deleteItem(TOKEN_KEY);
export const getStoredUser = () => getItem(USER_KEY);
export const setStoredUser = (json: string) => setItem(USER_KEY, json);
export const removeStoredUser = () => deleteItem(USER_KEY);

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
