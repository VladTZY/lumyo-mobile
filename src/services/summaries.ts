import { request } from './api';

export interface NoteSummary {
  id: number;
  note_id: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  content: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function getSummary(noteId: number): Promise<NoteSummary | null> {
  try {
    const { data } = await request<NoteSummary>(`/notes/${noteId}/summary`);
    return data;
  } catch (e: any) {
    if (e.message?.includes('404') || e.message?.includes('No summary found')) return null;
    throw e;
  }
}

export async function generateSummary(noteId: number): Promise<NoteSummary> {
  const { data } = await request<NoteSummary>(`/notes/${noteId}/summary`, {
    method: 'POST',
  });
  return data;
}
