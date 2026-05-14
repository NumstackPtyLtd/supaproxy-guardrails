import { describe, it, expect } from 'vitest'
import { PatternGuardrail, patternGuardrail } from './index.js'
import { BUILT_IN_RULES } from './rules.js'
import { LlmGuardrail } from '../llm/index.js'
import { registry } from '../registry.js'
import type { GuardrailInput, PatternRule, GuardrailPlugin } from '../types.js'

// ── Helpers ──

function makeInput(query: string): GuardrailInput {
  return {
    query,
    original: query,
    context: { workspaceId: 'ws-1' },
    metadata: {},
  }
}

// ── PatternGuardrail: built-in rules ──

describe('PatternGuardrail', () => {
  describe('built-in PII detection', () => {
    it('masks South African ID numbers', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('My ID is 9201015800081'))
      expect(result.action).toBe('continue')
      expect(result.query).toBeDefined()
      expect(result.query).not.toContain('9201015800081')
      expect(result.query).toContain('[PII]')
      expect(result.annotations).toContain('masked:za_id_number')
    })

    it('blocks credit card numbers', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('My card is 4111111111111111'))
      expect(result.action).toBe('block')
      expect(result.reason).toBeDefined()
      expect(result.annotations).toEqual(expect.arrayContaining([expect.stringContaining('blocked:credit_card')]))
    })

    it('hashes email addresses', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('Contact me at test@example.com'))
      expect(result.action).toBe('continue')
      expect(result.query).toBeDefined()
      expect(result.query).not.toContain('test@example.com')
      expect(result.query).toContain('[hash:')
      expect(result.annotations).toContain('hashed:email')
    })

    it('produces consistent hashes for the same email', async () => {
      const guard = new PatternGuardrail()
      const r1 = await guard.process(makeInput('Email: user@test.com'))
      const r2 = await guard.process(makeInput('Email: user@test.com'))
      expect(r1.query).toBe(r2.query)
    })

    it('masks phone numbers', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('Call me at +27 81 398 3478'))
      expect(result.action).toBe('continue')
      expect(result.query).toBeDefined()
      expect(result.query).not.toContain('+27 81 398 3478')
      expect(result.annotations).toContain('masked:phone')
    })

    it('blocks API keys', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('My key is sk-abcdefghijklmnopqrstuvwxyz12345'))
      expect(result.action).toBe('block')
      expect(result.reason).toBeDefined()
      expect(result.annotations).toEqual(expect.arrayContaining([expect.stringContaining('blocked:api_key')]))
    })

    it('blocks AWS access keys', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('Access key: AKIAIOSFODNN7EXAMPLE'))
      expect(result.action).toBe('block')
      expect(result.annotations).toEqual(expect.arrayContaining([expect.stringContaining('blocked:aws_key')]))
    })

    it('blocks private keys', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('-----BEGIN PRIVATE KEY----- some data'))
      expect(result.action).toBe('block')
      expect(result.annotations).toEqual(expect.arrayContaining([expect.stringContaining('blocked:private_key')]))
    })

    it('blocks RSA private keys', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('-----BEGIN RSA PRIVATE KEY----- data'))
      expect(result.action).toBe('block')
      expect(result.annotations).toEqual(expect.arrayContaining([expect.stringContaining('blocked:private_key')]))
    })
  })

  describe('actions', () => {
    it('block action stops chain and returns reason', async () => {
      const rules: PatternRule[] = [
        { name: 'test_block', category: 'test', pattern: 'forbidden', action: 'block' },
      ]
      const guard = new PatternGuardrail(rules)
      const result = await guard.process(makeInput('this is forbidden content'))
      expect(result.action).toBe('block')
      expect(result.reason).toBeDefined()
      expect(result.query).toBeUndefined()
    })

    it('block action uses custom replacement as reason', async () => {
      const rules: PatternRule[] = [
        { name: 'custom_block', category: 'test', pattern: 'secret', action: 'block', replacement: 'Custom block reason.' },
      ]
      const guard = new PatternGuardrail(rules)
      const result = await guard.process(makeInput('this is secret'))
      expect(result.action).toBe('block')
      expect(result.reason).toBe('Custom block reason.')
    })

    it('mask action replaces match with category placeholder', async () => {
      const rules: PatternRule[] = [
        { name: 'test_mask', category: 'sensitive', pattern: 'password123', action: 'mask' },
      ]
      const guard = new PatternGuardrail(rules)
      const result = await guard.process(makeInput('My pass is password123'))
      expect(result.action).toBe('continue')
      expect(result.query).toBe('My pass is [SENSITIVE]')
      expect(result.annotations).toContain('masked:test_mask')
    })

    it('mask action uses custom replacement when provided', async () => {
      const rules: PatternRule[] = [
        { name: 'test_mask_custom', category: 'data', pattern: 'internal', action: 'mask', replacement: '***' },
      ]
      const guard = new PatternGuardrail(rules)
      const result = await guard.process(makeInput('this is internal data'))
      expect(result.action).toBe('continue')
      expect(result.query).toBe('this is *** data')
    })

    it('hash action replaces match with consistent hash', async () => {
      const rules: PatternRule[] = [
        { name: 'test_hash', category: 'pii', pattern: 'JohnDoe', action: 'hash' },
      ]
      const guard = new PatternGuardrail(rules)
      const result = await guard.process(makeInput('Name: JohnDoe'))
      expect(result.action).toBe('continue')
      expect(result.query).not.toContain('JohnDoe')
      expect(result.query).toMatch(/\[hash:[a-z0-9]+\]/)
      expect(result.annotations).toContain('hashed:test_hash')
    })

    it('remove action strips match entirely', async () => {
      const rules: PatternRule[] = [
        { name: 'test_remove', category: 'noise', pattern: 'REMOVE_ME', action: 'remove' },
      ]
      const guard = new PatternGuardrail(rules)
      const result = await guard.process(makeInput('before REMOVE_ME after'))
      expect(result.action).toBe('continue')
      expect(result.query).toBe('before  after')
      expect(result.annotations).toContain('removed:test_remove')
    })
  })

  describe('custom rules', () => {
    it('applies custom rules alongside built-in rules', async () => {
      const customRules: PatternRule[] = [
        { name: 'project_name', category: 'ip', pattern: 'Project Falcon', flags: 'gi', action: 'mask' },
      ]
      const guard = new PatternGuardrail(customRules)
      const result = await guard.process(makeInput('Working on Project Falcon now'))
      expect(result.action).toBe('continue')
      expect(result.query).not.toContain('Project Falcon')
      expect(result.query).toContain('[IP]')
      expect(result.annotations).toContain('masked:project_name')
    })

    it('custom block rule takes precedence over modify rules', async () => {
      const customRules: PatternRule[] = [
        { name: 'nuclear', category: 'dangerous', pattern: 'launch_codes', action: 'block' },
      ]
      const guard = new PatternGuardrail(customRules)
      const result = await guard.process(makeInput('Here are the launch_codes'))
      expect(result.action).toBe('block')
    })

    it('multiple custom rules process in order', async () => {
      const customRules: PatternRule[] = [
        { name: 'rule_a', category: 'a', pattern: 'alpha', action: 'mask' },
        { name: 'rule_b', category: 'b', pattern: 'beta', action: 'remove' },
      ]
      const guard = new PatternGuardrail(customRules)
      const result = await guard.process(makeInput('alpha and beta'))
      expect(result.action).toBe('continue')
      expect(result.query).toContain('[A]')
      expect(result.query).not.toContain('beta')
    })
  })

  describe('passthrough behaviour', () => {
    it('passes clean queries through unchanged', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput('What is the weather today?'))
      expect(result.action).toBe('continue')
      expect(result.query).toBeUndefined()
      expect(result.annotations).toEqual([])
    })

    it('empty query passes through', async () => {
      const guard = new PatternGuardrail()
      const result = await guard.process(makeInput(''))
      expect(result.action).toBe('continue')
      expect(result.query).toBeUndefined()
    })
  })

  describe('plugin contract', () => {
    it('has correct plugin metadata', () => {
      const guard = new PatternGuardrail()
      expect(guard.id).toBe('@supaproxy/guardrails:pattern')
      expect(guard.name).toBe('Pattern Guard')
      expect(guard.stage).toBe('pre-llm')
      expect(guard.version).toBeDefined()
      expect(guard.author).toBe('SupaProxy')
      expect(guard.configSchema.fields.length).toBeGreaterThan(0)
    })

    it('exported singleton is a PatternGuardrail', () => {
      expect(patternGuardrail).toBeInstanceOf(PatternGuardrail)
      expect(patternGuardrail.id).toBe('@supaproxy/guardrails:pattern')
    })
  })

  describe('multiple matches in one query', () => {
    it('masks multiple occurrences', async () => {
      const rules: PatternRule[] = [
        { name: 'word', category: 'redacted', pattern: 'secret', flags: 'g', action: 'mask' },
      ]
      const guard = new PatternGuardrail(rules)
      const result = await guard.process(makeInput('first secret and second secret'))
      expect(result.action).toBe('continue')
      expect(result.query).toBe('first [REDACTED] and second [REDACTED]')
    })
  })
})

