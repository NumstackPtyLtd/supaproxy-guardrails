/**
 * Global plugin catalogues for discovery.
 *
 * Plugins register themselves at import time. The host system iterates
 * the catalogues to discover available plugins without importing
 * concrete classes. The server never needs to know plugin names or IDs.
 *
 * Pipeline plugins (pre/post-LLM) use the existing `registry`.
 * Execution and retrieval rails use these catalogues.
 */

import type { ExecutionRailPlugin } from './execution/index.js'
import type { RetrievalRailPlugin } from './retrieval/index.js'

class PluginCatalogue<T extends { id: string; stage: string }> {
  private readonly plugins = new Map<string, T>()

  register(plugin: T): void {
    this.plugins.set(plugin.id, plugin)
  }

  deregister(id: string): boolean {
    return this.plugins.delete(id)
  }

  get(id: string): T | undefined {
    return this.plugins.get(id)
  }

  has(id: string): boolean {
    return this.plugins.has(id)
  }

  list(): T[] {
    return Array.from(this.plugins.values())
  }

  ids(): string[] {
    return Array.from(this.plugins.keys())
  }

  factory(id: string): (() => T) | undefined {
    const proto = this.plugins.get(id)
    if (!proto) return undefined
    const Ctor = proto.constructor as new () => T
    return () => new Ctor()
  }
}

export const executionCatalogue = new PluginCatalogue<ExecutionRailPlugin>()
export const retrievalCatalogue = new PluginCatalogue<RetrievalRailPlugin>()
