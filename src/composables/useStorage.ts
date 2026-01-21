import { ref } from 'vue'
import type { TextLine, StoredState } from '@/types'

const STORAGE_KEY = 'wer-marking-state'

// 儲存失敗狀態（可用於 UI 顯示）
const saveError = ref<string | null>(null)

export function useStorage() {
  function save(lines: TextLine[], inputText: string): boolean {
    const state: StoredState = {
      lines,
      inputText,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      saveError.value = null
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤'
      saveError.value = `儲存失敗: ${errorMessage}`
      console.warn('Failed to save to localStorage:', error)
      // 檢查是否為配額超限
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        saveError.value = '儲存空間已滿，請清除部分資料'
      }
      return false
    }
  }

  function load(): StoredState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as StoredState
      }
    } catch {
      console.warn('Failed to load from localStorage')
    }
    return null
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      console.warn('Failed to clear localStorage')
    }
  }

  function hasSavedState(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null
  }

  return {
    save,
    load,
    clear,
    hasSavedState,
    saveError,
  }
}
