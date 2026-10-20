import {
  CUSTOM_PROVIDER_ID_PREFIX,
  MANAGED_MINIMAX_PROVIDER_ID,
  MINIMAX_API_PROVIDER_ID,
} from './model-availability.js';
import type { Config } from './config.js';
import type { PermissionJudgeApi, PermissionJudgeConfig } from './permission-config.js';

export interface ResolvedPermissionJudge {
  readonly api: PermissionJudgeApi;
  readonly baseURL: string;
  readonly apiKey: string;
  readonly model: string;
  readonly label: string;
  readonly source: PermissionJudgeConfig['source'];
}

export interface PermissionJudgeView {
  readonly configured: boolean;
  readonly source?: PermissionJudgeConfig['source'];
  readonly label: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly baseURL?: string;
  readonly model?: string;
  readonly api?: PermissionJudgeApi;
  readonly hasApiKey: boolean;
}

export function permissionJudgeView(config: Pick<Config, 'permission'>): PermissionJudgeView {
  const judge = config.permission?.judge;
  if (!judge) {
    return { configured: false, label: 'Not configured', hasApiKey: false };
  }
  if (judge.source === 'provider') {
    return {
      configured: true,
      source: 'provider',
      label: `${judge.providerId}/${judge.modelId}`,
      providerId: judge.providerId,
      modelId: judge.modelId,
      api: judge.api,
      hasApiKey: false,
    };
  }
  return {
    configured: true,
    source: 'manual',
    label: judge.model ?? 'manual',
    baseURL: judge.baseURL,
    model: judge.model,
    api: judge.api,
    hasApiKey: Boolean(judge.apiKey),
  };
}

export function resolvePermissionJudgeCredentials(
  config: Pick<Config, 'permission' | 'custom_provider' | 'minimax_api' | 'provider' | 'minimaxModelSource'>,
): ResolvedPermissionJudge | undefined {
  const judge = config.permission?.judge;
  if (!judge) return undefined;
  if (judge.source === 'manual') {
    if (!judge.baseURL || !judge.apiKey || !judge.model) return undefined;
    return {
      source: 'manual',
      api: judge.api ?? 'openai-completions',
      baseURL: judge.baseURL,
      apiKey: judge.apiKey,
      model: judge.model,
      label: judge.model,
    };
  }
  if (!judge.providerId || !judge.modelId) return undefined;
  if (judge.providerId === MANAGED_MINIMAX_PROVIDER_ID) return undefined;
  if (judge.providerId === MINIMAX_API_PROVIDER_ID) {
    const apiKey = config.minimax_api?.apiKey?.trim();
    const baseURL = config.minimax_api?.baseURL?.trim();
    if (!apiKey || !baseURL) return undefined;
    return {
      source: 'provider',
      api: judge.api ?? 'openai-completions',
      baseURL,
      apiKey,
      model: judge.modelId,
      label: `${MINIMAX_API_PROVIDER_ID}/${judge.modelId}`,
    };
  }
  if (judge.providerId.startsWith(CUSTOM_PROVIDER_ID_PREFIX)) {
    const key = judge.providerId.slice(CUSTOM_PROVIDER_ID_PREFIX.length);
    const provider = config.custom_provider?.[key];
    const apiKey = provider?.options?.apiKey?.trim();
    const baseURL = provider?.options?.baseURL?.trim();
    if (!provider || provider.kind === 'oauth' || provider.options?.authMode === 'oauth') {
      return undefined;
    }
    if (!apiKey || !baseURL) return undefined;
    const api = judge.api ?? judgeApiFromProvider(provider.api);
    return {
      source: 'provider',
      api,
      baseURL,
      apiKey,
      model: judge.modelId,
      label: `${provider.name ?? key}/${judge.modelId}`,
    };
  }
  const provider = config.provider?.[judge.providerId];
  const apiKey = provider?.options?.apiKey?.trim();
  const baseURL = provider?.options?.baseURL?.trim();
  if (!apiKey || !baseURL) return undefined;
  return {
    source: 'provider',
    api: judge.api ?? judgeApiFromProvider(provider.api),
    baseURL,
    apiKey,
    model: judge.modelId,
    label: `${provider.name ?? judge.providerId}/${judge.modelId}`,
  };
}

export function buildPermissionJudgeChatRequest(
  creds: ResolvedPermissionJudge,
  input: { readonly system: string; readonly user: string; readonly maxTokens: number },
): { readonly url: string; readonly headers: Record<string, string>; readonly body: string } {
  const base = creds.baseURL.replace(/\/+$/, '');
  if (creds.api === 'anthropic-messages') {
    return {
      url: base.endsWith('/messages') ? base : `${base}/v1/messages`,
      headers: {
        'content-type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: creds.model,
        max_tokens: input.maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
    };
  }
  return {
    url: base.endsWith('/chat/completions') ? base : `${base}/chat/completions`,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify({
      model: creds.model,
      max_tokens: input.maxTokens,
      temperature: 0,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
    }),
  };
}

export function readPermissionJudgeResponseText(
  api: PermissionJudgeApi,
  payload: unknown,
): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = payload as Record<string, unknown>;
  if (api === 'anthropic-messages') {
    return readTextParts(data.content);
  }
  const choices = data.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return undefined;
  const choice = choices[0] as { text?: unknown; message?: Record<string, unknown> };
  const message = choice.message;
  // Thinking models often leave `content` empty and put the JSON in reasoning.
  return (
    readTextParts(message?.content) ??
    readTextParts(choice.text) ??
    readTextParts(message?.reasoning_content) ??
    readTextParts(message?.reasoning)
  );
}

function readTextParts(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || undefined;
  }
  if (!Array.isArray(value)) return undefined;
  const text = value
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const rec = part as { type?: unknown; text?: unknown };
      return rec.type === 'text' || typeof rec.text === 'string' ? String(rec.text ?? '') : '';
    })
    .join('')
    .trim();
  return text || undefined;
}

export type PermissionJudgeDecision = 'allow' | 'ask';

export function parsePermissionJudgeDecision(text: string): {
  readonly decision: PermissionJudgeDecision;
  readonly reason: string;
} {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { decision?: unknown; reason?: unknown };
      const reason =
        typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim()
          : 'The judge did not give a reason.';
      const token = String(parsed.decision ?? '').trim().toLowerCase();
      if (token === 'allow') return { decision: 'allow', reason };
      if (token === 'ask' || token === 'confirm' || token === 'deny' || token === 'block') {
        return { decision: 'ask', reason };
      }
    } catch {
      // Fall through to the one-word parser.
    }
  }
  const word = text.trim().split(/\s+/)[0] ?? '';
  if (/^allow$/i.test(word)) return { decision: 'allow', reason: text.trim() };
  return {
    decision: 'ask',
    reason: text.trim() || 'The judge asked for confirmation.',
  };
}

function judgeApiFromProvider(api: string | undefined): PermissionJudgeApi {
  return api === 'anthropic-messages' ? 'anthropic-messages' : 'openai-completions';
}

export async function testPermissionJudgeCredentials(
  creds: ResolvedPermissionJudge,
  options: { readonly timeoutMs?: number; readonly fetchImpl?: typeof fetch } = {},
): Promise<{ readonly ok: boolean; readonly message: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const request = buildPermissionJudgeChatRequest(creds, {
    system: 'Reply with STRICT JSON only: {"decision":"ask","reason":"ping"}.',
    user: 'ping',
    maxTokens: 1024,
  });
  try {
    const response = await fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const raw = await response.text();
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}: ${raw.slice(0, 180)}` };
    }
    return { ok: true, message: `Judge responded (${creds.label}).` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
