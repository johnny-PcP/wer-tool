import type { TextLine, Selection, Segment } from '@/types'

let segmentIdCounter = 1000

function generateSegmentId(): string {
  return `seg-${++segmentIdCounter}`
}

interface SelectedSegmentInfo {
  line: TextLine
  segmentIndex: number
  segment: Segment
}

export function useSegmentEditor(
  getLines: () => TextLine[],
  selection: Selection,
  onBeforeAction?: () => void,
) {
  function getSelectedSegment(): SelectedSegmentInfo | null {
    const lines = getLines()
    const line = lines.find((l) => l.id === selection.lineId)
    if (!line) return null

    const segmentIndex = line.segments.findIndex((s) => s.id === selection.segmentId)
    if (segmentIndex === -1) return null

    const segment = line.segments[segmentIndex]
    if (!segment) return null

    return { line, segmentIndex, segment }
  }

  // Z + ← : 左邊界向左擴展（吃掉前一個區塊的字元）
  function expandLeft(): void {
    const selected = getSelectedSegment()
    if (!selected) return

    onBeforeAction?.()

    const { line, segmentIndex, segment } = selected

    if (segmentIndex > 0) {
      const prevSegment = line.segments[segmentIndex - 1]
      if (prevSegment && prevSegment.text.length > 0) {
        // 從前一個區塊取最後一個字元
        const char = prevSegment.text.slice(-1)
        prevSegment.text = prevSegment.text.slice(0, -1)
        segment.text = char + segment.text
        segment.startIndex = prevSegment.endIndex

        // 如果前一個區塊空了，移除它（文字已清空，不會重疊）
        if (prevSegment.text.length === 0) {
          line.segments.splice(segmentIndex - 1, 1)
        }
      }
    }
  }

  // Z + → : 左邊界向右縮小（釋放字元給前一個區塊）
  function shrinkLeft(): void {
    const selected = getSelectedSegment()
    if (!selected) return

    onBeforeAction?.()

    const { line, segmentIndex, segment } = selected

    if (segment.text.length <= 1) return // 至少保留一個字元

    const char = segment.text[0]
    if (!char) return

    segment.text = segment.text.slice(1)
    segment.startIndex += 1

    if (segmentIndex > 0) {
      // 加到前一個區塊
      const prevSegment = line.segments[segmentIndex - 1]
      if (prevSegment) {
        prevSegment.text += char
        prevSegment.endIndex += 1
      }
    } else {
      // 沒有前一個區塊，創建新區塊
      const newSegment: Segment = {
        id: generateSegmentId(),
        text: char,
        isError: false,
        isDeleted: false,
        startIndex: segment.startIndex - 1,
        endIndex: segment.startIndex,
      }
      line.segments.splice(0, 0, newSegment)
    }
  }

  // X + ← : 右邊界向左縮小（釋放字元給後一個區塊）
  function shrinkRight(): void {
    const selected = getSelectedSegment()
    if (!selected) return

    const { line, segmentIndex, segment } = selected

    if (segment.text.length <= 1) return // 至少保留一個字元

    onBeforeAction?.()

    const char = segment.text.slice(-1)
    segment.text = segment.text.slice(0, -1)
    segment.endIndex -= 1

    if (segmentIndex < line.segments.length - 1) {
      // 加到後一個區塊
      const nextSegment = line.segments[segmentIndex + 1]
      if (nextSegment) {
        nextSegment.text = char + nextSegment.text
        nextSegment.startIndex -= 1
      }
    } else {
      // 沒有後一個區塊，創建新區塊
      const newSegment: Segment = {
        id: generateSegmentId(),
        text: char,
        isError: false,
        isDeleted: false,
        startIndex: segment.endIndex,
        endIndex: segment.endIndex + 1,
      }
      line.segments.push(newSegment)
    }
  }

  // X + → : 右邊界向右擴展（吃掉後一個區塊的字元）
  function expandRight(): void {
    const selected = getSelectedSegment()
    if (!selected) return

    onBeforeAction?.()

    const { line, segmentIndex, segment } = selected

    if (segmentIndex < line.segments.length - 1) {
      const nextSegment = line.segments[segmentIndex + 1]
      if (nextSegment && nextSegment.text.length > 0) {
        // 從後一個區塊取第一個字元
        const char = nextSegment.text[0]
        if (char) {
          nextSegment.text = nextSegment.text.slice(1)
          segment.text += char
          segment.endIndex = nextSegment.startIndex + 1
          nextSegment.startIndex += 1

          // 如果後一個區塊空了，移除它
          if (nextSegment.text.length === 0) {
            line.segments.splice(segmentIndex + 1, 1)
          }
        }
      }
    }
  }

  // 切換區塊的「刪除」狀態（不計入統計，但文字保留）
  function deleteSegment(): void {
    const selected = getSelectedSegment()
    if (!selected) return

    onBeforeAction?.()
    selected.segment.isDeleted = !selected.segment.isDeleted
  }

  // 切換狀態：正常 → 錯誤 → 不判定 → 正常（三態循環）
  function toggleError(): void {
    const selected = getSelectedSegment()
    if (!selected) return

    onBeforeAction?.()
    const segment = selected.segment

    if (segment.isDeleted) {
      // 不判定 → 正常
      segment.isDeleted = false
      segment.isError = false
    } else if (segment.isError) {
      // 錯誤 → 不判定
      segment.isError = false
      segment.isDeleted = true
    } else {
      // 正常 → 錯誤
      segment.isError = true
    }
  }

  // C: 將當前區塊與下一個區塊合併
  function mergeWithNext(): void {
    const selected = getSelectedSegment()
    if (!selected) return

    const { line, segmentIndex, segment } = selected

    // 最後一個區塊無法向右合併
    if (segmentIndex >= line.segments.length - 1) return

    onBeforeAction?.()

    const nextSegment = line.segments[segmentIndex + 1]
    if (!nextSegment) return

    // 合併文字
    segment.text += nextSegment.text
    segment.endIndex = nextSegment.endIndex

    // 狀態繼承：任一為錯誤則合併後為錯誤
    segment.isError = segment.isError || nextSegment.isError
    // 兩者都刪除才為刪除
    segment.isDeleted = segment.isDeleted && nextSegment.isDeleted

    // 先清空被合併區塊的文字，避免移除時短暫顯示重複文字
    nextSegment.text = ''

    // 移除下一個區塊
    line.segments.splice(segmentIndex + 1, 1)
  }

  // S 分割區塊：基於 side 決定分割點
  // side = 'left' 時，從左邊分割第一個字元
  // side = 'right' 時，從右邊分割最後一個字元
  function splitSegment(side: 'left' | 'right'): void {
    const selected = getSelectedSegment()
    if (!selected) return

    const { line, segmentIndex, segment } = selected

    // 至少要有兩個字元才能分割
    if (segment.text.length < 2) return

    onBeforeAction?.()

    if (side === 'left') {
      // 從左邊分割：取出第一個字元作為新區塊
      const firstChar = segment.text[0]
      if (!firstChar) return

      const newSegment: Segment = {
        id: generateSegmentId(),
        text: firstChar,
        isError: segment.isError,
        isDeleted: segment.isDeleted,
        startIndex: segment.startIndex,
        endIndex: segment.startIndex + 1,
      }

      // 更新原區塊
      segment.text = segment.text.slice(1)
      segment.startIndex += 1

      // 插入新區塊到前面
      line.segments.splice(segmentIndex, 0, newSegment)

      // 選擇區保留在原本的區塊（不變更 selection.segmentId）
    } else {
      // 從右邊分割：取出最後一個字元作為新區塊
      const lastChar = segment.text.slice(-1)

      const newSegment: Segment = {
        id: generateSegmentId(),
        text: lastChar,
        isError: segment.isError,
        isDeleted: segment.isDeleted,
        startIndex: segment.endIndex - 1,
        endIndex: segment.endIndex,
      }

      // 更新原區塊
      segment.text = segment.text.slice(0, -1)
      segment.endIndex -= 1

      // 插入新區塊到後面
      line.segments.splice(segmentIndex + 1, 0, newSegment)

      // 選擇區保留在原本的區塊（不變更 selection.segmentId）
    }
  }

  return {
    expandLeft,
    shrinkLeft,
    shrinkRight,
    expandRight,
    deleteSegment,
    toggleError,
    splitSegment,
    mergeWithNext,
  }
}
