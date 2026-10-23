import type { WebSearchProviderId } from '@mavis/config';

import { WebSearchProviderError } from './types.js';

export function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
  );
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function postJson(
  provider: WebSearchProviderId,
  url: string,
  body: unknown,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new WebSearchProviderError(
      provider,
      `${providerLabel(provider)} request failed (${response.status}): ${errorMessageFromBody(text, response.statusText)}`,
      response.status,
    );
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WebSearchProviderError(
      provider,
      `${providerLabel(provider)} returned non-JSON search output.`,
      response.status,
    );
  }
}

export function errorMessageFromBody(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const record = asRecord(parsed);
    if (record) {
      for (const key of ['error', 'message', 'detail', 'msg']) {
        const value = readString(record[key]) ?? readString(asRecord(record[key])?.message);
        if (value) return value;
      }
    }
  } catch {
    // Keep the raw body when it is not JSON.
  }
  return trimmed.slice(0, 300);
}

function providerLabel(provider: WebSearchProviderId): string {
  if (provider === 'tavily') return 'Tavily';
  if (provider === 'exa') return 'Exa';
  return 'DeepSeek';
}
