import { request } from './api';

export interface Category {
  id: number;
  title: string;
  notes_count: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithNotes extends Category {
  notes: Note[];
}

import type { Note } from './notes';

export async function getCategories(): Promise<Category[]> {
  const { data } = await request<Category[]>('/categories');
  return data;
}

export async function getCategory(id: number): Promise<CategoryWithNotes> {
  const { data } = await request<CategoryWithNotes>(`/categories/${id}`);
  return data;
}

export async function createCategory(title: string): Promise<Category> {
  const { data } = await request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({ category: { title } }),
  });
  return data;
}

export async function updateCategory(id: number, title: string): Promise<Category> {
  const { data } = await request<Category>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ category: { title } }),
  });
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  await request(`/categories/${id}`, { method: 'DELETE' });
}

export async function autocategorizeAll(): Promise<{ categorized: number }> {
  const { data } = await request<{ categorized: number }>('/autocategorize_all', {
    method: 'POST',
  });
  return data;
}
