export type GuardrailAction = 'pass' | 'redact' | 'block'

export type GuardrailStage = 'pre-llm' | 'post-llm'

export interface ScreeningResult {
  action: GuardrailAction
  source: string
  detectedCategories: string[]
  confidence: number
  sanitisedQuery?: string
  message?: string
  durationMs: number
}

export interface GuardrailContext {
  workspaceId: string
  userId?: string
  consumerType?: string
}

/**
 * GuardrailPlugin - the contract every guardrail must implement.
 *
 * Guardrails are pure functions: they receive a query and context,
 * and return a screening result. No infrastructure dependencies.
 * The server provides logging, storage, and event emission.
 */
export interface GuardrailPlugin {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly stage: GuardrailStage

  screen(query: string, context: GuardrailContext): Promise<ScreeningResult>
}

/**
 * Pattern rule for the PatternGuardrail.
 * Can be built-in or user-defined via workspace config.
 */
export interface PatternRule {
  name: string
  category: string
  pattern: string
  flags?: string
  action: 'redact' | 'block'
}
