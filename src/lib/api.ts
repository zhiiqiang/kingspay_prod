import {
  clearStoredAuthToken,
  clearStoredUserPermissions,
  clearStoredUserRole,
  getStoredAuthToken,
} from './auth';

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiAuthError';
  }
}

export class ApiResponseError extends Error {
  responseBody: unknown;

  constructor(message: string, responseBody: unknown) {
    super(message);
    this.name = 'ApiResponseError';
    this.responseBody = responseBody;
  }
}

export const AUTH_EXPIRED_EVENT = 'kp-auth-expired';

const API_ROOT = import.meta.env.VITE_API_ROOT as string | undefined;

if (!API_ROOT) {
  // Provide a clear failure early if the environment is misconfigured
  console.warn('VITE_API_ROOT is not defined. API requests will fail.');
}

export type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export async function apiFetch<TResponse>(
  path: string,
  { method = 'GET', body, headers, signal }: ApiFetchOptions = {},
): Promise<TResponse> {
  if (!API_ROOT) {
    throw new Error('API root URL is not configured. Please set VITE_API_ROOT.');
  }

  const url = `${API_ROOT.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const storedToken = getStoredAuthToken();
  if (storedToken && !('Authorization' in requestHeaders)) {
    requestHeaders.Authorization = `Bearer ${storedToken}`;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    // Surface a clearer hint for common CORS/network failures that manifest as TypeError
    if (error instanceof TypeError) {
      throw new Error(
        `Network request failed. This is often due to CORS configuration or connectivity issues: ${error.message}`,
      );
    }

    throw error;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const parsedBody = isJson ? await response.json().catch(() => null) : null;

  const responseMessage = (parsedBody as { message?: string } | null)?.message;
  const responseStatus = (parsedBody as { status?: boolean } | null)?.status;
  const normalizedMessage = responseMessage || `Request failed with status ${response.status}`;

  if (responseStatus === false) {
    if (normalizedMessage.toLowerCase().includes('invalid or expired access token')) {
      clearStoredAuthToken();
      clearStoredUserRole();
      clearStoredUserPermissions();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(AUTH_EXPIRED_EVENT, {
            detail: { message: normalizedMessage },
          }),
        );
      }
      throw new ApiAuthError(normalizedMessage);
    }

    throw new ApiResponseError(normalizedMessage, parsedBody);
  }

  if (!response.ok) {
    throw new ApiResponseError(normalizedMessage, parsedBody);
  }

  return (parsedBody ?? (await response.text())) as TResponse;
}