// ── Built-in rules sanity ──

describe('BUILT_IN_RULES', () => {
  it('has rules for PII and credentials categories', () => {
    const categories = [...new Set(BUILT_IN_RULES.map(r => r.category))]
    expect(categories).toContain('pii')
    expect(categories).toContain('credentials')
  })

  it('every rule has valid fields', () => {
    for (const rule of BUILT_IN_RULES) {
      expect(rule.name).toBeTruthy()
      expect(rule.category).toBeTruthy()
      expect(rule.pattern).toBeTruthy()
      expect(['mask', 'hash', 'remove', 'block']).toContain(rule.action)
      // Pattern must compile without error
      expect(() => new RegExp(rule.pattern, rule.flags || 'g')).not.toThrow()
    }
  })
})

// ── LlmGuardrail ──

describe('LlmGuardrail', () => {
  it('has correct plugin metadata', () => {
    const guard = new LlmGuardrail({ endpoint: 'http://localhost:11434', apiKey: 'test', model: 'llama3' })
    expect(guard.id).toBe('@supaproxy/guardrails:llm')
    expect(guard.name).toBe('LLM Guard')
    expect(guard.stage).toBe('pre-llm')
    expect(guard.version).toBeDefined()
    expect(guard.author).toBe('SupaProxy')
    expect(guard.configSchema.fields.length).toBe(3)
  })

  it('config schema has endpoint, apiKey, model fields', () => {
    const guard = new LlmGuardrail({ endpoint: 'http://test', apiKey: 'k', model: 'm' })
    const names = guard.configSchema.fields.map(f => f.name)
    expect(names).toContain('endpoint')
    expect(names).toContain('apiKey')
    expect(names).toContain('model')
  })

  it('fails open when endpoint is unreachable', async () => {
    const guard = new LlmGuardrail({ endpoint: 'http://localhost:1', apiKey: 'test', model: 'test' })
    const result = await guard.process(makeInput('Hello'))
    expect(result.action).toBe('continue')
    expect(result.annotations).toEqual(expect.arrayContaining([expect.stringContaining('error')]))
  })
})

