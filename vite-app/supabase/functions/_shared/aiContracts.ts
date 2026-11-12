export type AiMeasure = { action: string; check: string }

export type AiAnalysis = {
  organizations: {
    id: string
    name: string
    usingHistory: boolean
    measures: AiMeasure[]
    anomalyNote: string | null
  }[]
}

export type AiMeasurement = {
  wasteId: string | null
  amount: number | null
  disposalId: string | null
}

export type PaperRow = {
  date: string
  waste: string
  unit: string
  amount: string
  disposal: string
}

export type PaperScan = { rows: PaperRow[]; incomplete: boolean }
