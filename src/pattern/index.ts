import type { GuardrailPlugin, GuardrailInput, GuardrailOutput, PatternRule } from '../types.js'
import { BUILT_IN_RULES } from './rules.js'

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36).padStart(8, '0')
}

export class PatternGuardrail implements GuardrailPlugin {
  readonly id = 'pattern-guard'
  readonly name = 'Pattern Guard'
  readonly description = 'Regex and token matching for PII, credentials, and custom patterns. No external calls.'
  readonly version = '0.2.0'
  readonly author = 'SupaProxy'
  readonly stage = 'pre-llm' as const
  readonly configSchema = {
    fields: [
      { name: 'enablePii', label: 'Detect PII', type: 'toggle' as const, helpText: 'Mask ID numbers, phone numbers, and similar personal data.', defaultValue: true },
      { name: 'enableCredentials', label: 'Detect credentials', type: 'toggle' as const, helpText: 'Block API keys, AWS keys, and private keys.', defaultValue: true },
      { name: 'emailAction', label: 'Email handling', type: 'select' as const, helpText: 'What to do when an email address is detected.', options: [{ value: 'hash', label: 'Hash (consistent, reversible)' }, { value: 'mask', label: 'Mask (replace with placeholder)' }, { value: 'remove', label: 'Remove entirely' }, { value: 'block', label: 'Block the query' }], defaultValue: 'hash' },
      { name: 'customPatterns', label: 'Custom patterns', type: 'textarea' as const, helpText: 'One pattern per line. Format: name|category|regex|action. Example: project_name|ip|Project Falcon|mask', placeholder: 'project_name|ip|Project Falcon|mask' },
    ],
  }

  private readonly compiledRules: Array<{ rule: PatternRule; regex: RegExp }>

  constructor(customRules?: PatternRule[]) {
    const allRules = [...BUILT_IN_RULES, ...(customRules || [])]
    this.compiledRules = allRules.map(rule => ({
      rule,
      regex: new RegExp(rule.pattern, rule.flags || 'g'),
    }))
  }

  async process(input: GuardrailInput): Promise<GuardrailOutput> {
    let query = input.query
    const annotations: string[] = []

    for (const { rule, regex } of this.compiledRules) {
      regex.lastIndex = 0
      const matches = input.query.match(regex)

      if (matches && matches.length > 0) {
        if (rule.action === 'block') {
          return {
            action: 'block',
            reason: rule.replacement || `This query was blocked because it contains ${rule.category} (${rule.name}). Please remove sensitive information and try again.`,
            annotations: [...annotations, `blocked:${rule.name}`],
          }
        }

        const freshRegex = new RegExp(rule.pattern, rule.flags || 'g')

        if (rule.action === 'mask') {
          const placeholder = rule.replacement || `[${rule.category.toUpperCase()}]`
          query = query.replace(freshRegex, placeholder)
          annotations.push(`masked:${rule.name}`)
        }

        if (rule.action === 'hash') {
          query = query.replace(freshRegex, (match) => `[hash:${simpleHash(match)}]`)
          annotations.push(`hashed:${rule.name}`)
        }

        if (rule.action === 'remove') {
          query = query.replace(freshRegex, '')
          annotations.push(`removed:${rule.name}`)
        }
      }
    }

    if (query !== input.query) {
      return { action: 'continue', query, annotations }
    }

    return { action: 'continue', annotations }
  }
}

export const patternGuardrail = new PatternGuardrail()
