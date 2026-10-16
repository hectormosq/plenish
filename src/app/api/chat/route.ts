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

  // ── Turn setup: agent, prompt, tools and step limits ──────────────────────
  const rawMessages  = (messages ?? []) as UIMessage[];
  const lastUserIdx  = rawMessages.findLastIndex((m) => m.role === 'user');
  const lastUserMsg  = rawMessages[lastUserIdx];
  const prevAssistant = rawMessages.slice(0, Math.max(lastUserIdx, 0)).findLast((m) => m.role === 'assistant');
  const textOf = (m?: UIMessage) => (m?.parts ?? []).filter(isTextUIPart).map((p) => p.text).join('\n');

  const model = getAIModel();
  const turn = await buildChatTurn({
    model,
    lastUserText:          textOf(lastUserMsg),
    previousAssistantText: textOf(prevAssistant),
    logContext:            parseLogContext(rawLogContext),
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
      messageCount: messages.length,
      agent:        turn.agent,
      routeSource:  turn.route?.source ?? 'form',
      routeReason:  turn.route?.reason ?? null,
    },
  });

  // ── Streaming ─────────────────────────────────────────────────────────────
  const converted = await convertToModelMessages(messages);

  const result = streamText({
    model,
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
    onFinish: ({ finishReason, steps }) => {
      // Stopped by the step limit while still calling tools: the agent did not finish its job.
      if (finishReason === 'tool-calls') {
        console.warn(`Chat turn hit the step limit (agent=${turn.agent}, steps=${steps.length}).`);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
