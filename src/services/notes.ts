import { request } from './api';
import type { Category } from './categories';
import type { NoteSummary } from './summaries';

export interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  categories: Category[];
  note_summary: NoteSummary | null;
}

export async function getNotes(): Promise<Note[]> {
  const { data } = await request<Note[]>('/notes');
  return data;
}

export async function getNote(id: number): Promise<Note> {
  const { data } = await request<Note>(`/notes/${id}`);
  return data;
}

export async function createNote(
  title: string,
  content: string,
  categoryIds: number[] = [],
): Promise<Note> {
  const { data } = await request<Note>('/notes', {
    method: 'POST',
    body: JSON.stringify({ note: { title, content }, category_ids: categoryIds }),
  });
  return data;
}

export async function updateNote(
  id: number,
  title: string,
  content: string,
  categoryIds?: number[],
): Promise<Note> {
  const body: Record<string, unknown> = { note: { title, content } };
  if (categoryIds !== undefined) body.category_ids = categoryIds;
  const { data } = await request<Note>(`/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data;
}

export async function deleteNote(id: number): Promise<void> {
  await request(`/notes/${id}`, { method: 'DELETE' });
}

export async function autocategorizeNote(id: number): Promise<Note> {
  const { data } = await request<Note>(`/notes/${id}/autocategorize`, {
    method: 'POST',
  });
  return data;
}
