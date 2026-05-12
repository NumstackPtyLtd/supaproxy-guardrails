import { describe, it, expect } from 'vitest'
import { WriteGuardRail, ExecutionRailRegistry } from './index.js'
import type { ExecutionRailPlugin, ToolCallContext, ExecutionRailResult, ExecutionRailEvent } from './index.js'

describe('WriteGuardRail', () => {
  const rail = new WriteGuardRail()

  it('allows read-only tool calls regardless of query', async () => {
    const result = await rail.validateToolCall({
      toolName: 'get_balance',
      toolArgs: { account: '123' },
      originalQuery: 'What is my balance?',
      workspaceId: 'ws-1',
      isWrite: false,
    })
    expect(result.allowed).toBe(true)
  })

  it('allows write tool when query expresses write intent (create)', async () => {
    const result = await rail.validateToolCall({
      toolName: 'create_claim',
      toolArgs: { type: 'auto' },
      originalQuery: 'I need to file a new claim for my car accident',
      workspaceId: 'ws-1',
      isWrite: true,
    })
    expect(result.allowed).toBe(true)
  })

  it('allows write tool when query expresses write intent (delete)', async () => {
    const result = await rail.validateToolCall({
      toolName: 'cancel_policy',
      toolArgs: { id: 'pol-1' },
      originalQuery: 'Please cancel my insurance policy',
      workspaceId: 'ws-1',
      isWrite: true,
    })
    expect(result.allowed).toBe(true)
  })

  it('allows write tool when query expresses write intent (update)', async () => {
    const result = await rail.validateToolCall({
      toolName: 'update_address',
      toolArgs: { address: '123 Main St' },
      originalQuery: 'I need to change my address on file',
      workspaceId: 'ws-1',
      isWrite: true,
    })
    expect(result.allowed).toBe(true)
  })

  it('blocks write tool when query is read-only (balance check)', async () => {
    const result = await rail.validateToolCall({
      toolName: 'delete_account',
      toolArgs: { id: '123' },
      originalQuery: 'What is my account balance?',
      workspaceId: 'ws-1',
      isWrite: true,
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('write operation')
    expect(result.reason).toContain('delete_account')
  })

  it('blocks write tool when query is informational despite containing write verb', async () => {
    const result = await rail.validateToolCall({
      toolName: 'transfer_funds',
      toolArgs: { amount: 1000 },
      originalQuery: 'Tell me about your transfer fees',
      workspaceId: 'ws-1',
      isWrite: true,
    })
    expect(result.allowed).toBe(false)
  })

  it('allows genuine write request even with simple phrasing', async () => {
    const result = await rail.validateToolCall({
      toolName: 'transfer_funds',
      toolArgs: { amount: 500 },
      originalQuery: 'Please transfer R500 to my savings account',
      workspaceId: 'ws-1',
      isWrite: true,
    })
    expect(result.allowed).toBe(true)
  })

  it('blocks write tool when query asks about status', async () => {
    const result = await rail.validateToolCall({
      toolName: 'delete_claim',
      toolArgs: { id: 'clm-1' },
      originalQuery: 'What is the status of my claim?',
      workspaceId: 'ws-1',
      isWrite: true,
    })
    expect(result.allowed).toBe(false)
  })
})

describe('ExecutionRailRegistry', () => {
  const writeCtx: ToolCallContext = {
    toolName: 'delete_account',
    toolArgs: { id: '123' },
    originalQuery: 'What is my balance?',
    workspaceId: 'ws-1',
    isWrite: true,
  }

  const readCtx: ToolCallContext = {
    toolName: 'get_balance',
    toolArgs: { account: '123' },
    originalQuery: 'What is my balance?',
    workspaceId: 'ws-1',
    isWrite: false,
  }

  it('allows when no plugins registered', async () => {
    const reg = new ExecutionRailRegistry()
    const result = await reg.validate(readCtx)
    expect(result.allowed).toBe(true)
  })

  it('runs registered plugins in order', async () => {
    const reg = new ExecutionRailRegistry()
    reg.register(new WriteGuardRail())
    const result = await reg.validate(writeCtx)
    expect(result.allowed).toBe(false)
  })

  it('stops at first blocking plugin', async () => {
    const calls: string[] = []
    const blocker: ExecutionRailPlugin = {
      id: 'blocker',
      name: 'Blocker',
      async validateToolCall() {
        calls.push('blocker')
        return { allowed: false, reason: 'blocked' }
      },
    }
    const passthrough: ExecutionRailPlugin = {
      id: 'pass',
      name: 'Pass',
      async validateToolCall() {
        calls.push('pass')
        return { allowed: true }
      },
    }

    const reg = new ExecutionRailRegistry()
    reg.register(blocker)
    reg.register(passthrough)
    const result = await reg.validate(readCtx)
    expect(result.allowed).toBe(false)
    expect(calls).toEqual(['blocker'])
  })

  it('lists registered plugins', () => {
    const reg = new ExecutionRailRegistry()
    const rail = new WriteGuardRail()
    reg.register(rail)
    expect(reg.list()).toHaveLength(1)
    expect(reg.list()[0].id).toBe('write-guard')
  })

  it('allows when all plugins pass', async () => {
    const pass1: ExecutionRailPlugin = {
      id: 'p1', name: 'P1',
      async validateToolCall() { return { allowed: true } },
    }
    const pass2: ExecutionRailPlugin = {
      id: 'p2', name: 'P2',
      async validateToolCall() { return { allowed: true } },
    }

    const reg = new ExecutionRailRegistry()
    reg.register(pass1)
    reg.register(pass2)
    const result = await reg.validate(readCtx)
    expect(result.allowed).toBe(true)
  })

  it('emits event when tool call is blocked', async () => {
    const events: ExecutionRailEvent[] = []
    const reg = new ExecutionRailRegistry()
    reg.register(new WriteGuardRail())
    reg.on((e) => events.push(e))

    await reg.validate(writeCtx)

    expect(events).toHaveLength(1)
    expect(events[0].pluginId).toBe('write-guard')
    expect(events[0].result.allowed).toBe(false)
    expect(events[0].ctx.toolName).toBe('delete_account')
    expect(events[0].ctx.workspaceId).toBe('ws-1')
  })

  it('emits event when tool call is allowed', async () => {
    const events: ExecutionRailEvent[] = []
    const reg = new ExecutionRailRegistry()
    reg.register(new WriteGuardRail())
    reg.on((e) => events.push(e))

    await reg.validate(readCtx)

    expect(events).toHaveLength(1)
    expect(events[0].result.allowed).toBe(true)
  })

  it('emits events for each plugin until one blocks', async () => {
    const events: ExecutionRailEvent[] = []
    const pass: ExecutionRailPlugin = {
      id: 'pass', name: 'Pass',
      async validateToolCall() { return { allowed: true } },
    }
    const reg = new ExecutionRailRegistry()
    reg.register(pass)
    reg.register(new WriteGuardRail())
    reg.on((e) => events.push(e))

    await reg.validate(writeCtx)

    expect(events).toHaveLength(2)
    expect(events[0].pluginId).toBe('pass')
    expect(events[0].result.allowed).toBe(true)
    expect(events[1].pluginId).toBe('write-guard')
    expect(events[1].result.allowed).toBe(false)
  })
})
