import { streamText, convertToModelMessages, isTextUIPart } from 'ai';
import type { UIMessage } from 'ai';
import { getAIModel, getModelName } from '@/lib/ai/provider';
import { buildChatTurn, turnLoopSettings } from '@/lib/ai/chat-turn';
import { parseLogContext } from '@/lib/ai/log-context';
import { createClient } from '@/lib/supabase/server';
import { createServerWriter } from 'ai-session-logger/next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const { messages, tzOffset, sessionId, logContext: rawLogContext } = await req.json();
  const tz = Number.isFinite(tzOffset) ? tzOffset : 0;

  // ── Turn setup: prompt tier, tools and step limits ────────────────────────
  const rawMessages = (messages ?? []) as UIMessage[];
  const lastUserMsg = [...rawMessages].reverse().find((m) => m.role === 'user');
  const textPart    = lastUserMsg?.parts.find(isTextUIPart);

  const turn = await buildChatTurn({
    lastUserText:    textPart?.text ?? '',
    logContext:      parseLogContext(rawLogContext),
    tzOffsetMinutes: tz,
    userId:          user.id,
    supabase,
    sessionId,
  });

  // ── Session telemetry ─────────────────────────────────────────────────────
  const writer = sessionId
    ? createServerWriter({ sessionId, userId: user.id, app: 'plenish' })
    : null;

  writer?.promptSent({
    model: getModelName(),
    prompt: turn.system,
    tokensEst: Math.ceil((turn.system.length + JSON.stringify(messages).length) / 4),
    context: {
      messageCount:  messages.length,
      promptTier:    turn.tier,
      logMode:       turn.mode,
      intentSignals: turn.intentSignals,
    },
  });

  // ── Streaming ─────────────────────────────────────────────────────────────
  const converted = await convertToModelMessages(messages);

  const result = streamText({
    model:    getAIModel(),
    system:   turn.system,
    messages: converted,
    tools:    turn.tools,
    ...turnLoopSettings(turn),
    onStepFinish: ({ text, toolCalls, toolResults, usage }) => {
      for (const tc of toolCalls) {
        writer?.toolCall(tc.toolName, tc.input as Record<string, unknown>);
      }
      for (const tr of toolResults) {
        writer?.toolResult(tr.toolName, tr.output);
      }
      if (text) {
        writer?.aiResponse({
          text,
          inputTokens:  usage.inputTokens,
          outputTokens: usage.outputTokens,
          tokensUsed:   usage.totalTokens,
        });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
