import type { TextLine, Selection } from '@/types'

/**
 * 選取第一個段落
 * @param lines 所有行
 * @param selection 選擇狀態物件
 */
export function selectFirstSegment(lines: TextLine[], selection: Selection): void {
  const firstLine = lines[0]
  if (firstLine && firstLine.segments.length > 0) {
    const firstSegment = firstLine.segments[0]
    if (firstSegment) {
      selection.lineId = firstLine.id
      selection.segmentId = firstSegment.id
    }
  }
}

/**
 * 選取指定行的第一個段落
 * @param line 指定的行
 * @param selection 選擇狀態物件
 */
export function selectLineFirstSegment(line: TextLine, selection: Selection): void {
  if (line.segments.length > 0) {
    const firstSegment = line.segments[0]
    if (firstSegment) {
      selection.lineId = line.id
      selection.segmentId = firstSegment.id
    }
  }
}
