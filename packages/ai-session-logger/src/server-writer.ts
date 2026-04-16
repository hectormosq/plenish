import dotenv from 'dotenv'
import { resolve } from 'path'
import type { EventType, LogEntry, PromptSentPayload, LogLevel } from './events'
import { DirectFileTransport } from './transports/direct'

dotenv.config({ path: resolve(process.cwd(), '.env.logger') })

/**
 * Lightweight server-side event emitter that writes into an existing client session.
 * Does NOT emit SESSION_START or SESSION_END — the client session owns the lifecycle.
 * Use createServerWriter() to instantiate.
 */
export class ServerEventWriter {
  private readonly transport: DirectFileTransport
  private readonly level: LogLevel

  constructor(
    private readonly sessionId: string,
    private readonly userId: string,
    private readonly app: string,
    level?: LogLevel,
  ) {
    this.transport = new DirectFileTransport()
    this.level = level ?? ((process.env.AI_LOGGER_LEVEL as LogLevel | undefined) ?? 'info')
  }

  private emit(type: EventType, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      type,
      sessionId: this.sessionId,
      userId: this.userId,
      app: this.app,
      timestamp: new Date().toISOString(),
      elapsedMs: 0,
      data,
    }
    this.transport.write(entry)
  }

  promptSent(payload: PromptSentPayload): void {
    const data: Record<string, unknown> = { model: payload.model }
    if (payload.tokensEst !== undefined) data.tokens_est = payload.tokensEst
    if (payload.context) data.context = payload.context
    if (this.level === 'debug') data.prompt = payload.prompt
    this.emit('PROMPT_SENT', data)
  }

  toolCall(tool: string, args?: Record<string, unknown>): void {
    this.emit('TOOL_CALL', { tool, ...(args ? { args } : {}) })
  }

  toolResult(tool: string, result: unknown): void {
    const raw = typeof result === 'string' ? result : (JSON.stringify(result) ?? 'undefined')
    // Truncate large results so log lines stay readable
    const value = raw.length > 400 ? raw.slice(0, 400) + '…' : raw
    this.emit('TOOL_RESULT', { tool, result: value })
  }

  error(message: string, err?: Error): void {
    this.emit('ERROR', { message, ...(err?.stack ? { stack: err.stack } : {}) })
  }
}

export function createServerWriter(config: {
  sessionId: string
  userId: string
  app: string
  level?: LogLevel
}): ServerEventWriter {
  return new ServerEventWriter(config.sessionId, config.userId, config.app, config.level)
}
