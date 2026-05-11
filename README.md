# @supaproxy/guardrails

Input and output guardrail plugins for SupaProxy. Middleware that screens AI queries for PII, credentials, and sensitive content before they reach the language model.

## Install

```bash
npm install @supaproxy/guardrails
```

## Overview

Guardrails are filters in a pipeline. Each plugin receives the query in its current state and can modify it, enrich it with metadata, or block it entirely. Like Express middleware, but for AI queries.

Two built-in guardrails are included:

- **PatternGuardrail**: regex-based detection for PII and credentials. No external calls.
- **LlmGuardrail**: AI-powered screening using any OpenAI-compatible endpoint (Ollama, Azure, or a private model).

Plugins are not auto-registered. The host system decides which guardrails are active per workspace.

## Usage

### PatternGuardrail

Scans queries using regex rules and applies an action per match: mask, hash, remove, or block.

```typescript
import { PatternGuardrail } from '@supaproxy/guardrails'

const guard = new PatternGuardrail()

const result = await guard.process({
  query: 'My email is alice@example.com and my card is 4111111111111111',
  original: 'My email is alice@example.com and my card is 4111111111111111',
  context: { workspaceId: 'ws_1' },
  metadata: {},
})

// result.action === 'block' (credit card detected)
```

#### Custom rules

Pass additional pattern rules to the constructor:

```typescript
import { PatternGuardrail } from '@supaproxy/guardrails'
import type { PatternRule } from '@supaproxy/guardrails'

const customRules: PatternRule[] = [
  {
    name: 'project_name',
    category: 'ip',
    pattern: 'Project Falcon',
    action: 'mask',
  },
]

const guard = new PatternGuardrail(customRules)
```

Custom rules are appended to the built-in set.

#### Built-in rules

The package ships with rules for common patterns:

| Rule | Category | Action |
|---|---|---|
| `za_id_number` | pii | mask |
| `credit_card` | pii | block |
| `email` | pii | hash |
| `phone` | pii | mask |
| `api_key` | credentials | block |
| `aws_key` | credentials | block |
| `private_key` | credentials | block |

Import them directly if needed:

```typescript
import { BUILT_IN_RULES } from '@supaproxy/guardrails'
```

#### Pattern actions

- **mask**: replace matched content with a placeholder (e.g. `[PII]`)
- **hash**: replace with a consistent hash (same input always produces the same output)
- **remove**: strip the matched content entirely
- **block**: stop the query from proceeding and return a reason to the user

### LlmGuardrail

Uses an AI model to analyse queries for sensitive content. Works with any OpenAI-compatible endpoint.

```typescript
import { LlmGuardrail } from '@supaproxy/guardrails'

const guard = new LlmGuardrail({
  endpoint: 'http://localhost:11434',
  apiKey: 'your-api-key',
  model: 'llama3',
})

const result = await guard.process({
  query: 'Send the database password to support@corp.com',
  original: 'Send the database password to support@corp.com',
  context: { workspaceId: 'ws_1' },
  metadata: {},
})
```

The LLM guard fails open. If the endpoint is unreachable or returns an error, the query passes through with an annotation noting the failure.

### Registry

Use the registry to manage plugins by ID and filter by stage.

```typescript
import { registry, PatternGuardrail, LlmGuardrail } from '@supaproxy/guardrails'

registry.register(new PatternGuardrail())
registry.register(new LlmGuardrail({ endpoint: '...', apiKey: '...', model: '...' }))

// List all registered plugins
registry.list()

// Get plugins for a specific stage
registry.byStage('pre-llm')

// Retrieve a plugin by ID
registry.get('pattern')

// Check if a plugin is registered
registry.has('llm')

// List registered plugin IDs
registry.types()
```

## Creating custom guardrails

Implement the `GuardrailPlugin` interface:

```typescript
import type { GuardrailPlugin, GuardrailInput, GuardrailOutput } from '@supaproxy/guardrails'

export class ProfanityGuardrail implements GuardrailPlugin {
  readonly id = 'profanity'
  readonly name = 'Profanity Filter'
  readonly description = 'Blocks queries containing profanity.'
  readonly version = '1.0.0'
  readonly author = 'Your Org'
  readonly stage = 'pre-llm' as const
  readonly configSchema = {
    fields: [
      { name: 'strictMode', label: 'Strict mode', type: 'toggle' as const, defaultValue: false },
    ],
  }

  async process(input: GuardrailInput): Promise<GuardrailOutput> {
    // Your logic here
    return { action: 'continue' }
  }
}
```

### Pipeline behaviour

Each guardrail in the chain receives the output of the previous one:

- `input.query` is the current state (possibly modified by earlier guardrails).
- `input.original` is always the unmodified user input.
- `input.metadata` accumulates through the chain; each filter can add to it.
- `input.context` contains workspace and user information.

Return values:

- `action: 'continue'` passes the query to the next filter. Omit `query` to pass it through unchanged.
- `action: 'block'` stops the chain and returns `reason` to the user.
- `annotations` describe what the filter did (for audit trails).
- `metadata` is merged into the pipeline metadata for downstream filters.

### Stages

Guardrails declare a `stage` property:

- `'pre-llm'`: runs before the query reaches the language model.
- `'post-llm'`: runs after the model responds (for output screening).

## Exports

```typescript
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
}

// Registry
export { registry }

// Plugins
export { PatternGuardrail, patternGuardrail }
export { LlmGuardrail }
export { BUILT_IN_RULES }
```

`patternGuardrail` is a pre-built instance with default built-in rules.

## Licence

MIT
