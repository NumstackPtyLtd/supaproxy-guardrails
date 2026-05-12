// Types
export type {
  GuardrailPlugin,
  GuardrailInput,
  GuardrailOutput,
  GuardrailStage,
  GuardrailContext,
  ConfigField,
  PatternRule,
  PatternAction,
} from './types.js'

// Registry (pre/post-LLM pipeline)
export { registry } from './registry.js'

// Plugins (pre/post-LLM pipeline)
export { PatternGuardrail, patternGuardrail } from './pattern/index.js'
export { LlmGuardrail } from './llm/index.js'
export { BUILT_IN_RULES } from './pattern/rules.js'

// Execution rails (tool call validation)
export type { ToolCallContext, ExecutionRailResult, ExecutionRailPlugin } from './execution/index.js'
export { ExecutionRailRegistry, WriteGuardRail } from './execution/index.js'

// Retrieval rails (tool output sanitisation)
export type { SanitiseResult, RetrievalRailPlugin } from './retrieval/index.js'
export { RetrievalRailRegistry, InjectionSanitiser, sanitiseToolOutput } from './retrieval/index.js'

// Plugins are NOT auto-registered. The host system decides which
// guardrails are active per workspace. Import and register explicitly.
