// Types
export type {
  GuardrailPlugin,
  GuardrailInput,
  GuardrailOutput,
  GuardrailStage,
  GuardrailContext,
  PatternRule,
  PatternAction,
} from './types.js'

// Registry
export { registry } from './registry.js'

// Plugins
export { PatternGuardrail, patternGuardrail } from './pattern/index.js'
export { LlmGuardrail } from './llm/index.js'
export { BUILT_IN_RULES } from './pattern/rules.js'

// Auto-register built-in plugins
import { registry } from './registry.js'
import { patternGuardrail } from './pattern/index.js'

registry.register(patternGuardrail)
