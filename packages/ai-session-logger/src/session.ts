import type {
  SessionConfig,
  PromptSentPayload,
  AiResponsePayload,
  EventType,
  LogEntry,
  Transport,
  TransportMode,
} from './events'
import { FileTransport } from './transports/file'
import { ServerTransport } from './transports/server'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m${seconds}s`
}

class CompositeTransport implements Transport {
  constructor(private readonly transports: Transport[]) {}
  write(entry: LogEntry): void {
    this.transports.forEach(t => t.write(entry))
  }
}

function buildTransport(config: SessionConfig): Transport {
  const envMode =
    typeof process !== 'undefined'
      ? (process.env.AI_LOGGER_MODE as TransportMode | undefined)
      : undefined
  const mode: TransportMode = config.transport ?? envMode ?? 'local'
  switch (mode) {
    case 'server':
      return new ServerTransport()
    case 'both':
      return new CompositeTransport([new FileTransport(config.apiPath), new ServerTransport()])
    default:
      return new FileTransport(config.apiPath)
  }
}

function resolveTimeoutMs(config: SessionConfig): number {
  const minutes =
    config.timeoutMinutes ??
    (typeof process !== 'undefined'
      ? parseInt(process.env.AI_LOGGER_SESSION_TIMEOUT ?? '10', 10)
      : 10)
  return minutes * 60 * 1000
}

function resolveLevel(config: SessionConfig): 'info' | 'debug' {
  return (
    config.level ??
    ((typeof process !== 'undefined'
      ? (process.env.AI_LOGGER_LEVEL as 'info' | 'debug' | undefined)
      : undefined) ?? 'info')
  )
}

export class SessionLogger {
  public readonly sessionId: string
  private readonly startTime: number
  private readonly transport: Transport
  private readonly timeoutMs: number
  private readonly level: 'info' | 'debug'
  private eventCount = 0
  private ended = false
  private timeoutHandle?: ReturnType<typeof setTimeout>

  constructor(private readonly config: SessionConfig) {
    this.sessionId = generateId()
    this.startTime = Date.now()
    this.transport = buildTransport(config)
    this.timeoutMs = resolveTimeoutMs(config)
    this.level = resolveLevel(config)

    this.emit('SESSION_START', {
      session_id: this.sessionId,
      user_id: config.userId,
      app: config.app,
    })
    this.resetTimeout()
  }

  private resetTimeout(): void {
    if (this.ended) return
    clearTimeout(this.timeoutHandle)
    this.timeoutHandle = setTimeout(() => this.end(), this.timeoutMs)
  }

  private emit(type: EventType, data?: Record<string, unknown>): void {
    if (this.ended && type !== 'SESSION_END') return
    const entry: LogEntry = {
      type,
      sessionId: this.sessionId,
      userId: this.config.userId,
      app: this.config.app,
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - this.startTime,
      data,
    }
    this.eventCount++
    this.transport.write(entry)
  }

  buttonClick(action: string, value?: Record<string, unknown>): void {
    this.emit('BUTTON_CLICK', { action, ...(value != null ? { value } : {}) })
    this.resetTimeout()
  }

  userMessage(text: string, context?: Record<string, unknown>): void {
    this.emit('USER_MESSAGE', { text, ...(context ? { context } : {}) })
    this.resetTimeout()
  }

  promptSent(payload: PromptSentPayload): void {
    const data: Record<string, unknown> = { model: payload.model }
    if (payload.tokensEst !== undefined) data.tokens_est = payload.tokensEst
    if (payload.context) data.context = payload.context
    if (this.level === 'debug') data.prompt = payload.prompt
    this.emit('PROMPT_SENT', data)
    this.resetTimeout()
  }

  toolCall(tool: string, args?: Record<string, unknown>): void {
    this.emit('TOOL_CALL', { tool, ...(args ? { args } : {}) })
    this.resetTimeout()
  }

  aiResponse(payload: AiResponsePayload): void {
    const data: Record<string, unknown> = { text: payload.text }
    if (payload.tokensUsed !== undefined) data.tokens_used = payload.tokensUsed
    this.emit('AI_RESPONSE', data)
    this.resetTimeout()
  }

  error(message: string, err?: Error): void {
    this.emit('ERROR', { message, ...(err?.stack ? { stack: err.stack } : {}) })
    this.resetTimeout()
  }

  end(): void {
    if (this.ended) return
    this.ended = true
    clearTimeout(this.timeoutHandle)
    this.emit('SESSION_END', {
      duration: formatDuration(Date.now() - this.startTime),
      events: this.eventCount,
    })
  }
}

export function createSession(config: SessionConfig): SessionLogger {
  return new SessionLogger(config)
}
