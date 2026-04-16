import type { LogEntry } from './events'

function formatValue(v: unknown): string {
  if (typeof v === 'string') return v.includes(' ') ? `"${v}"` : v
  if (typeof v === 'object' && v !== null) return JSON.stringify(v)
  return String(v)
}

/**
 * Formats a LogEntry as a human-readable pipe-delimited line.
 *
 * SESSION_START | session_id=abc | user_id=u1 | app=plenish | +0ms
 * BUTTON_CLICK  | action=date_selected | value=2025-04-16 | +1200ms
 * SESSION_END   | duration=4m12s | events=5 | +252000ms
 */
export function formatEntry(entry: LogEntry): string {
  const type = entry.type.padEnd(13)
  const fields = Object.entries(entry.data ?? {}).map(
    ([k, v]) => `${k}=${formatValue(v)}`
  )

  return [type, ...fields, `+${entry.elapsedMs}ms`].join(' | ')
}
