import 'server-only';

import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

export type GeminiKeyStatus = 'missing' | 'suspicious' | 'configured';

export function getGeminiApiKeyStatus(): GeminiKeyStatus {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return 'missing';
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey) ? 'configured' : 'suspicious';
}

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('Gemini API key missing');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
