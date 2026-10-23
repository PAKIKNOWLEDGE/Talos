import { bindTool, type ToolImpl, type ToolResult } from '@mavis/agent-core/tools';

import { WebSearchToolDef, type WebSearchInput } from '../shared/web-search.js';
import type { LocalRuntimeToolContext, LocalWebSearchAdapter } from './types.js';

@bindTool(WebSearchToolDef)
export class LocalWebSearchTool implements ToolImpl<
  typeof WebSearchToolDef.schema,
  LocalRuntimeToolContext
> {
  constructor(private readonly adapter: LocalWebSearchAdapter) {}

  async execute(
    ctx: LocalRuntimeToolContext,
    input: WebSearchInput,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    try {
      if (signal?.aborted) throw new Error('Operation aborted');
      return await this.adapter.search(ctx, input, signal);
    } catch (error) {
      const text = `web_search failed: ${error instanceof Error ? error.message : String(error)}`;
      return {
        tool_name: WebSearchToolDef.name,
        text,
        content: [{ type: 'text' as const, text }],
        isError: true,
      };
    }
  }
}
