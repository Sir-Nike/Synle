export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
  } catch {
    throw new ApiError(
      'Couldn’t connect to Synle to confirm that action. Your input is kept. Reconnect and reload saved progress before retrying.',
      0,
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'Synle is temporarily unavailable. Your input is kept. Reload saved progress before retrying.',
      response.status,
    );
  }
  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'Couldn’t complete that request. Please try again.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}
