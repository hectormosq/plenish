import { appendFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import dotenv from 'dotenv'
import pino from 'pino'
import { formatEntry } from '../format'
import type { LogEntry } from '../events'

// Load logger-specific env vars from .env.logger — isolated from the app's .env
dotenv.config({ path: resolve(process.cwd(), '.env.logger') })

const logger = pino({ level: process.env.AI_LOGGER_LEVEL ?? 'info' })

function writeTxtLine(entry: LogEntry): void {
  const date = entry.timestamp.split('T')[0]
  const logsDir = join(process.cwd(), 'logs')
  mkdirSync(logsDir, { recursive: true })
  appendFileSync(join(logsDir, `${date}.txt`), formatEntry(entry) + '\n')
}

export async function logHandler(request: Request): Promise<Response> {
  try {
    const entry = (await request.json()) as LogEntry
    logger.info({ event: entry }, 'session event')
    writeTxtLine(entry)
    return new Response(null, { status: 204 })
  } catch (err) {
    logger.error(err, 'failed to process log entry')
    return new Response('Bad Request', { status: 400 })
  }
}
