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

// Registry
export { registry } from './registry.js'

// Plugins
export { PatternGuardrail, patternGuardrail } from './pattern/index.js'
export { LlmGuardrail } from './llm/index.js'
export { BUILT_IN_RULES } from './pattern/rules.js'

// Plugins are NOT auto-registered. The host system decides which
// guardrails are active per workspace. Import and register explicitly.
