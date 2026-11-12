import { useEffect, useRef, useState } from "react"
import { Camera, Mic, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  recognizeMeasurement,
  recognizeWastePhoto,
  type AiMeasurement,
} from "@/lib/ai"
import { unitLabel } from "@/reports/model"
import type { Point } from "./model"

type SpeechCapture = {
  lang: string
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>
      }) => void)
    | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechBrowser = Window & {
  SpeechRecognition?: new () => SpeechCapture
  webkitSpeechRecognition?: new () => SpeechCapture
}

const spokenFractions: Record<string, number> = {
  полтора: 1.5,
  полторы: 1.5,
  "один с половиной": 1.5,
  "одна с половиной": 1.5,
  "два с половиной": 2.5,
  "две с половиной": 2.5,
  "три с половиной": 3.5,
  "четыре с половиной": 4.5,
  "пять с половиной": 5.5,
}
const spokenUnit = /^(кг|килограмм(?:а|ов)?|л|литр(?:а|ов)?)(?!\p{L})/iu

function spokenFraction(transcript: string) {
  const text = transcript.trim().replace(/\s+/g, " ")
  for (const [phrase, amount] of Object.entries(spokenFractions)) {
    if (!text.toLowerCase().startsWith(phrase + " ")) continue
    const match = spokenUnit.exec(text.slice(phrase.length + 1))
    if (!match) continue
    const rest = text.slice(phrase.length + 1 + match[0].length)
    // Leave multi-item descriptions for the model to resolve.
    if (
      /\d|(?:^|[^\p{L}])(?:кг|килограмм\p{L}*|л|литр\p{L}*)(?!\p{L})/iu.test(
        rest
      )
    )
      return null
    const unit = /^к/iu.test(match[0]) ? "kg" : "l"
    return {
      amount,
      unit,
      normalized:
        String(amount).replace(".", ",") +
        (unit === "kg" ? " кг" : " л") +
        rest,
    }
  }
  return null
}

export function MeasurementAssistant({
  token,
  point,
  disabled,
  onApply,
}: {
  token: string
  point: Point
  disabled: boolean
  onApply: (suggestion: AiMeasurement) => void
}) {
  const [transcript, setTranscript] = useState("")
  const [suggestion, setSuggestion] = useState<AiMeasurement | null>(null)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState("")
  const microphone = useRef<SpeechCapture | null>(null)
  const browser = window as SpeechBrowser
  const SpeechRecognition =
    browser.SpeechRecognition ?? browser.webkitSpeechRecognition
  const waste = point.wastes.find(({ id }) => id === suggestion?.wasteId)
  const disposal = point.disposals.find(
    ({ id }) => id === suggestion?.disposalId
  )

  useEffect(
    () => () => {
      const capture = microphone.current
      if (capture) {
        capture.onresult = capture.onerror = capture.onend = null
        capture.abort()
      }
    },
    []
  )

  function listen() {
    if (microphone.current) {
      microphone.current.stop()
      return
    }
    if (!SpeechRecognition) return
    const capture = new SpeechRecognition()
    capture.lang = "ru-RU"
    capture.onresult = (event) => {
      setTranscript(
        Array.from(event.results, (item) => item[0].transcript)
          .join(" ")
          .slice(0, 500)
      )
      setSuggestion(null)
    }
    capture.onerror = () =>
      setError(
        "Не удалось распознать речь. Проверьте доступ к микрофону или введите фразу вручную."
      )
    capture.onend = () => {
      microphone.current = null
      setListening(false)
    }
    setError("")
    try {
      capture.start()
      microphone.current = capture
      setListening(true)
    } catch {
      setError("Микрофон недоступен. Введите фразу вручную.")
    }
  }

  async function recognize(load: () => Promise<AiMeasurement>) {
    if (disabled || busy || listening) return
    setBusy(true)
    setError("")
    setSuggestion(null)
    try {
      const result = await load()
      if (!point.wastes.some(({ id }) => id === result.wasteId)) {
        setError("Не удалось определить вид отхода. Выберите его вручную.")
      } else {
        setSuggestion(result)
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось распознать запись."
      )
    } finally {
      setBusy(false)
    }
  }

  async function recognizeText() {
    const fraction = spokenFraction(transcript)
    const result = await recognizeMeasurement(
      token,
      fraction?.normalized ?? transcript.trim()
    )
    const chosenWaste = point.wastes.find(({ id }) => id === result.wasteId)
    return fraction && fraction.unit === chosenWaste?.unit
      ? { ...result, amount: fraction.amount }
      : result
  }

  return (
    <details className="rounded-xl border bg-muted/40 p-3">
      <summary className="cursor-pointer rounded-sm text-sm font-medium">
        <Sparkles
          className="mr-1.5 inline size-4 text-primary"
          aria-hidden="true"
        />
        Заполнить с ИИ
      </summary>
      <div className="mt-3 space-y-3">
        <Field>
          <FieldLabel htmlFor="ai-waste-photo" className="text-sm">
            <Camera className="size-4" aria-hidden="true" /> Фото отхода
          </FieldLabel>
          <Input
            id="ai-waste-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="h-auto min-h-11 py-2 text-sm"
            disabled={disabled || busy || listening}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ""
              if (file) void recognize(() => recognizeWastePhoto(token, file))
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ai-measurement-text" className="text-sm">
            Описание взвешивания
          </FieldLabel>
          <Textarea
            id="ai-measurement-text"
            value={transcript}
            onChange={(event) => {
              setTranscript(event.currentTarget.value)
              setSuggestion(null)
            }}
            placeholder="Например, 2 кг картона на переработку"
            maxLength={500}
            disabled={disabled || busy || listening}
            className="text-base"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {SpeechRecognition && (
            <Button
              type="button"
              variant="outline"
              className="h-11 text-sm"
              disabled={disabled || busy}
              onClick={listen}
            >
              <Mic aria-hidden="true" />{" "}
              {listening ? "Остановить" : "Продиктовать"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 text-sm"
            disabled={disabled || busy || listening || !transcript.trim()}
            onClick={() => void recognize(recognizeText)}
          >
            Разобрать описание
          </Button>
        </div>
        {busy && (
          <p role="status" className="text-sm">
            Распознаём данные…
          </p>
        )}
        {listening && (
          <p role="status" className="text-sm">
            Микрофон включён.
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {suggestion && waste && (
          <div className="space-y-2 rounded-lg bg-card p-3 text-sm">
            <p>
              <strong>Предложение:</strong> {waste.name_ru}
              {suggestion.amount !== null &&
                ` · ${suggestion.amount} ${unitLabel(waste.unit)}`}
              {disposal && ` · ${disposal.name_ru}`}
            </p>
            <Button
              type="button"
              className="h-11 text-sm"
              disabled={disabled || busy}
              onClick={() => {
                onApply(suggestion)
                setSuggestion(null)
              }}
            >
              Подставить в форму
            </Button>
          </div>
        )}
      </div>
    </details>
  )
}
