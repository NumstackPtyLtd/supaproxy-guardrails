/**
 * Retrieval rail: sanitises external content before feeding to the LLM.
 *
 * When MCP tools return content from external sources (web pages,
 * documents, APIs), that content could contain indirect injection
 * payloads. This rail strips them.
 */

const INJECTION_PATTERNS_IN_CONTENT = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?(previous\s+)?rules/gi,
  /override\s+compliance/gi,
  /system\s*:\s*you\s+are/gi,
  /you\s+are\s+now\s+unrestricted/gi,
  /bypass\s+(all\s+)?safety/gi,
  /forget\s+(your\s+)?rules/gi,
  /act\s+as\s+if\s+no\s+rules/gi,
  /pretend\s+(there\s+are\s+)?no\s+restrictions/gi,
]

// HTML/markdown hidden injection patterns
const HIDDEN_INJECTION_PATTERNS = [
  /<\s*!--.*?ignore.*?instructions.*?-->/gis,
  /<\s*div[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>.*?<\/div>/gis,
  /<\s*span[^>]*style\s*=\s*["'][^"']*font-size\s*:\s*0[^"']*["'][^>]*>.*?<\/span>/gis,
]

export interface SanitiseResult {
  content: string
  stripped: string[]
}

/**
 * Retrieval rail plugin interface.
 *
 * Developers can implement custom retrieval rails to sanitise
 * tool output before it is fed back to the LLM. Each plugin
 * receives the raw content and returns a sanitised version.
 */
export interface RetrievalRailPlugin {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly author: string
  readonly stage: 'retrieval'
  readonly configSchema: { fields: import('../types.js').ConfigField[] }
  sanitise(content: string): Promise<SanitiseResult> | SanitiseResult
}

export interface RetrievalRailEvent {
  pluginId: string
  originalContent: string
  result: SanitiseResult
}

export type RetrievalRailListener = (event: RetrievalRailEvent) => void

/**
 * Registry for retrieval rail plugins.
 *
 * Runs all registered plugins in sequence. Each plugin receives
 * the output of the previous one. Stripped items accumulate.
 *
 * Emits events after each plugin runs so the host system can
 * log injection attempts, update audit trails, and trigger alerts.
 */
export class RetrievalRailRegistry {
  private readonly plugins: RetrievalRailPlugin[] = []
  private readonly listeners: RetrievalRailListener[] = []

  register(plugin: RetrievalRailPlugin): void {
    this.plugins.push(plugin)
  }

  on(listener: RetrievalRailListener): void {
    this.listeners.push(listener)
  }

  list(): RetrievalRailPlugin[] {
    return [...this.plugins]
  }

  async sanitise(content: string): Promise<SanitiseResult> {
    let current = content
    const allStripped: string[] = []

    for (const plugin of this.plugins) {
      const result = await plugin.sanitise(current)
      if (result.stripped.length > 0) {
        this.emit({ pluginId: plugin.id, originalContent: content, result })
      }
      current = result.content
      allStripped.push(...result.stripped)
    }

    return { content: current, stripped: allStripped }
  }

  private emit(event: RetrievalRailEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

/**
 * Built-in retrieval rail: strips injection phrases and hidden
 * HTML payloads from MCP tool responses.
 */
export class InjectionSanitiser implements RetrievalRailPlugin {
  readonly id = 'injection-sanitiser'
  readonly name = 'Injection sanitiser'
  readonly description = 'Strips known prompt injection phrases and hidden HTML payloads from MCP tool output before feeding back to the LLM.'
  readonly version = '0.3.0'
  readonly author = 'SupaProxy'
  readonly stage = 'retrieval' as const
  readonly configSchema = {
    fields: [
      { name: 'enabled', label: 'Enable injection sanitiser', type: 'toggle' as const, helpText: 'Strip injection attempts from tool output.', defaultValue: true },
      { name: 'stripHtml', label: 'Strip hidden HTML', type: 'toggle' as const, helpText: 'Remove display:none divs, font-size:0 spans, and HTML comments containing injection.', defaultValue: true },
    ],
  }

  sanitise(content: string): SanitiseResult {
    return sanitiseToolOutput(content)
  }
}

export function sanitiseToolOutput(content: string): SanitiseResult {
  let sanitised = content
  const stripped: string[] = []

  // Strip hidden HTML injection
  for (const pattern of HIDDEN_INJECTION_PATTERNS) {
    const matches = sanitised.match(pattern)
    if (matches) {
      stripped.push(...matches.map(m => `hidden: ${m.substring(0, 50)}`))
      sanitised = sanitised.replace(pattern, '')
    }
  }

  // Strip known injection phrases
  for (const pattern of INJECTION_PATTERNS_IN_CONTENT) {
    const matches = sanitised.match(pattern)
    if (matches) {
      stripped.push(...matches)
      sanitised = sanitised.replace(pattern, '[REDACTED]')
    }
  }

  return { content: sanitised, stripped }
}
