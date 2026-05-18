const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

// Commands
export const api = {
  commands: {
    list: () => request<any[]>('/commands'),
    get: (id: string) => request<any>(`/commands/${id}`),
    create: (data: any) => request<any>('/commands', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/commands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/commands/${id}`, { method: 'DELETE' }),
    run: (id: string, data?: any) => request<any>(`/commands/${id}/run`, { method: 'POST', body: JSON.stringify(data || {}) }),
    runInline: (data: any) => request<any>('/commands/run', { method: 'POST', body: JSON.stringify(data) }),
  },

  flows: {
    list: () => request<any[]>('/flows'),
    get: (id: string) => request<any>(`/flows/${id}`),
    create: (data: any) => request<any>('/flows', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/flows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/flows/${id}`, { method: 'DELETE' }),
    addCommand: (id: string, data: any) => request<any>(`/flows/${id}/commands`, { method: 'POST', body: JSON.stringify(data) }),
    updateCommand: (id: string, cmdId: string, data: any) => request<any>(`/flows/${id}/commands/${cmdId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCommand: (id: string, cmdId: string) => request<void>(`/flows/${id}/commands/${cmdId}`, { method: 'DELETE' }),
    run: (id: string, data?: any) => request<any>(`/flows/${id}/run`, { method: 'POST', body: JSON.stringify(data || {}) }),
  },

  runs: {
    list: () => request<any>('/runs'),
    getCommand: (id: string) => request<any>(`/runs/commands/${id}`),
    getFlow: (id: string) => request<any>(`/runs/flows/${id}`),
  },

  meta: {
    commandTypes: () => request<any[]>('/meta/command-types'),
  },

  connections: {
    get: () => request<{ statuses: any[]; lastChecked: string | null }>('/connections'),
    refresh: () => request<{ statuses: any[]; lastChecked: string | null }>('/connections/refresh', { method: 'POST' }),
  },

  chat: {
    send: (messages: { role: string; content: string }[]) =>
      request<{ message: string; flow: any | null }>('/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      }),
  },
};
