import type { GuardrailPlugin, GuardrailInput, GuardrailOutput } from '../types.js'

interface LlmGuardrailConfig {
  endpoint: string
  apiKey: string
  model: string
}

const SYSTEM_PROMPT = `You are a data security middleware. Analyse the user query and determine what modifications are needed before it can be safely sent to a public AI model.

Respond in JSON with this exact structure:
{
  "action": "continue" | "block",
  "modifications": [
    { "find": "text to replace", "replace": "replacement text", "reason": "why" }
  ],
  "reason": "explanation if blocked",
  "annotations": ["what you did"]
}

If the query is safe, return action "continue" with empty modifications.
If you modify the query, return action "continue" with the modifications array.
If the query is too dangerous to modify safely, return action "block" with a reason.

Categories of concern:
- PII (names, IDs, addresses, health data)
- Credentials (API keys, passwords, tokens)
- IP (trade secrets, proprietary algorithms)
- Confidential (internal project names, unreleased details, financial data)`

export class LlmGuardrail implements GuardrailPlugin {
  readonly id = 'llm'
  readonly name = 'LLM Guard'
  readonly description = 'AI-powered content screening using any OpenAI-compatible endpoint. Point at Ollama, Azure, or a private model.'
  readonly version = '0.2.0'
  readonly author = 'SupaProxy'
  readonly stage = 'pre-llm' as const
  readonly configSchema = {
    fields: [
      { name: 'endpoint', label: 'Endpoint URL', type: 'text' as const, required: true, placeholder: 'http://localhost:11434', helpText: 'OpenAI-compatible API endpoint.' },
      { name: 'apiKey', label: 'API key', type: 'password' as const, required: true, placeholder: 'sk-...', helpText: 'API key for the endpoint.' },
      { name: 'model', label: 'Model', type: 'text' as const, required: true, placeholder: 'llama3', helpText: 'Model to use for screening.' },
    ],
  }

  private config: LlmGuardrailConfig

  constructor(config: LlmGuardrailConfig) {
    this.config = config
  }

  async process(input: GuardrailInput): Promise<GuardrailOutput> {
    try {
      const res = await fetch(`${this.config.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: input.query },
          ],
          max_tokens: 300,
          temperature: 0,
        }),
      })

      if (!res.ok) {
        return { action: 'continue', annotations: ['llm-guard:endpoint-error, failing open'] }
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const content = data.choices?.[0]?.message?.content || ''
      const parsed = JSON.parse(content) as {
        action: string
        modifications?: Array<{ find: string; replace: string; reason: string }>
        reason?: string
        annotations?: string[]
      }

      if (parsed.action === 'block') {
        return {
          action: 'block',
          reason: parsed.reason || 'Query blocked by AI screening.',
          annotations: parsed.annotations || ['llm-guard:blocked'],
        }
      }

      let query = input.query
      const annotations: string[] = []

      if (parsed.modifications && parsed.modifications.length > 0) {
        for (const mod of parsed.modifications) {
          query = query.replace(mod.find, mod.replace)
          annotations.push(`llm-modified:${mod.reason}`)
        }
      }

      if (query !== input.query) {
        return { action: 'continue', query, annotations }
      }

      return { action: 'continue', annotations: parsed.annotations || [] }
    } catch {
      return { action: 'continue', annotations: ['llm-guard:error, failing open'] }
    }
  }
}
