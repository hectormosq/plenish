import type { LogEntry, Transport } from '../events'

/**
 * POSTs log entries to a remote endpoint (AI_LOGGER_SERVER_URL).
 * Silent on failure so logging never disrupts the app.
 */
export class ServerTransport implements Transport {
  private readonly url: string

  constructor(url?: string) {
    const resolved =
      url ??
      (typeof process !== 'undefined' ? process.env.AI_LOGGER_SERVER_URL : undefined) ??
      ''
    if (!resolved) {
      console.warn('[ai-session-logger] ServerTransport: AI_LOGGER_SERVER_URL is not set')
    }
    this.url = resolved
  }

  write(entry: LogEntry): void {
    if (!this.url || typeof fetch === 'undefined') return
    fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => undefined)
  }
}
