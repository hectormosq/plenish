import { generateText, Output } from 'ai';
import type { z } from 'zod';
import type { NodeContext, StepUsage } from './types';

/**
 * One structured model call for a pipeline node, with its usage for telemetry.
 * Schemas passed here must have every field required (OpenAI strict JSON
 * schema): use nullable values and clean them in code, never optional fields.
 */
export async function callStructured<S extends z.ZodType>(
  ctx: NodeContext,
  name: string,
  params: { system: string; prompt: string; schema: S },
): Promise<{ output: z.infer<S>; usage: StepUsage }> {
  const started = Date.now();
  const { output, usage } = await generateText({
    model: ctx.model,
    system: params.system,
    prompt: params.prompt,
    output: Output.object({ schema: params.schema }),
    temperature: 0,
    maxRetries: 1,
  });
  return {
    output: output as z.infer<S>,
    usage: {
      name,
      input_tokens: usage.inputTokens ?? 0,
      output_tokens: usage.outputTokens ?? 0,
      latency_ms: Date.now() - started,
    },
  };
}

/** The user's local date and time, from the browser's timezone offset. */
export function localNow(ctx: NodeContext): { iso: string; hour: number; label: string } {
  const local = new Date(ctx.now.getTime() - ctx.tzOffsetMinutes * 60_000);
  const label = local.toISOString().slice(0, 16).replace('T', ' ');
  const weekday = local.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return { iso: ctx.now.toISOString(), hour: local.getUTCHours(), label: `${weekday} ${label}` };
}
