import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { formatEntry } from '../format'
import type { LogEntry, Transport } from '../events'

/**
 * Writes log entries directly to disk — server-side only.
 * Bypasses the HTTP API route for server contexts (chat route, server actions).
 */
export class DirectFileTransport implements Transport {
  write(entry: LogEntry): void {
    const date = entry.timestamp.split('T')[0]
    const logsDir = join(process.cwd(), 'logs')
    mkdirSync(logsDir, { recursive: true })
    appendFileSync(join(logsDir, `${date}.txt`), formatEntry(entry) + '\n')
  }
}
