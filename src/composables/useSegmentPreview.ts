import { computed, type Ref } from 'vue'
import type { TextLine, Selection, EditMode, PreviewHighlight, PreviewInfo } from '@/types'

export function useSegmentPreview(
  getLines: () => TextLine[],
  selection: Selection,
  editMode: Ref<EditMode>
) {
  const previewInfo = computed<PreviewInfo>(() => {
    const emptyResult: PreviewInfo = {
      currentSegmentId: null,
      currentHighlight: null,
      adjacentSegmentId: null,
      adjacentHighlight: null,
    }

    if (editMode.value === 'none') {
      return emptyResult
    }

    if (!selection.lineId || !selection.segmentId) {
      return emptyResult
    }

    const lines = getLines()
    const line = lines.find((l) => l.id === selection.lineId)
    if (!line) return emptyResult

    const segmentIndex = line.segments.findIndex((s) => s.id === selection.segmentId)
    if (segmentIndex === -1) return emptyResult

    const segment = line.segments[segmentIndex]
    if (!segment || segment.text.length === 0) return emptyResult

    const prevSegment = segmentIndex > 0 ? line.segments[segmentIndex - 1] : null
    const nextSegment =
      segmentIndex < line.segments.length - 1 ? line.segments[segmentIndex + 1] : null

    // Z 按住：左邊界編輯
    // ← 會 expandLeft（從前一個取字元）
    // → 會 shrinkLeft（釋放第一個字元給前一個）
    if (editMode.value === 'left') {
      return {
        currentSegmentId: segment.id,
        currentHighlight: {
          char: segment.text[0] || '',
          position: 'start',
        },
        adjacentSegmentId: prevSegment?.id || null,
        adjacentHighlight: prevSegment
          ? {
              char: prevSegment.text.slice(-1),
              position: 'end',
            }
          : null,
      }
    }

    // X 按住：右邊界編輯
    // ← 會 shrinkRight（釋放最後字元給後一個）
    // → 會 expandRight（從後一個取字元）
    if (editMode.value === 'right') {
      return {
        currentSegmentId: segment.id,
        currentHighlight: {
          char: segment.text.slice(-1),
          position: 'end',
        },
        adjacentSegmentId: nextSegment?.id || null,
        adjacentHighlight: nextSegment
          ? {
              char: nextSegment.text[0] || '',
              position: 'start',
            }
          : null,
      }
    }

    return emptyResult
  })

  // 取得特定 segment 的預覽高亮資訊
  function getPreviewHighlight(segmentId: string): PreviewHighlight | null {
    const info = previewInfo.value
    if (info.currentSegmentId === segmentId) {
      return info.currentHighlight
    }
    if (info.adjacentSegmentId === segmentId) {
      return info.adjacentHighlight
    }
    return null
  }

  // 檢查是否為相鄰預覽區塊
  function isAdjacentPreview(segmentId: string): boolean {
    return previewInfo.value.adjacentSegmentId === segmentId
  }

  return {
    getPreviewHighlight,
    isAdjacentPreview,
  }
}
