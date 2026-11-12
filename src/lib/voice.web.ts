import type { Language } from "./types";

type SpeechEvent = { results: { 0: { 0: { transcript: string } } } };
type Recognizer = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
type SpeechWindow = {
  SpeechRecognition?: new () => Recognizer;
  webkitSpeechRecognition?: new () => Recognizer;
};
function constructor() {
  const w = globalThis as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
export function canRecognizeSpeech() {
  return Boolean(constructor());
}
export function recognizeSpeech(language: Language): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = constructor();
    if (!SpeechRecognition) {
      reject(new Error("unavailable"));
      return;
    }
    const recognition = new SpeechRecognition();
    let settled = false;
    const finish = (text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      recognition.abort();
      if (text) resolve(text);
      else reject(new Error("unavailable"));
    };
    const timer = setTimeout(() => finish(), 20000);
    recognition.lang = language === "ru" ? "ru-RU" : "kk-KZ";
    recognition.interimResults = false;
    recognition.onresult = (event) => finish(event.results[0][0].transcript);
    recognition.onerror = () => finish();
    recognition.onend = () => finish();
    recognition.start();
  });
}
