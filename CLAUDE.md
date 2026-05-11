# @supaproxy/guardrails

Input and output guardrail plugins for the SupaProxy ecosystem. Each guardrail is a middleware filter in a pipeline that processes AI queries before or after the LLM call. Guardrails can modify, enrich, or block queries based on pattern matching or AI-powered content screening.

See the [central hub](https://github.com/NumstackPtyLtd/supaproxy) for cross-repo governance, workflow, and conventions.

## Architecture

```
src/
├── types.ts              GuardrailPlugin, GuardrailInput, GuardrailOutput, PatternRule
├── registry.ts           GuardrailRegistry (register, get, list, byStage)
├── pattern/              Regex-based PII and credential detection
│   ├── index.ts          PatternGuardrail class + patternGuardrail instance
│   └── rules.ts          BUILT_IN_RULES (SA ID, credit card, email, phone, API keys, AWS keys)
├── llm/                  AI-powered content screening via OpenAI-compatible endpoint
│   └── index.ts          LlmGuardrail class
└── index.ts              Public exports (no auto-registration)
```

## Plugin pattern

Every guardrail implements the `GuardrailPlugin` interface:

- `id`, `name`, `description`, `version`, `author`, `stage` (pre-llm or post-llm)
- `configSchema` with fields the dashboard renders as a settings form
- `process(input)` returns `GuardrailOutput` with action continue or block

Plugins are NOT auto-registered. The host system decides which guardrails are active per workspace and registers them explicitly.

## Adding a new guardrail

1. Create `src/my-guard/index.ts` implementing `GuardrailPlugin`.
2. Export from `src/index.ts`.
3. The host system registers it via `registry.register()`.

## Build and test

```bash
pnpm install
pnpm build        # tsc --noEmit (source-only package)
pnpm test         # vitest run
```

## Publishing

```bash
pnpm build && pnpm test
# Version bump in package.json following semver
npm publish --access public
```

Published as `@supaproxy/guardrails` on npm. Current version: check package.json.

## Git workflow

- NEVER push directly to main. Always create a feature branch and open a PR.
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/` prefixes.
- NEVER run destructive git commands (`git push --force`, `git reset --hard`, `git clean -f`).
- Squash merge to main via GitHub UI.

## Code rules

- No `any` types. No `as any` casts. Define interfaces for all parameters and return values.
- No hardcoded provider names, model IDs, or URLs. The LLM guardrail accepts endpoint, apiKey, and model via config.
- No em dashes or en dashes. Use commas, full stops, or semicolons.
- British English throughout (colour, organisation, behaviour).
- Straight quotes only. Sentence case for headings.
- Each plugin is a class implementing `GuardrailPlugin`, not a plain object.
- Config schemas drive dashboard form rendering. Keep fields focused and well-documented.
- Pattern rules use the `PatternRule` interface with explicit action types (mask, hash, remove, block).
