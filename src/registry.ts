import type { GuardrailPlugin, GuardrailStage } from './types.js'

class GuardrailRegistry {
  private readonly plugins = new Map<string, GuardrailPlugin>()

  register(plugin: GuardrailPlugin): void {
    this.plugins.set(plugin.id, plugin)
  }

  deregister(id: string): boolean {
    return this.plugins.delete(id)
  }

  get(id: string): GuardrailPlugin {
    const plugin = this.plugins.get(id)
    if (!plugin) throw new Error(`Guardrail plugin not found: ${id}`)
    return plugin
  }

  has(id: string): boolean {
    return this.plugins.has(id)
  }

  list(): GuardrailPlugin[] {
    return Array.from(this.plugins.values())
  }

  byStage(stage: GuardrailStage): GuardrailPlugin[] {
    return this.list().filter(p => p.stage === stage)
  }

  types(): string[] {
    return Array.from(this.plugins.keys())
  }
}

export const registry = new GuardrailRegistry()
