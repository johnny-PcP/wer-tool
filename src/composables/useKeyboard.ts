import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { TextLine, Selection } from '@/types'

export type EditMode = 'none' | 'left' | 'right'

export function useKeyboard(
  lines: () => TextLine[],
  selection: Selection,
  callbacks: {
    onToggleError: () => void
    onDelete: () => void
    onExpandLeft: () => void
    onShrinkLeft: () => void
    onShrinkRight: () => void
    onExpandRight: () => void
    onSplit: (side: 'left' | 'right') => void
    onUndo: () => void
    onMergeNext: () => void
  },
) {
  const isZPressed = ref(false)
  const isXPressed = ref(false)
  const lastEditSide = ref<'left' | 'right'>('left')

  // 計算當前編輯模式
  const editMode = computed<EditMode>(() => {
    if (isZPressed.value) return 'left'
    if (isXPressed.value) return 'right'
    return 'none'
  })

  function getSelectionIndices(): { lineIndex: number; segmentIndex: number } {
    const linesArr = lines()
    const lineIndex = linesArr.findIndex((l) => l.id === selection.lineId)
    if (lineIndex === -1) return { lineIndex: -1, segmentIndex: -1 }

    const line = linesArr[lineIndex]
    if (!line) return { lineIndex: -1, segmentIndex: -1 }

    const segmentIndex = line.segments.findIndex((s) => s.id === selection.segmentId)
    return { lineIndex, segmentIndex }
  }

  function selectSegment(lineIndex: number, segmentIndex: number): void {
    const linesArr = lines()
    if (lineIndex < 0 || lineIndex >= linesArr.length) return

    const line = linesArr[lineIndex]
    if (!line) return
    if (segmentIndex < 0 || segmentIndex >= line.segments.length) return

    const segment = line.segments[segmentIndex]
    if (!segment) return

    selection.lineId = line.id
    selection.segmentId = segment.id
  }

  // 根據 segment ID 選取（用於視覺導航）
  function selectSegmentById(segmentId: string): void {
    const linesArr = lines()
    for (const line of linesArr) {
      const segment = line.segments.find((s) => s.id === segmentId)
      if (segment) {
        selection.lineId = line.id
        selection.segmentId = segment.id
        return
      }
    }
  }

  // 找到視覺上最近的 segment（用於 ↑↓ 導航）
  // 策略：先找到「下一個視覺行」的 Y 座標範圍，再在該行中找 X 最接近的
  function findVisuallyClosestSegment(direction: 'up' | 'down'): string | null {
    if (!selection.segmentId) return null

    const currentEl = document.querySelector(`[data-segment-id="${selection.segmentId}"]`)
    if (!currentEl) return null

    const currentRect = currentEl.getBoundingClientRect()
    const currentCenterX = currentRect.left + currentRect.width / 2
    const currentTop = currentRect.top
    const currentBottom = currentRect.bottom

    const allSegments = document.querySelectorAll('[data-segment-id]')

    // 收集所有在目標方向的候選元素
    const candidates: Array<{ id: string; rect: DOMRect; centerX: number; centerY: number }> = []

    allSegments.forEach((el) => {
      const id = el.getAttribute('data-segment-id')
      if (!id || id === selection.segmentId) return

      const rect = el.getBoundingClientRect()
      const centerY = rect.top + rect.height / 2

      // 判斷是否在目標方向
      // ↓：元素的頂部要在當前元素底部之下（允許一點重疊容差）
      // ↑：元素的底部要在當前元素頂部之上
      const isValidDirection =
        direction === 'down'
          ? rect.top > currentBottom - 5
          : rect.bottom < currentTop + 5

      if (isValidDirection) {
        candidates.push({
          id,
          rect,
          centerX: rect.left + rect.width / 2,
          centerY,
        })
      }
    })

    if (candidates.length === 0) return null

    // 找到最近的「視覺行」的 Y 座標
    // 對於 ↓，找 centerY 最小的（最近的下一行）
    // 對於 ↑，找 centerY 最大的（最近的上一行）
    let targetY: number
    if (direction === 'down') {
      targetY = Math.min(...candidates.map((c) => c.centerY))
    } else {
      targetY = Math.max(...candidates.map((c) => c.centerY))
    }

    // 篩選出在同一視覺行的元素（Y 座標相近的）
    const rowThreshold = currentRect.height * 0.8
    const rowCandidates = candidates.filter(
      (c) => Math.abs(c.centerY - targetY) < rowThreshold
    )

    if (rowCandidates.length === 0) return null

    // 在該行中找 X 座標最接近的
    let bestId: string | null = null
    let bestXDistance = Infinity

    for (const candidate of rowCandidates) {
      const xDistance = Math.abs(candidate.centerX - currentCenterX)
      if (xDistance < bestXDistance) {
        bestXDistance = xDistance
        bestId = candidate.id
      }
    }

    return bestId
  }

  function moveLeft(): void {
    const linesArr = lines()
    const { lineIndex, segmentIndex } = getSelectionIndices()

    if (lineIndex === -1) {
      // 沒有選取時，選取第一行第一個
      const firstLine = linesArr[0]
      if (firstLine && firstLine.segments.length > 0) {
        selectSegment(0, 0)
      }
      return
    }

    if (segmentIndex > 0) {
      selectSegment(lineIndex, segmentIndex - 1)
    } else if (lineIndex > 0) {
      // 跳到上一行最後一個
      const prevLine = linesArr[lineIndex - 1]
      if (prevLine) {
        selectSegment(lineIndex - 1, prevLine.segments.length - 1)
      }
    }
  }

  function moveRight(): void {
    const linesArr = lines()
    const { lineIndex, segmentIndex } = getSelectionIndices()

    if (lineIndex === -1) {
      const firstLine = linesArr[0]
      if (firstLine && firstLine.segments.length > 0) {
        selectSegment(0, 0)
      }
      return
    }

    const line = linesArr[lineIndex]
    if (!line) return

    if (segmentIndex < line.segments.length - 1) {
      selectSegment(lineIndex, segmentIndex + 1)
    } else if (lineIndex < linesArr.length - 1) {
      // 跳到下一行第一個
      selectSegment(lineIndex + 1, 0)
    }
  }

  function moveUp(): void {
    const linesArr = lines()

    // 如果沒有選取，選取第一個
    if (!selection.segmentId) {
      const firstLine = linesArr[0]
      if (firstLine && firstLine.segments.length > 0) {
        selectSegment(0, 0)
      }
      return
    }

    // 使用視覺導航找到上方最近的 segment
    const targetId = findVisuallyClosestSegment('up')
    if (targetId) {
      selectSegmentById(targetId)
    } else {
      // Fallback: 視覺導航失敗時，使用邏輯導航（跳到上一行）
      const { lineIndex } = getSelectionIndices()
      if (lineIndex > 0) {
        const prevLine = linesArr[lineIndex - 1]
        if (prevLine && prevLine.segments.length > 0) {
          selectSegment(lineIndex - 1, 0)
        }
      }
    }
  }

  function moveDown(): void {
    const linesArr = lines()

    // 如果沒有選取，選取第一個
    if (!selection.segmentId) {
      const firstLine = linesArr[0]
      if (firstLine && firstLine.segments.length > 0) {
        selectSegment(0, 0)
      }
      return
    }

    // 使用視覺導航找到下方最近的 segment
    const targetId = findVisuallyClosestSegment('down')
    if (targetId) {
      selectSegmentById(targetId)
    } else {
      // Fallback: 視覺導航失敗時，使用邏輯導航（跳到下一行）
      const { lineIndex } = getSelectionIndices()
      if (lineIndex !== -1 && lineIndex < linesArr.length - 1) {
        const nextLine = linesArr[lineIndex + 1]
        if (nextLine && nextLine.segments.length > 0) {
          selectSegment(lineIndex + 1, 0)
        }
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    // 忽略輸入框內的按鍵
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
      return
    }

    // 追蹤 Z/X 按鍵狀態
    if (e.key === 'z' || e.key === 'Z') {
      isZPressed.value = true
      lastEditSide.value = 'left'
    }
    if (e.key === 'x' || e.key === 'X') {
      isXPressed.value = true
      lastEditSide.value = 'right'
    }

    // 方向鍵處理
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (isZPressed.value) {
        callbacks.onExpandLeft()
      } else if (isXPressed.value) {
        callbacks.onShrinkRight()
      } else {
        moveLeft()
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (isZPressed.value) {
        callbacks.onShrinkLeft()
      } else if (isXPressed.value) {
        callbacks.onExpandRight()
      } else {
        moveRight()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveUp()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveDown()
    }

    // 空白鍵切換錯誤狀態
    if (e.key === ' ') {
      e.preventDefault()
      callbacks.onToggleError()
    }

    // D 或 Backspace 刪除
    if (e.key === 'd' || e.key === 'D' || e.key === 'Backspace') {
      e.preventDefault()
      callbacks.onDelete()
    }

    // S 分割區塊
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault()
      callbacks.onSplit(lastEditSide.value)
    }

    // A 復原上一個動作
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault()
      callbacks.onUndo()
    }

    // C 合併當前區塊與下一個區塊
    if (e.key === 'c' || e.key === 'C') {
      e.preventDefault()
      callbacks.onMergeNext()
    }
  }

  function handleKeyUp(e: KeyboardEvent): void {
    if (e.key === 'z' || e.key === 'Z') {
      isZPressed.value = false
    }
    if (e.key === 'x' || e.key === 'X') {
      isXPressed.value = false
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  })

  return {
    isZPressed,
    isXPressed,
    editMode,
    lastEditSide,
  }
}
