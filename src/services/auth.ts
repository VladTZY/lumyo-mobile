import { request, setToken, removeToken } from './api';

export interface User {
  id: number;
  email: string;
}

interface AuthResponse {
  message: string;
  user: User;
}

export async function signUp(
  email: string,
  password: string,
  passwordConfirmation: string,
): Promise<User> {
  const { data, token } = await request<AuthResponse>(
    '/signup',
    {
      method: 'POST',
      body: JSON.stringify({
        user: { email, password, password_confirmation: passwordConfirmation },
      }),
    },
    false,
  );
  if (token) await setToken(token);
  return data.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, token } = await request<AuthResponse>(
    '/login',
    {
      method: 'POST',
      body: JSON.stringify({ user: { email, password } }),
    },
    false,
  );
  if (token) await setToken(token);
  return data.user;
}

export async function signOut(): Promise<void> {
  try {
    await request('/logout', { method: 'DELETE' });
  } finally {
    await removeToken();
  }
}
