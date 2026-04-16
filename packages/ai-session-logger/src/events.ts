export type EventType =
  | 'SESSION_START'
  | 'BUTTON_CLICK'
  | 'USER_MESSAGE'
  | 'PROMPT_SENT'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'AI_RESPONSE'
  | 'ERROR'
  | 'SESSION_END'

export type TransportMode = 'local' | 'server' | 'both'
export type LogLevel = 'info' | 'debug'

export interface SessionConfig {
  userId: string
  app: string
  /** Override transport mode — falls back to AI_LOGGER_MODE env var, then 'local' */
  transport?: TransportMode
  /** API route path for local transport (default: '/api/log') */
  apiPath?: string
  /** Session inactivity timeout in minutes — falls back to AI_LOGGER_SESSION_TIMEOUT, then 10 */
  timeoutMinutes?: number
  /** Log level — falls back to AI_LOGGER_LEVEL, then 'info' */
  level?: LogLevel
}

export interface PromptSentPayload {
  model: string
  prompt: string
  tokensEst?: number
  context?: Record<string, unknown>
}

export interface AiResponsePayload {
  text: string
  tokensUsed?: number
}

export interface LogEntry {
  type: EventType
  sessionId: string
  userId: string
  app: string
  timestamp: string
  elapsedMs: number
  data?: Record<string, unknown>
}

export interface Transport {
  write(entry: LogEntry): void
}
