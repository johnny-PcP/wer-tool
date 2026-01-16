import { ref, watch, onMounted, nextTick, type Ref } from 'vue'

/**
 * 自動調整 textarea 高度的 composable
 * @param minRows 最小行數（預設 1）
 * @param maxRows 最大行數（預設 無限制）
 */
export function useAutoResize(minRows = 1, maxRows?: number) {
  const textareaRef = ref<HTMLTextAreaElement | null>(null)

  // 計算行高
  function getLineHeight(el: HTMLTextAreaElement): number {
    const computed = window.getComputedStyle(el)
    return parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5
  }

  // 調整高度
  function resize() {
    const el = textareaRef.value
    if (!el) return

    const lineHeight = getLineHeight(el)
    const paddingTop = parseFloat(window.getComputedStyle(el).paddingTop) || 0
    const paddingBottom = parseFloat(window.getComputedStyle(el).paddingBottom) || 0
    const borderTop = parseFloat(window.getComputedStyle(el).borderTopWidth) || 0
    const borderBottom = parseFloat(window.getComputedStyle(el).borderBottomWidth) || 0

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

  // 監聽 textarea 的 input 事件
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
  // 計算行高
  function getLineHeight(el: HTMLTextAreaElement): number {
    const computed = window.getComputedStyle(el)
    return parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5
  }

  // 調整高度
  function resize() {
    const el = existingRef.value
    if (!el) return

    const lineHeight = getLineHeight(el)
    const paddingTop = parseFloat(window.getComputedStyle(el).paddingTop) || 0
    const paddingBottom = parseFloat(window.getComputedStyle(el).paddingBottom) || 0
    const borderTop = parseFloat(window.getComputedStyle(el).borderTopWidth) || 0
    const borderBottom = parseFloat(window.getComputedStyle(el).borderBottomWidth) || 0

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
