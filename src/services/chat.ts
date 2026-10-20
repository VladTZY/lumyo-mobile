import { BASE_URL, getToken, request } from './api';

export interface Source {
  note_id: number;
  title: string;
  /**
   * The passage the answer used: the full chunk body of the note, without the
   * indexing prefix. Messages saved before that change hold a truncated
   * (200 codepoints, ending "...") string that still starts with the
   * "title: ...\ntags: ...\n\n" prefix; locateChunk handles both shapes.
   */
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

/**
 * Sends a message and streams the assistant response via SSE.
 * Calls onDelta with each text chunk; resolves with the final saved
 * message (including sources). Uses XHR because RN's fetch does not
 * support streaming response bodies — XHR delivers incremental
 * responseText through progress events.
 */
export async function sendMessageStream(
  chatId: number,
  content: string,
  onDelta: (delta: string) => void,
): Promise<Message> {
  if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');
  const token = await getToken();

  return new Promise<Message>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let seenLength = 0;
    let buffer = '';
    let finalMessage: Message | null = null;
    let streamError: string | null = null;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const processFrame = (frame: string) => {
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return;
      let payload: any;
      try {
        payload = JSON.parse(dataLines.join('\n'));
      } catch {
        return;
      }
      if (event === 'delta' && typeof payload.delta === 'string') {
        onDelta(payload.delta);
      } else if (event === 'done') {
        finalMessage = payload as Message;
      } else if (event === 'error') {
        streamError = payload.error || 'Something went wrong';
      }
    };

    const consume = () => {
      const text = xhr.responseText || '';
      buffer += text.slice(seenLength);
      seenLength = text.length;
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        processFrame(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    };

    xhr.open('POST', `${BASE_URL}/chats/${chatId}/messages`);
    xhr.responseType = 'text';
    xhr.timeout = 120000;
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onprogress = consume;

    xhr.onload = () => {
      consume();
      if (xhr.status >= 400) {
        let message = `Request failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          message = err.error || err.message || message;
        } catch {}
        settle(() => reject(new Error(message)));
      } else if (streamError) {
        settle(() => reject(new Error(streamError!)));
      } else if (finalMessage) {
        settle(() => resolve(finalMessage!));
      } else {
        settle(() => reject(new Error('Stream ended unexpectedly')));
      }
    };

    xhr.onerror = () => settle(() => reject(new Error('Network error')));
    xhr.ontimeout = () => settle(() => reject(new Error('Request timed out')));

    xhr.send(JSON.stringify({ message: { content } }));
  });
}
