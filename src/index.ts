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
  DisplayFormat,
  DisplayField,
  EventActionType,
  EventAction,
  PluginSource,
} from './types.js'

// Registry (pre/post-LLM pipeline)
export { registry } from './registry.js'

// Catalogues (global discovery for all rail types)
export { executionCatalogue, retrievalCatalogue } from './catalogue.js'

// Icons
export { PII_FILTER_ICON } from './icons.js'

// Plugins (pre/post-LLM pipeline)
export { PatternGuardrail, patternGuardrail } from './pattern/index.js'
export { LlmGuardrail } from './llm/index.js'
export { BUILT_IN_RULES } from './pattern/rules.js'

// Execution rails (tool call validation)
export type { ToolCallContext, ExecutionRailResult, ExecutionRailPlugin, ExecutionRailEvent, ExecutionRailListener } from './execution/index.js'
export { ExecutionRailRegistry, WriteGuardRail } from './execution/index.js'

// Retrieval rails (tool output sanitisation)
export type { SanitiseResult, RetrievalRailPlugin, RetrievalRailEvent, RetrievalRailListener } from './retrieval/index.js'
export { RetrievalRailRegistry, InjectionSanitiser, sanitiseToolOutput } from './retrieval/index.js'

// ── Auto-register built-in plugins into catalogues ──
// Pipeline plugins
import { registry } from './registry.js'
import { PatternGuardrail } from './pattern/index.js'
registry.register(new PatternGuardrail())

// Execution rail plugins
import { executionCatalogue } from './catalogue.js'
import { WriteGuardRail } from './execution/index.js'
executionCatalogue.register(new WriteGuardRail())

// Retrieval rail plugins
import { retrievalCatalogue } from './catalogue.js'
import { InjectionSanitiser } from './retrieval/index.js'
retrievalCatalogue.register(new InjectionSanitiser())
