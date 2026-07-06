export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const jsonBody = typeof init?.body === 'string';
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `${init?.method ?? 'GET'} ${path} → ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      }
    } catch {
      // keep the generic message
    }
    throw new HttpError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
