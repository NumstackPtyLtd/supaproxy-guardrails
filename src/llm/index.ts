import type { GuardrailPlugin, ScreeningResult, GuardrailContext, GuardrailAction } from '../types.js'

interface LlmGuardrailConfig {
  /** OpenAI-compatible endpoint URL */
  endpoint: string
  /** API key for the endpoint */
  apiKey: string
  /** Model to use for screening */
  model: string
}

const SYSTEM_PROMPT = `You are a data security classifier. Analyse the user query and determine if it contains sensitive information that should not be sent to a public AI model.

Respond in JSON with this exact structure:
{
  "action": "pass" | "redact" | "block",
  "categories": ["pii", "credentials", "ip", "confidential"],
  "confidence": 0.0 to 1.0,
  "explanation": "brief reason"
}

Categories:
- pii: personal identifiable information (names, IDs, addresses, health data)
- credentials: API keys, passwords, tokens, private keys
- ip: intellectual property, trade secrets, proprietary algorithms
- confidential: internal project names, unreleased product details, financial data

Rules:
- block: high-confidence credentials or highly sensitive data
- redact: PII that can be masked without losing query usefulness
- pass: no sensitive content detected`

export class LlmGuardrail implements GuardrailPlugin {
  readonly id = 'llm'
  readonly name = 'LLM Guard'
  readonly description = 'AI-powered content classification using any OpenAI-compatible endpoint. Point at Ollama, Azure, or a private model.'
  readonly stage = 'pre-llm' as const

  private config: LlmGuardrailConfig

  constructor(config: LlmGuardrailConfig) {
    this.config = config
  }

  async screen(query: string, _context: GuardrailContext): Promise<ScreeningResult> {
    const start = Date.now()

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
            { role: 'user', content: query },
          ],
          max_tokens: 200,
          temperature: 0,
        }),
      })

      if (!res.ok) {
        return { action: 'pass', source: this.id, detectedCategories: [], confidence: 0, durationMs: Date.now() - start }
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const content = data.choices?.[0]?.message?.content || ''
      const parsed = JSON.parse(content) as { action: string; categories: string[]; confidence: number; explanation: string }

      const action = (['pass', 'redact', 'block'].includes(parsed.action) ? parsed.action : 'pass') as GuardrailAction

      return {
        action,
        source: this.id,
        detectedCategories: parsed.categories || [],
        confidence: parsed.confidence || 0,
        message: action === 'block' ? (parsed.explanation || 'Query blocked by AI screening.') : undefined,
        durationMs: Date.now() - start,
      }
    } catch {
      // If the LLM guardrail fails, fail open (pass) so the query isn't silently blocked
      return { action: 'pass', source: this.id, detectedCategories: [], confidence: 0, durationMs: Date.now() - start }
    }
  }
}
