/**
 * Execution rail: validates tool calls before execution.
 *
 * Checks that the AI's tool call is consistent with the user's
 * original intent. Prevents injection via tool output from
 * triggering destructive operations.
 */

export interface ToolCallContext {
  toolName: string
  toolArgs: Record<string, unknown>
  originalQuery: string
  workspaceId: string
  isWrite: boolean
}

export interface ExecutionRailResult {
  allowed: boolean
  reason?: string
  pluginId?: string
}

export interface ExecutionRailPlugin {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly author: string
  readonly stage: 'execution'
  readonly source?: import('../types.js').PluginSource
  readonly icon?: string
  readonly configSchema: { fields: import('../types.js').ConfigField[] }
  readonly eventDisplay: import('../types.js').DisplayField[]
  readonly eventActions: import('../types.js').EventAction[]
  validateToolCall(ctx: ToolCallContext): Promise<ExecutionRailResult>
}

export interface ExecutionRailEvent {
  pluginId: string
  ctx: ToolCallContext
  result: ExecutionRailResult
}

export type ExecutionRailListener = (event: ExecutionRailEvent) => void

/**
 * Registry for execution rail plugins.
 *
 * Runs all registered plugins in order. If any plugin blocks
 * the tool call, execution stops and the reason is returned.
 *
 * Emits events on every validation (allowed or blocked) so the
 * host system can log, audit, and rate-limit without the library
 * needing infrastructure dependencies.
 */
export class ExecutionRailRegistry {
  private readonly plugins: ExecutionRailPlugin[] = []
  private readonly listeners: ExecutionRailListener[] = []

  register(plugin: ExecutionRailPlugin): void {
    this.plugins.push(plugin)
  }

  on(listener: ExecutionRailListener): void {
    this.listeners.push(listener)
  }

  list(): ExecutionRailPlugin[] {
    return [...this.plugins]
  }

  async validate(ctx: ToolCallContext): Promise<ExecutionRailResult> {
    for (const plugin of this.plugins) {
      const result = await plugin.validateToolCall(ctx)
      this.emit({ pluginId: plugin.id, ctx, result })
      if (!result.allowed) return { ...result, pluginId: plugin.id }
    }
    return { allowed: true }
  }

  private emit(event: ExecutionRailEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

/**
 * Built-in execution rail: blocks write tools when the original
 * query doesn't suggest a write intent.
 */
export class WriteGuardRail implements ExecutionRailPlugin {
  readonly id = 'write-guard'
  readonly name = 'Write operation guard'
  readonly description = 'Blocks write tool calls when the user query does not express write intent. Prevents the AI from being tricked into destructive operations via indirect injection.'
  readonly version = '0.3.0'
  readonly author = 'SupaProxy'
  readonly stage = 'execution' as const
  readonly configSchema = {
    fields: [
      { name: 'enabled', label: 'Enable write guard', type: 'toggle' as const, helpText: 'Block write tools when the query is informational.', defaultValue: true },
    ],
  }
  readonly eventDisplay: import('../types.js').DisplayField[] = [
    { source: 'context', key: 'tool_name', label: 'Tool', format: 'text' },
    { source: 'context', key: 'tool_args', label: 'Tool arguments', format: 'code' },
    { source: 'context', key: 'connection_name', label: 'Connection', format: 'text' },
    { source: 'context', key: 'original_query', label: 'User query', format: 'text' },
    { source: 'outcome', key: 'reason', label: 'Reason', format: 'warning' },
  ]
  readonly eventActions: import('../types.js').EventAction[] = [
    { type: 'flag', label: 'Flag for review' },
    { type: 'dismiss', label: 'Dismiss' },
    { type: 'block_connection', label: 'Block connection' },
  ]

  private readonly WRITE_INTENT_PATTERNS = [
    /\b(create|add|new|file|submit|register|open|start)\b/i,
    /\b(update|change|modify|edit|set|rename)\b/i,
    /\b(delete|remove|cancel|close|revoke|drop)\b/i,
    /\b(send|transfer|pay|refund|approve|reject)\b/i,
  ]

  // Informational framing negates write intent
  private readonly INFORMATIONAL_PATTERNS = [
    /^(what|how|tell|explain|describe|show|list|can you tell)\b/i,
    /\b(about|status|details|information|info|policy|fees?|pricing|cost)\b/i,
    /\b(how (much|many|long|does|do|is|are|can))\b/i,
    /\?$/,
  ]

  async validateToolCall(ctx: ToolCallContext): Promise<ExecutionRailResult> {
    if (!ctx.isWrite) return { allowed: true }

    const hasWriteIntent = this.WRITE_INTENT_PATTERNS.some(p => p.test(ctx.originalQuery))
    const isInformational = this.INFORMATIONAL_PATTERNS.filter(p => p.test(ctx.originalQuery)).length >= 2

    if (!hasWriteIntent || isInformational) {
      return {
        allowed: false,
        reason: `Tool "${ctx.toolName}" is a write operation but the query "${ctx.originalQuery}" does not express write intent`,
      }
    }

    return { allowed: true }
  }
}
