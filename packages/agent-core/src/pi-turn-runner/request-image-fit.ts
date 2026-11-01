import { createHash } from 'node:crypto';

import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

import { imageDimensions } from './image-dimensions.js';

/**
 * Outbound-copy bounds for one image. These are not a gateway body cap: they
 * stop a single screenshot from being re-inlined at its original size on every
 * later turn. The whole-request cap, when there is one, comes from the model
 * or from the size this route last sent successfully.
 */
export const DEFAULT_REQUEST_IMAGE_MAX_EDGE_PX = 2048;
export const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;

const JPEG_QUALITIES = [82, 72, 62, 52] as const;
const MIN_IMAGE_EDGE_PX = 512;
/** Skip pixel decode past this; the byte budget can still drop the whole block. */
const MAX_DECODE_PIXELS = 24_000_000;
const FIT_CACHE_LIMIT = 64;

interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface RequestImageFitBudget {
  readonly maxEdgePx?: number;
  readonly maxBytes?: number;
}

interface FittedImage {
  readonly data: string;
  readonly mimeType: string;
}

const fitCache = new Map<string, FittedImage>();

/** Drop cached encodings. Tests use this so a budget change cannot reuse a prior fit. */
export function resetRequestImageFitCacheForTests(): void {
  fitCache.clear();
}

/**
 * Return a smaller JPEG for one outbound image, or the original block fields
 * when the image is already inside the budget or cannot be decoded.
 * The returned data is raw base64, never a data URL.
 */
export function fitRequestImage(
  data: string,
  mimeType: string,
  budget?: RequestImageFitBudget,
): FittedImage {
  const maxEdgePx = positive(budget?.maxEdgePx, DEFAULT_REQUEST_IMAGE_MAX_EDGE_PX);
  const maxBytes = positive(budget?.maxBytes, DEFAULT_REQUEST_IMAGE_MAX_BYTES);
  const estimatedBytes = Math.floor((data.length * 3) / 4);
  const size = imageDimensions(data, mimeType);
  if (!size) return { data, mimeType };
  if (size.width * size.height > MAX_DECODE_PIXELS) return { data, mimeType };
  if (Math.max(size.width, size.height) <= maxEdgePx && estimatedBytes <= maxBytes) {
    return { data, mimeType };
  }

  const key = fitCacheKey(data, maxEdgePx, maxBytes);
  const cached = fitCache.get(key);
  if (cached) return cached;

  const fitted = encodeFittedImage(data, maxEdgePx, maxBytes) ?? { data, mimeType };
  fitCache.set(key, fitted);
  if (fitCache.size > FIT_CACHE_LIMIT) {
    const oldest = fitCache.keys().next().value;
    if (oldest !== undefined) fitCache.delete(oldest);
  }
  return fitted;
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function fitCacheKey(data: string, maxEdgePx: number, maxBytes: number): string {
  return `${maxEdgePx}:${maxBytes}:${createHash('sha256').update(data).digest('base64url')}`;
}

function encodeFittedImage(data: string, maxEdgePx: number, maxBytes: number): FittedImage | undefined {
  let decoded: RgbaImage;
  try {
    const buffer = Buffer.from(data, 'base64');
    const image = decodeImage(buffer);
    if (!image) return undefined;
    const target = targetSize(image.width, image.height, maxEdgePx);
    decoded = resizeAndFlattenToWhite(image, target.width, target.height);
  } catch {
    return undefined;
  }
  const encoded = encodeJpegWithinLimit(decoded, maxBytes);
  if (!encoded) return undefined;
  return { data: encoded.toString('base64'), mimeType: 'image/jpeg' };
}

function decodeImage(buffer: Buffer): RgbaImage | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    if (!decoded.width || !decoded.height) return undefined;
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const decoded = PNG.sync.read(buffer);
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  return undefined;
}

function targetSize(
  width: number,
  height: number,
  maxEdgePx: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdgePx) return { width, height };
  const scale = maxEdgePx / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function resizeAndFlattenToWhite(source: RgbaImage, width: number, height: number): RgbaImage {
  if (source.width === width && source.height === height) {
    return flattenToWhite(source);
  }
  const out = Buffer.alloc(width * height * 4);
  const xScale = source.width / width;
  const yScale = source.height / height;
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(source.height - 1, Math.max(0, Math.floor((y + 0.5) * yScale)));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.max(0, Math.floor((x + 0.5) * xScale)));
      const from = (sy * source.width + sx) * 4;
      const to = (y * width + x) * 4;
      const alpha = source.data[from + 3] ?? 255;
      out[to] = Math.round((((source.data[from] ?? 0) * alpha) + 255 * (255 - alpha)) / 255);
      out[to + 1] = Math.round(
        (((source.data[from + 1] ?? 0) * alpha) + 255 * (255 - alpha)) / 255,
      );
      out[to + 2] = Math.round(
        (((source.data[from + 2] ?? 0) * alpha) + 255 * (255 - alpha)) / 255,
      );
      out[to + 3] = 255;
    }
  }
  return { width, height, data: out };
}

function flattenToWhite(source: RgbaImage): RgbaImage {
  const out = Buffer.alloc(source.width * source.height * 4);
  for (let index = 0; index < out.length; index += 4) {
    const alpha = source.data[index + 3] ?? 255;
    out[index] = Math.round((((source.data[index] ?? 0) * alpha) + 255 * (255 - alpha)) / 255);
    out[index + 1] = Math.round(
      (((source.data[index + 1] ?? 0) * alpha) + 255 * (255 - alpha)) / 255,
    );
    out[index + 2] = Math.round(
      (((source.data[index + 2] ?? 0) * alpha) + 255 * (255 - alpha)) / 255,
    );
    out[index + 3] = 255;
  }
  return { width: source.width, height: source.height, data: out };
}

function encodeJpegWithinLimit(image: RgbaImage, maxBytes: number): Buffer | undefined {
  let current = image;
  let smallest: Buffer | undefined;
  for (;;) {
    for (const quality of JPEG_QUALITIES) {
      const encoded = jpeg.encode(
        { data: current.data, width: current.width, height: current.height },
        quality,
      ).data;
      if (!smallest || encoded.length < smallest.length) smallest = encoded;
      if (encoded.length <= maxBytes) return encoded;
    }
    const longEdge = Math.max(current.width, current.height);
    if (!smallest || longEdge <= MIN_IMAGE_EDGE_PX) {
      return smallest && smallest.length <= maxBytes ? smallest : undefined;
    }
    const ratio = Math.max(0.5, Math.sqrt(maxBytes / smallest.length) * 0.95);
    current = resizeAndFlattenToWhite(
      current,
      Math.max(1, Math.round(current.width * ratio)),
      Math.max(1, Math.round(current.height * ratio)),
    );
  }
}
