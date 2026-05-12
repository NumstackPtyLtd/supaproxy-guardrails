export type GuardrailStage = 'pre-llm' | 'post-llm' | 'execution' | 'retrieval'

/**
 * What the guardrail receives.
 *
 * Each guardrail in the chain receives the output of the previous one.
 * `query` is the current state. `original` is always the unmodified input.
 * `metadata` accumulates through the chain, each filter can add to it.
 */
export interface GuardrailInput {
  query: string
  original: string
  context: GuardrailContext
  metadata: Record<string, unknown>
}

/**
 * What the guardrail returns.
 *
 * - action 'continue': pass the query to the next filter (optionally modified)
 * - action 'block': stop the chain, return reason to user
 *
 * If `query` is omitted on continue, the input query passes through unchanged.
 * `metadata` is merged into the pipeline metadata for downstream filters.
 * `annotations` describe what this filter did (for the audit trail).
 */
export interface GuardrailOutput {
  action: 'continue' | 'block'
  query?: string
  metadata?: Record<string, unknown>
  reason?: string
  annotations?: string[]
}

export interface GuardrailContext {
  workspaceId: string
  userId?: string
  consumerType?: string
}

/**
 * GuardrailPlugin - middleware for AI queries.
 *
 * Each plugin is a filter in the pipeline. It receives the query in its
 * current state and can modify it, replace it, enrich it with metadata,
 * or block it entirely. Like Express middleware, but for AI queries.
 *
 * Zero infrastructure dependencies. Pure logic. The server provides
 * logging, storage, and event emission.
 */
/**
 * Configuration field that the dashboard renders as a form input.
 * The package declares what config it needs. The dashboard renders it.
 */
export interface ConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'select' | 'toggle' | 'textarea' | 'number'
  required?: boolean
  placeholder?: string
  helpText?: string
  options?: Array<{ value: string; label: string }>
  defaultValue?: string | boolean | number
}

export interface GuardrailPlugin {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly author: string
  readonly stage: GuardrailStage

  /** Config schema for the dashboard settings UI. */
  readonly configSchema: { fields: ConfigField[] }

  process(input: GuardrailInput): Promise<GuardrailOutput>
}

/**
 * Pattern rule for the PatternGuardrail.
 * Can be built-in or user-defined via workspace config.
 *
 * Actions:
 * - 'mask': replace matched content with a placeholder
 * - 'hash': replace with a consistent hash (same input = same output)
 * - 'remove': strip the matched content entirely
 * - 'block': stop the query from proceeding
 */
export type PatternAction = 'mask' | 'hash' | 'remove' | 'block'

export interface PatternRule {
  name: string
  category: string
  pattern: string
  flags?: string
  action: PatternAction
  replacement?: string
}
