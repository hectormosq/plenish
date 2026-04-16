'use client'

import { createContext, useContext, useRef, useEffect, type ReactNode } from 'react'
import { createSession, SessionLogger } from '../session'
import type { SessionConfig } from '../events'

interface SessionLoggerContextValue {
  session: SessionLogger
}

const SessionLoggerContext = createContext<SessionLoggerContextValue | null>(null)

type ProviderProps = SessionConfig & { children: ReactNode }

export function SessionLoggerProvider({ children, ...config }: ProviderProps) {
  const sessionRef = useRef<SessionLogger | null>(null)
  // Create once on mount — intentionally ignore config changes after mount
  if (!sessionRef.current) {
    sessionRef.current = createSession(config)
  }
  const session = sessionRef.current as SessionLogger

  useEffect(() => {
    return () => {
      session.end()
    }
  }, [session])

  return (
    <SessionLoggerContext.Provider value={{ session }}>
      {children}
    </SessionLoggerContext.Provider>
  )
}

export function useSessionLogger(): SessionLoggerContextValue {
  const ctx = useContext(SessionLoggerContext)
  if (!ctx) {
    throw new Error('useSessionLogger must be used within a SessionLoggerProvider')
  }
  return ctx
}
