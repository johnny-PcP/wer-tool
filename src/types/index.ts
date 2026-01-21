export interface Segment {
  id: string
  text: string
  isError: boolean
  isDeleted: boolean // 標記為不計入統計（無底線）
  startIndex: number
  endIndex: number
}

export interface TextLine {
  id: string
  originalText: string
  segments: Segment[]
}

export interface LineStats {
  totalCount: number
  errorCount: number
}

export interface TotalStatsData {
  totalCount: number
  errorCount: number
  correctRate: number
  errorRate: number
}

export interface Selection {
  lineId: string | null
  segmentId: string | null
}

export interface StoredState {
  lines: TextLine[]
  inputText: string
}

// 編輯模式類型
export type EditMode = 'none' | 'left' | 'right'
export type EditingMode = 'viewing' | 'wer' | 'text'

// 歷史記錄狀態
export interface HistoryState {
  lines: TextLine[]
  selectedLineId: string | null
  selectedSegmentId: string | null
}

// 搜尋匹配
export interface SearchMatch {
  lineId: string
  segmentId: string
  matchIndex: number
  matchLength: number
}

// 預覽高亮
export interface PreviewHighlight {
  char: string
  position: 'start' | 'end'
}

export interface PreviewInfo {
  currentSegmentId: string | null
  currentHighlight: PreviewHighlight | null
  adjacentSegmentId: string | null
  adjacentHighlight: PreviewHighlight | null
}
