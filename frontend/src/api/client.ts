import { getApiBaseUrl } from '@/lib/env';

export class ApiError extends Error {
  public status: number;
  public details: unknown;
  public endpoint: string;

  constructor(status: number, message: string, details?: unknown, endpoint = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.endpoint = endpoint;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const { timeoutMs = 8000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...(fetchOptions.headers as Record<string, string>),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    let responseData: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json().catch(() => null);
    } else {
      responseData = await response.text().catch(() => null);
    }

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
        const detail = (responseData as { detail: unknown }).detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((d: { msg?: string; loc?: string[] }) => d.msg || JSON.stringify(d)).join(', ');
        }
      } else if (responseData && typeof responseData === 'object' && 'message' in responseData) {
        errorMessage = String((responseData as { message: unknown }).message);
      }

      throw new ApiError(response.status, errorMessage, responseData, endpoint);
    }

    return responseData as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, `Request timed out after ${timeoutMs}ms`, null, endpoint);
    }

    const message = err instanceof Error ? err.message : 'Network error occurred';
    throw new ApiError(0, `Network error: ${message}`, err, endpoint);
  }
}
