import { request } from './api';

export interface Source {
  note_id: number;
  title: string;
  chunk_text: string;
}

export interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant';
  content: string;
  sources: Source[];
  created_at: string;
}

export interface Chat {
  id: number;
  title: string;
  source_note_ids: number[];
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export async function getChats(): Promise<Chat[]> {
  const { data } = await request<Chat[]>('/chats');
  return data;
}

export async function getChat(id: number): Promise<Chat> {
  const { data } = await request<Chat>(`/chats/${id}`);
  return data;
}

export async function createChat(
  title: string,
  sourceNoteIds: number[],
): Promise<Chat> {
  const { data } = await request<Chat>('/chats', {
    method: 'POST',
    body: JSON.stringify({ title, source_note_ids: sourceNoteIds }),
  });
  return data;
}

export async function updateChat(
  id: number,
  sourceNoteIds: number[],
): Promise<Chat> {
  const { data } = await request<Chat>(`/chats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ source_note_ids: sourceNoteIds }),
  });
  return data;
}

export async function deleteChat(id: number): Promise<void> {
  await request(`/chats/${id}`, { method: 'DELETE' });
}

export async function sendMessage(
  chatId: number,
  content: string,
): Promise<Message> {
  const { data } = await request<Message>(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: { content } }),
  });
  return data;
}
