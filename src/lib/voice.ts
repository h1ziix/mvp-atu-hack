import type { Language } from "./types";

// Expo Go has no bundled native speech recognizer. The native form uses OS keyboard dictation.
export function canRecognizeSpeech() {
  return false;
}
export async function recognizeSpeech(_language: Language): Promise<string> {
  throw new Error("unavailable");
}