// ── Registry ──

describe('GuardrailRegistry', () => {
  it('starts empty', () => {
    expect(registry.list()).toEqual([])
    expect(registry.types()).toEqual([])
  })

  it('registers and retrieves a plugin', () => {
    const plugin: GuardrailPlugin = {
      id: 'test-guardrail',
      name: 'Test',
      description: 'desc',
      version: '1.0.0',
      author: 'test',
      stage: 'pre-llm',
      configSchema: { fields: [] },
      process: async () => ({ action: 'continue' }),
    }
    registry.register(plugin)
    expect(registry.has('test-guardrail')).toBe(true)
    expect(registry.get('test-guardrail')).toBe(plugin)
  })

  it('throws on unknown plugin', () => {
    expect(() => registry.get('nonexistent')).toThrow('Guardrail plugin not found: nonexistent')
  })

  it('lists registered plugins', () => {
    const plugins = registry.list()
    expect(plugins.length).toBeGreaterThanOrEqual(1)
  })

  it('types() returns registered IDs', () => {
    expect(registry.types()).toContain('test-guardrail')
  })

  it('byStage filters plugins', () => {
    const preLlm = registry.byStage('pre-llm')
    expect(preLlm.length).toBeGreaterThanOrEqual(1)
    const postLlm = registry.byStage('post-llm')
    expect(postLlm.every(p => p.stage === 'post-llm')).toBe(true)
  })

  it('replaces plugin with same ID', () => {
    const plugin2: GuardrailPlugin = {
      id: 'test-guardrail',
      name: 'Test v2',
      description: 'desc',
      version: '2.0.0',
      author: 'test',
      stage: 'pre-llm',
      configSchema: { fields: [] },
      process: async () => ({ action: 'continue' }),
    }
    registry.register(plugin2)
    expect(registry.get('test-guardrail').name).toBe('Test v2')
  })
})
