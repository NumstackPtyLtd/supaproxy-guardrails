import type { PatternRule } from '../types.js'

/**
 * Built-in pattern rules.
 * These cover common PII and credential patterns.
 * Workspace-specific rules can be added via configuration.
 */
export const BUILT_IN_RULES: PatternRule[] = [
  // PII
  {
    name: 'za_id_number',
    category: 'pii',
    pattern: '\\b[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{7}\\b',
    flags: 'g',
    action: 'redact',
  },
  {
    name: 'credit_card',
    category: 'pii',
    pattern: '\\b(?:4\\d{12}(?:\\d{3})?|5[1-5]\\d{14}|3[47]\\d{13}|6(?:011|5\\d{2})\\d{12})\\b',
    flags: 'g',
    action: 'block',
  },
  {
    name: 'email',
    category: 'pii',
    pattern: '\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b',
    flags: 'g',
    action: 'redact',
  },
  {
    name: 'phone',
    category: 'pii',
    pattern: '\\b(?:\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{2,4}\\)?[-.\\s]?\\d{3,4}[-.\\s]?\\d{3,4}\\b',
    flags: 'g',
    action: 'redact',
  },

  // Credentials
  {
    name: 'api_key',
    category: 'credentials',
    pattern: '\\b(?:sk-|pk-|api[_-]?key[=:]\\s*|token[=:]\\s*|bearer\\s+)[a-zA-Z0-9_-]{20,}\\b',
    flags: 'gi',
    action: 'block',
  },
  {
    name: 'aws_key',
    category: 'credentials',
    pattern: '\\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\\b',
    flags: 'g',
    action: 'block',
  },
  {
    name: 'private_key',
    category: 'credentials',
    pattern: '-----BEGIN\\s+(RSA\\s+)?PRIVATE\\s+KEY-----',
    flags: 'g',
    action: 'block',
  },
]
