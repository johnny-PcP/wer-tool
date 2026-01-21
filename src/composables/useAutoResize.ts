import { ref, watch, nextTick, type Ref } from 'vue'

// 計算行高
function getLineHeight(el: HTMLTextAreaElement): number {
  const computed = window.getComputedStyle(el)
  return parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5
}

// 調整 textarea 高度的核心邏輯
function resizeTextarea(el: HTMLTextAreaElement, minRows: number, maxRows?: number): void {
  const lineHeight = getLineHeight(el)
  const style = window.getComputedStyle(el)
  const paddingTop = parseFloat(style.paddingTop) || 0
  const paddingBottom = parseFloat(style.paddingBottom) || 0
  const borderTop = parseFloat(style.borderTopWidth) || 0
  const borderBottom = parseFloat(style.borderBottomWidth) || 0

  // 計算最小和最大高度
  const minHeight = lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom
  const maxHeight = maxRows
    ? lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom
    : Infinity

  // 先重置高度以獲取正確的 scrollHeight
  el.style.height = 'auto'

  // 計算新高度
  const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
  el.style.height = `${newHeight}px`

  // 如果超過最大高度，啟用捲動
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

/**
 * 自動調整 textarea 高度的 composable
 * @param minRows 最小行數（預設 1）
 * @param maxRows 最大行數（預設 無限制）
 */
export function useAutoResize(minRows = 1, maxRows?: number) {
  const textareaRef = ref<HTMLTextAreaElement | null>(null)

  function resize() {
    if (textareaRef.value) {
      resizeTextarea(textareaRef.value, minRows, maxRows)
    }
  }

  function handleInput() {
    resize()
  }

  // 當 ref 綁定後，初始化
  watch(textareaRef, (el) => {
    if (el) {
      nextTick(resize)
    }
  })

  return {
    textareaRef,
    resize,
    handleInput,
  }
}

/**
 * 為現有的 textarea ref 添加自動調整功能
 * @param existingRef 現有的 textarea ref
 * @param minRows 最小行數
 * @param maxRows 最大行數
 */
export function useAutoResizeWithRef(
  existingRef: Ref<HTMLTextAreaElement | null>,
  minRows = 1,
  maxRows?: number
) {
  function resize() {
    if (existingRef.value) {
      resizeTextarea(existingRef.value, minRows, maxRows)
    }
  }

  // 監聽 ref 變化
  watch(existingRef, (el) => {
    if (el) {
      nextTick(resize)
    }
  })

  return {
    resize,
  }
}
