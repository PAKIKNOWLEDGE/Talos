/**
 * CloudGatewayClient — auto-mode LLM judge seam.
 *
 * Talos injects `LlmJudgeGatewayClient`, which calls the user-configured
 * judge model. MiniMax `/mavis/api/v1/permission/check` is not used.
 *
 * Prompt assembly and JSON parsing live in local-runtime's
 * `LlmJudgeGatewayClient`. Conversation context is rendered runtime-side
 * (see `conversation-renderer.ts`). A judge `deny`/`block` is mapped to
 * `confirm` so the permission card still asks the user and shows Why.
 *
 * Future-compatibility hooks:
 *   - `daemonPromptVersion` may identify the local judge prompt revision.
 *   - `suggestedRule` is reserved in the verdict shape. Today the judge
 *     never returns it and the daemon never persists from a gateway verdict.
 */

import type { ProposedRule } from './ask-policy.js';

/**
 * What the daemon hands to the gateway. All fields except the new
 * `daemonPromptVersion` map 1:1 to the existing payload.
 */
export interface CloudClassifyRequest {
  toolName: string;
  /** Serialized tool input (string), matching the `input` field. */
  input: string;
  platform: string;
  homeDir: string;
  workspaceRoot: string;
  /** Reserved for future modes; today always 'auto'. */
  mode: 'auto';
  /**
   * Daemon-rendered conversation context. Contains "## Recent User
   * Instructions" + "## Recent Conversation" sections built by the
   * conversation renderer. The LLM judge receives it in the user message.
   */
  conversationContext: string;
  agentId?: string;
  sessionId?: string;

  /**
   * Daemon's prompt revision identifier (hash of llm-gate-classifier.md).
   * Cloud may log this but does not consume it today. Always send.
   */
  daemonPromptVersion?: string;
}

/**
 * What the gateway hands back. `allow` runs the tool; `confirm`, `block`,
 * and `timeout` all become ask in the facade, with `reasonLocalized` shown
 * as Why on the permission card.
 */
export interface CloudClassifyVerdict {
  kind: 'allow' | 'confirm' | 'block' | 'timeout';
  /** Judge rationale, or a local fallback when the judge is missing or fails. */
  reasonLocalized: string;

  /**
   * Forward-compatible persistence hint. Today always undefined — the judge
   * never returns it and the daemon never persists from a gateway verdict.
   */
  suggestedRule?: ProposedRule;

  /** Telemetry — request id, response time. Optional. */
  serverRequestId?: string;
  durationMs?: number;

  /**
   * Telemetry — judge identifier (for example `judge:deepseek-chat`) or
   * `judge:unconfigured` when no judge is set.
   */
  model?: string;
}

/**
 * The injection seam. local-runtime provides `LlmJudgeGatewayClient`; tests
 * provide `InMemoryCloudGatewayClient`; an unconfigured or failed judge
 * returns `{ kind: 'timeout', ... }` so auto mode asks the user.
 */
export interface CloudGatewayClient {
  classify(req: CloudClassifyRequest): Promise<CloudClassifyVerdict>;
}
