import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSession } from './session'
import type { LogEntry } from './events'

describe('SessionLogger', () => {
  let fetchCalls: Array<{ url: string; body: LogEntry }>

  beforeEach(() => {
    fetchCalls = []
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        fetchCalls.push({ url: _url, body: JSON.parse(options.body as string) as LogEntry })
        return Promise.resolve(new Response(null, { status: 204 }))
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.AI_LOGGER_LEVEL
  })

  it('emits SESSION_START on construction', () => {
    createSession({ userId: 'u1', app: 'test' })
    expect(fetchCalls).toHaveLength(1)
    const { body } = fetchCalls[0]
    expect(body.type).toBe('SESSION_START')
    expect(body.userId).toBe('u1')
    expect(body.app).toBe('test')
    expect(body.data?.session_id).toBeTruthy()
    expect(body.data?.user_id).toBe('u1')
    expect(body.data?.app).toBe('test')
  })

  it('emits BUTTON_CLICK with action and value', () => {
    const session = createSession({ userId: 'u1', app: 'test' })
    session.buttonClick('meal_type_selected', { type: 'breakfast' })
    const { body } = fetchCalls[1]
    expect(body.type).toBe('BUTTON_CLICK')
    expect(body.data?.action).toBe('meal_type_selected')
    expect(body.data?.value).toEqual({ type: 'breakfast' })
    expect(body.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('emits USER_MESSAGE with text', () => {
    const session = createSession({ userId: 'u1', app: 'test' })
    session.userMessage('tengo huevos y aguacate')
    const { body } = fetchCalls[1]
    expect(body.type).toBe('USER_MESSAGE')
    expect(body.data?.text).toBe('tengo huevos y aguacate')
  })

  it('omits prompt in PROMPT_SENT when level is info', () => {
    const session = createSession({ userId: 'u1', app: 'test', level: 'info' })
    session.promptSent({ model: 'gemini-2.5-flash', prompt: 'secret prompt', tokensEst: 100 })
    const { body } = fetchCalls[1]
    expect(body.type).toBe('PROMPT_SENT')
    expect(body.data?.model).toBe('gemini-2.5-flash')
    expect(body.data?.tokens_est).toBe(100)
    expect(body.data?.prompt).toBeUndefined()
  })

  it('includes prompt in PROMPT_SENT when level is debug', () => {
    const session = createSession({ userId: 'u1', app: 'test', level: 'debug' })
    session.promptSent({ model: 'gemini-2.5-flash', prompt: 'secret prompt', tokensEst: 100 })
    const { body } = fetchCalls[1]
    expect(body.data?.prompt).toBe('secret prompt')
    expect(body.data?.model).toBe('gemini-2.5-flash')
  })

  it('emits SESSION_END with duration and event count', () => {
    const session = createSession({ userId: 'u1', app: 'test' })
    session.buttonClick('x')
    session.userMessage('hello')
    session.end()
    const { body } = fetchCalls[fetchCalls.length - 1]
    expect(body.type).toBe('SESSION_END')
    expect(body.data?.duration).toMatch(/^\d+m\d+s$/)
    expect(body.data?.events).toBeTypeOf('number')
    expect(body.data?.events).toBeGreaterThan(0)
  })

  it('does not emit events after end()', () => {
    const session = createSession({ userId: 'u1', app: 'test' })
    session.end()
    const countAfterEnd = fetchCalls.length
    session.buttonClick('should_be_ignored')
    session.userMessage('also ignored')
    expect(fetchCalls.length).toBe(countAfterEnd)
  })
})
