import type { WebSearchProviderResult } from './types.js';

const MAX_SNIPPET_CHARS = 240;

export function formatSearchResults(result: WebSearchProviderResult): string {
  const parts: string[] = [];
  if (result.answer?.trim()) {
    parts.push(result.answer.trim());
  }
  for (const [index, hit] of result.hits.entries()) {
    const lines = [`[${index + 1}] ${hit.title}`, `    ${hit.url}`];
    if (hit.snippet?.trim()) {
      lines.push(`    ${truncate(hit.snippet.trim(), MAX_SNIPPET_CHARS)}`);
    }
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}

export const MISSING_WEB_SEARCH_PROVIDER_MESSAGE =
  'No web search provider configured. Open /settings → Web search and add a Tavily, Exa, or DeepSeek API key.';

export function unavailableProviderMessage(label: string, _envKey: string): string {
  return `${label} web search is unavailable. Open /settings → Web search and set a ${label} API key.`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}
