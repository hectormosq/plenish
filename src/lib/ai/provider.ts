import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Returns the configured AI language model based on PLENISH_AI_PROVIDER env var.
 * Defaults to Google Gemini Flash.
 *
 * Supported values:
 *   - "google"    → gemini-2.0-flash (default)
 *   - "openai"    → gpt-4o-mini
 */
export function getAIModel(): LanguageModel {
  const provider = process.env.PLENISH_AI_PROVIDER ?? 'google';

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai('gpt-4o-mini');
    }

    case 'google':
    default: {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google('gemini-2.0-flash');
    }
  }
}

export const SYSTEM_PROMPT = `You are Plenish, a friendly and knowledgeable AI meal tracking and planning assistant. 
You help users log what they eat, suggest culturally-relevant meal ideas (with a focus on Spanish and Latin cuisine), 
and help plan weekly meals. You respond naturally in the same language the user uses (Spanish or English). 
Keep responses concise and practical. When a user mentions a meal, acknowledge it warmly and offer useful nutritional context or suggestions.`;
