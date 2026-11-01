import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Api, Message, Model } from '@earendil-works/pi-ai';
import type { NormalizedLLMError } from '@mavis/shared/llm-error-classifier';

import {
  fitOutboundImages,
  resolveMaxImagesPerRequest,
  serializedMessageBytes,
  type ModelRequestImageLimit,
} from './request-image-limit.js';

/**
 * Per-route memory of how large a request body this base URL has actually
 * accepted. There is no built-in gateway size. A declared
 * `max_request_body_bytes` is the budget. Otherwise the budget appears only
 * after a larger request is refused, and it is the last size that succeeded.
 */
interface RouteBodyMemory {
  highWaterBytes: number;
  ceilingBytes?: number;
}

const routes = new Map<string, RouteBodyMemory>();
let persistPath: string | undefined;

const PAYLOAD_LIMIT_RE = /\((\d+) bytes > (\d+) limit\)/i;

export function resetRequestBodyBudgetForTests(): void {
  routes.clear();
  persistPath = undefined;
}

/** Remember successes and learned ceilings across process restarts. */
export function bindRequestBodyBudgetFile(filePath: string | undefined): void {
  persistPath = filePath && filePath.trim() ? filePath : undefined;
  routes.clear();
  if (!persistPath) return;
  try {
    const parsed: unknown = JSON.parse(readFileSync(persistPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const stored = Reflect.get(parsed, 'routes');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
    for (const [key, value] of Object.entries(stored)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const highWaterBytes = positiveInteger(Reflect.get(value, 'highWaterBytes'));
      const ceilingBytes = positiveInteger(Reflect.get(value, 'ceilingBytes'));
      if (highWaterBytes === undefined && ceilingBytes === undefined) continue;
      routes.set(key, {
        highWaterBytes: highWaterBytes ?? ceilingBytes ?? 0,
        ...(ceilingBytes === undefined ? {} : { ceilingBytes }),
      });
    }
  } catch {
    // A missing or unreadable file starts the process with no learned budget.
  }
}

export function requestBodyRouteKey(model: { baseUrl?: string; provider?: string }): string {
  const base = model.baseUrl?.trim();
  if (base) return base.replace(/\/+$/u, '').toLowerCase();
  return `provider:${model.provider ?? ''}`;
}

/** Declared body cap and any ceiling learned from a refusal, whichever is tighter. */
export function requestBodyBudgetBytes(
  model: (Model<Api> & ModelRequestImageLimit) | { baseUrl?: string; provider?: string; maxRequestBodyBytes?: number },
): number | undefined {
  const declared = positiveInteger(model.maxRequestBodyBytes);
  const learned = routes.get(requestBodyRouteKey(model))?.ceilingBytes;
  if (declared !== undefined && learned !== undefined) return Math.min(declared, learned);
  return declared ?? learned;
}

export function noteRequestBodySuccess(
  model: { baseUrl?: string; provider?: string },
  sentBytes: number,
): void {
  if (!Number.isSafeInteger(sentBytes) || sentBytes < 0) return;
  const key = requestBodyRouteKey(model);
  const current = routes.get(key) ?? { highWaterBytes: 0 };
  if (sentBytes <= current.highWaterBytes) return;
  routes.set(key, { ...current, highWaterBytes: sentBytes });
  persistRoutes();
}

/**
 * After a refusal, pin this route to a smaller body and report whether the
 * next attempt can actually send fewer image bytes. A connection close learns
 * a ceiling only for a route with no declared body cap, and only when this
 * body is larger than a previous success. A second connection failure should
 * call {@link restoreRequestBodyCeiling} so an outage is not stored as a cap.
 */
export function adoptSmallerRequestBody(
  model: Model<Api> & ModelRequestImageLimit,
  messages: readonly Message[],
  sentBytes: number,
  normalized: NormalizedLLMError,
): boolean {
  const target = shrinkTarget(model, sentBytes, normalized);
  if (target === undefined || sentBytes <= target) return false;
  const fitted = fitOutboundImages(messages, {
    maxImages: resolveMaxImagesPerRequest(model),
    maxSerializedBytes: target,
  });
  if (serializedMessageBytes(fitted.messages) >= sentBytes) return false;
  const key = requestBodyRouteKey(model);
  const current = routes.get(key) ?? { highWaterBytes: 0 };
  routes.set(key, { ...current, ceilingBytes: target });
  persistRoutes();
  return true;
}

export function restoreRequestBodyCeiling(
  model: { baseUrl?: string; provider?: string },
  ceilingBytes: number | undefined,
): void {
  const key = requestBodyRouteKey(model);
  const current = routes.get(key);
  if (!current) return;
  if (ceilingBytes === undefined) {
    routes.set(key, { highWaterBytes: current.highWaterBytes });
  } else {
    routes.set(key, { ...current, ceilingBytes });
  }
  persistRoutes();
}

export function requestBodyCeilingBytes(
  model: { baseUrl?: string; provider?: string },
): number | undefined {
  return routes.get(requestBodyRouteKey(model))?.ceilingBytes;
}

/**
 * Fit the provider context to the current route budget. Returns the original
 * context object when nothing changes.
 */
export function prepareOutboundBody<T extends { messages: Message[] }>(
  model: Model<Api> & ModelRequestImageLimit,
  context: T,
): { context: T; bytes: number } {
  const fitted = fitOutboundImages(context.messages, {
    maxImages: resolveMaxImagesPerRequest(model),
    maxSerializedBytes: requestBodyBudgetBytes(model),
  });
  const bytes = serializedMessageBytes(fitted.messages);
  if (fitted.messages === context.messages) return { context, bytes };
  return { context: { ...context, messages: fitted.messages }, bytes };
}

/** True when a learned ceiling should be discarded because the smaller retry also lost the connection. */
export function requestBodyFailureIsOutage(normalized: NormalizedLLMError): boolean {
  return isConnectionRefusal(normalized) && !isOversizedRefusal(normalized);
}

function shrinkTarget(
  model: Model<Api> & ModelRequestImageLimit,
  sentBytes: number,
  normalized: NormalizedLLMError,
): number | undefined {
  if (normalized.facts.explicitAbort || normalized.facts.timeout) return undefined;
  const parsed = parsedPayloadLimit(normalized.sanitizedMessage);
  if (isOversizedRefusal(normalized)) {
    if (parsed !== undefined && sentBytes > 0) {
      const scaled = Math.floor((sentBytes * parsed.limitBytes) / parsed.announcedBytes) - 1;
      if (scaled > 0 && scaled < sentBytes) return scaled;
    }
    return highWaterTarget(model, sentBytes);
  }
  if (positiveInteger(model.maxRequestBodyBytes) !== undefined) return undefined;
  if (!isConnectionRefusal(normalized)) return undefined;
  return highWaterTarget(model, sentBytes);
}

function highWaterTarget(model: { baseUrl?: string; provider?: string }, sentBytes: number): number | undefined {
  const highWater = routes.get(requestBodyRouteKey(model))?.highWaterBytes ?? 0;
  if (highWater <= 0 || sentBytes <= highWater) return undefined;
  return highWater;
}

function isOversizedRefusal(normalized: NormalizedLLMError): boolean {
  if (normalized.facts.httpStatus === 413) return true;
  return normalized.facts.signals.has('request_too_large');
}

function isConnectionRefusal(normalized: NormalizedLLMError): boolean {
  return normalized.facts.signals.has('network') && !normalized.facts.timeout;
}

function parsedPayloadLimit(
  message: string | undefined,
): { announcedBytes: number; limitBytes: number } | undefined {
  if (!message) return undefined;
  const match = PAYLOAD_LIMIT_RE.exec(message);
  if (!match) return undefined;
  const announcedBytes = Number(match[1]);
  const limitBytes = Number(match[2]);
  if (!Number.isSafeInteger(announcedBytes) || !Number.isSafeInteger(limitBytes)) return undefined;
  if (announcedBytes <= 0 || limitBytes <= 0 || limitBytes >= announcedBytes) return undefined;
  return { announcedBytes, limitBytes };
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function persistRoutes(): void {
  if (!persistPath) return;
  try {
    mkdirSync(dirname(persistPath), { recursive: true });
    const routesJson: Record<string, RouteBodyMemory> = {};
    for (const [key, value] of routes) routesJson[key] = value;
    const payload = JSON.stringify({ routes: routesJson });
    const temporary = `${persistPath}.${process.pid}.tmp`;
    writeFileSync(temporary, payload);
    renameSync(temporary, persistPath);
  } catch {
    // The in-memory ceiling still applies for this process.
  }
}
