import { AxiosError, create, isAxiosError } from 'axios';

import { API_BASE } from '@/constants/config';

import { getAuthToken } from './tokenHolder';

export const http = create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type ErrorBody = {
  error?: string;
  message?: string;
  code?: string;
};

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

/**
 * Normalize the ARC-AI server's inconsistent error envelopes
 * (`{ message }`, `{ error, code }`, `{ error }`) into one Error.
 */
export function extractApiError(err: unknown): ApiError {
  const fallback = 'Something went wrong. Please try again.';
  if (isAxiosError(err)) {
    const ax = err as AxiosError<ErrorBody>;
    const body = ax.response?.data;
    const message = body?.error || body?.message || ax.message || fallback;
    const out = new Error(message) as ApiError;
    out.status = ax.response?.status;
    out.code = body?.code;
    return out;
  }
  if (err instanceof Error) return err as ApiError;
  return new Error(fallback) as ApiError;
}
