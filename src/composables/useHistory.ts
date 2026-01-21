import { ref } from 'vue'
import type { TextLine, HistoryState } from '@/types'

const MAX_HISTORY_SIZE = 50

export function useHistory() {
  const history = ref<HistoryState[]>([])

  // 深拷貝 lines 陣列（帶錯誤處理）
  function cloneLines(lines: TextLine[]): TextLine[] {
    try {
      return JSON.parse(JSON.stringify(lines))
    } catch (error) {
      console.error('Failed to clone lines for history:', error)
      // 回傳空陣列避免應用崩潰
      return []
    }
  }

  // 儲存當前狀態到歷史記錄
  function saveState(
    lines: TextLine[],
    selectedLineId: string | null,
    selectedSegmentId: string | null,
  ): void {
    const clonedLines = cloneLines(lines)
    // 如果深拷貝失敗（回傳空陣列），不儲存此狀態
    if (clonedLines.length === 0 && lines.length > 0) {
      return
    }

    const state: HistoryState = {
      lines: clonedLines,
      selectedLineId,
      selectedSegmentId,
    }

    history.value.push(state)

    // 限制歷史記錄數量
    if (history.value.length > MAX_HISTORY_SIZE) {
      history.value.shift()
    }
  }

  // 復原到上一個狀態
  function undo(): HistoryState | null {
    if (history.value.length === 0) {
      return null
    }

    return history.value.pop() || null
  }

  // 清除歷史記錄
  function clearHistory(): void {
    history.value = []
  }

  return {
    saveState,
    undo,
    clearHistory,
  }
}
