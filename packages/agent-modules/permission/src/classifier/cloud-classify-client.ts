/**
 * Auto-mode classifier gating.
 *
 * MiniMax `POST /mavis/api/v1/permission/check` is removed. Auto mode uses the
 * host-injected LLM judge (`LlmJudgeGatewayClient`). The facade always consults
 * that client; an unconfigured judge fail-closes to ask.
 */

export function shouldUseCloudClassify(): boolean {
  return true;
}
