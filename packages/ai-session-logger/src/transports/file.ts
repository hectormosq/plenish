import type { LogEntry, Transport } from '../events'

/**
 * POSTs log entries to a local Next.js API route.
 * Works in both browser and server contexts — the route handler writes to disk.
 * Silent on failure so logging never disrupts the app.
 */
export class FileTransport implements Transport {
  private readonly apiPath: string

  constructor(apiPath = '/api/log') {
    this.apiPath = apiPath
  }

  write(entry: LogEntry): void {
    if (typeof fetch === 'undefined') return
    fetch(this.apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => undefined)
  }
}
