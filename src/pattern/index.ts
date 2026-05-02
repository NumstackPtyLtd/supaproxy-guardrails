import type { GuardrailPlugin, ScreeningResult, GuardrailContext, PatternRule } from '../types.js'
import { BUILT_IN_RULES } from './rules.js'

export class PatternGuardrail implements GuardrailPlugin {
  readonly id = 'pattern'
  readonly name = 'Pattern Guard'
  readonly description = 'Regex and token matching for PII, credentials, and custom patterns. No external calls.'
  readonly stage = 'pre-llm' as const

  private readonly compiledRules: Array<{ rule: PatternRule; regex: RegExp }>

  constructor(customRules?: PatternRule[]) {
    const allRules = [...BUILT_IN_RULES, ...(customRules || [])]
    this.compiledRules = allRules.map(rule => ({
      rule,
      regex: new RegExp(rule.pattern, rule.flags || 'g'),
    }))
  }

  async screen(query: string, _context: GuardrailContext): Promise<ScreeningResult> {
    const start = Date.now()
    const detectedCategories: string[] = []
    let sanitised = query
    let shouldBlock = false
    let blockMessage: string | undefined

    for (const { rule, regex } of this.compiledRules) {
      regex.lastIndex = 0
      const matches = query.match(regex)

      if (matches && matches.length > 0) {
        if (!detectedCategories.includes(rule.category)) {
          detectedCategories.push(rule.category)
        }

        if (rule.action === 'block') {
          shouldBlock = true
          blockMessage = `This query was blocked because it contains ${rule.category} (${rule.name}). Please remove sensitive information and try again.`
          break
        }

        if (rule.action === 'redact') {
          const freshRegex = new RegExp(rule.pattern, rule.flags || 'g')
          sanitised = sanitised.replace(freshRegex, `[REDACTED:${rule.category}]`)
        }
      }
    }

    const durationMs = Date.now() - start

    if (shouldBlock) {
      return { action: 'block', source: this.id, detectedCategories, confidence: 1, message: blockMessage, durationMs }
    }

    if (sanitised !== query) {
      return { action: 'redact', source: this.id, detectedCategories, confidence: 1, sanitisedQuery: sanitised, durationMs }
    }

    return { action: 'pass', source: this.id, detectedCategories: [], confidence: 1, durationMs }
  }
}

export const patternGuardrail = new PatternGuardrail()
