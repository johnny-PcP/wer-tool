<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import type { TextLine, Selection } from '@/types'
import { parseText, reParseLine, resetIdCounters } from '@/composables/useTextParser'
import { useKeyboard } from '@/composables/useKeyboard'
import { useSegmentEditor } from '@/composables/useSegmentEditor'
import { useStorage } from '@/composables/useStorage'
import { useHistory } from '@/composables/useHistory'
import TextInputArea from '@/components/TextInputArea.vue'
import MarkingLine from '@/components/MarkingLine.vue'
import TotalStats from '@/components/TotalStats.vue'

const lines = ref<TextLine[]>([])
const isMarking = ref(false)
const inputText = ref('')
const isTextEditMode = ref(false)
const mergeChar = ref('')

const selection = reactive<Selection>({
  lineId: null,
  segmentId: null,
})

const storage = useStorage()
const history = useHistory()

// 儲存當前狀態到歷史記錄
function saveCurrentState(): void {
  history.saveState(lines.value, selection.lineId, selection.segmentId)
}

// 復原上一個動作
function handleUndo(): void {
  const previousState = history.undo()
  if (previousState) {
    lines.value = previousState.lines
    selection.lineId = previousState.selectedLineId
    selection.segmentId = previousState.selectedSegmentId
  }
}

// 自動儲存
watch(
  lines,
  (newLines) => {
    if (isMarking.value && newLines.length > 0) {
      storage.save(newLines, inputText.value)
    }
  },
  { deep: true },
)

// 載入儲存的狀態
onMounted(() => {
  const saved = storage.load()
  if (saved && saved.lines.length > 0) {
    lines.value = saved.lines
    inputText.value = saved.inputText
    isMarking.value = true
  }
})

// 設置 segment editor，傳入 saveCurrentState 作為 onBeforeAction
const editor = useSegmentEditor(() => lines.value, selection, saveCurrentState)

// 設置鍵盤事件
const { editMode } = useKeyboard(() => lines.value, selection, {
  onToggleError: () => editor.toggleError(),
  onDelete: () => editor.deleteSegment(),
  onExpandLeft: () => editor.expandLeft(),
  onShrinkLeft: () => editor.shrinkLeft(),
  onShrinkRight: () => editor.shrinkRight(),
  onExpandRight: () => editor.expandRight(),
  onSplit: (side) => editor.splitSegment(side),
  onUndo: () => handleUndo(),
  onMergeNext: () => editor.mergeWithNext(),
})

function handleStartMarking(text: string) {
  inputText.value = text
  lines.value = parseText(text)
  isMarking.value = true

  // 選取第一個區塊
  const firstLine = lines.value[0]
  if (firstLine && firstLine.segments.length > 0) {
    const firstSegment = firstLine.segments[0]
    if (firstSegment) {
      selection.lineId = firstLine.id
      selection.segmentId = firstSegment.id
    }
  }
}

// 重新輸入（保留文字，回到輸入畫面）
function handleBackToInput() {
  // 收集所有行編輯後的文字
  inputText.value = lines.value.map((l) => l.originalText).join('\n')
  lines.value = []
  isMarking.value = false
  isTextEditMode.value = false
  selection.lineId = null
  selection.segmentId = null
  history.clearHistory()
}

// 清除全部（清空文字和狀態）
function handleClearAll() {
  lines.value = []
  isMarking.value = false
  isTextEditMode.value = false
  inputText.value = ''
  selection.lineId = null
  selection.segmentId = null
  storage.clear()
  history.clearHistory()
}

function handleToggleSegment(lineId: string, segmentId: string) {
  const line = lines.value.find((l) => l.id === lineId)
  if (line) {
    const segment = line.segments.find((s) => s.id === segmentId)
    if (segment) {
      saveCurrentState()
      segment.isError = !segment.isError
    }
  }
}

function handleSelectSegment(lineId: string, segmentId: string) {
  selection.lineId = lineId
  selection.segmentId = segmentId
}

// 文字編輯模式
function enterTextEditMode() {
  isTextEditMode.value = true
}

function exitTextEditMode() {
  isTextEditMode.value = false
  // 離開編輯模式時，根據編輯後的文字重新生成所有行
  reParseAllFromEditedText()
}

// 從編輯後的文字重新解析全部（重設 ID）
function reParseAllFromEditedText() {
  saveCurrentState()
  // 收集所有行的 originalText 組成新的 inputText
  inputText.value = lines.value.map((l) => l.originalText).join('\n')
  // 重設 ID counter 並重新解析
  resetIdCounters()
  lines.value = parseText(inputText.value)
  // 選取第一個區塊
  const firstLine = lines.value[0]
  if (firstLine && firstLine.segments.length > 0) {
    const firstSegment = firstLine.segments[0]
    if (firstSegment) {
      selection.lineId = firstLine.id
      selection.segmentId = firstSegment.id
    }
  }
}

// 重新判定（全域）
function handleReParseAll() {
  saveCurrentState()
  lines.value = parseText(inputText.value)
  // 選取第一個區塊
  const firstLine = lines.value[0]
  if (firstLine && firstLine.segments.length > 0) {
    const firstSegment = firstLine.segments[0]
    if (firstSegment) {
      selection.lineId = firstLine.id
      selection.segmentId = firstSegment.id
    }
  }
}

// 重新判定（單行）
function handleReParseLine(lineId: string) {
  saveCurrentState()
  const lineIndex = lines.value.findIndex((l) => l.id === lineId)
  if (lineIndex === -1) return

  const line = lines.value[lineIndex]
  if (!line) return

  const newLine = reParseLine(line.originalText, line.id)
  lines.value[lineIndex] = newLine

  // 選取該行第一個區塊
  if (newLine.segments.length > 0) {
    const firstSegment = newLine.segments[0]
    if (firstSegment) {
      selection.lineId = newLine.id
      selection.segmentId = firstSegment.id
    }
  }
}

// 更新行的原始文字（文字編輯模式用）
function handleUpdateLineText(lineId: string, newText: string) {
  const line = lines.value.find((l) => l.id === lineId)
  if (line) {
    saveCurrentState()
    line.originalText = newText
  }
}

// 批次合併：將匹配的區塊向指定方向合併
function batchMerge(direction: 'left' | 'right') {
  if (!mergeChar.value.trim()) return

  const textToMerge = mergeChar.value.trim()
  let mergeCount = 0

  for (const line of lines.value) {
    // 從後往前處理，避免 index 變動問題
    for (let i = line.segments.length - 1; i >= 0; i--) {
      const segment = line.segments[i]
      if (!segment) continue

      // 檢查：匹配、未刪除、非錯誤（藍線）
      if (segment.text === textToMerge && !segment.isDeleted && !segment.isError) {
        if (direction === 'left' && i > 0) {
          // 向左合併：將此區塊加到前一個區塊
          const prevSegment = line.segments[i - 1]
          if (prevSegment) {
            // 只在第一次合併時儲存狀態
            if (mergeCount === 0) saveCurrentState()
            prevSegment.text += segment.text
            prevSegment.endIndex = segment.endIndex
            line.segments.splice(i, 1)
            mergeCount++
          }
        } else if (direction === 'right' && i < line.segments.length - 1) {
          // 向右合併：將此區塊加到後一個區塊的開頭
          const nextSegment = line.segments[i + 1]
          if (nextSegment) {
            // 只在第一次合併時儲存狀態
            if (mergeCount === 0) saveCurrentState()
            nextSegment.text = segment.text + nextSegment.text
            nextSegment.startIndex = segment.startIndex
            line.segments.splice(i, 1)
            mergeCount++
          }
        }
      }
    }
  }

  // 如果沒有找到匹配的區塊，顯示提示
  if (mergeCount === 0) {
    alert(`找不到符合條件的區塊「${textToMerge}」（需為藍線且未刪除）`)
  }
}

// 全域鍵盤事件（Enter 和 Esc）
function handleGlobalKeyDown(e: KeyboardEvent) {
  // 如果在輸入框內，不處理
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
    // 在文字編輯模式下按 Esc 離開
    if (e.key === 'Escape' && isTextEditMode.value) {
      e.preventDefault()
      exitTextEditMode()
    }
    return
  }

  // 非輸入框情況下
  if (!isMarking.value) return

  if (e.key === 'Enter') {
    e.preventDefault()
    enterTextEditMode()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (isTextEditMode.value) {
      exitTextEditMode()
    } else {
      // 重置全部 ID，修復方向鍵導航問題
      handleReParseAll()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown)
})
</script>

<template>
  <div class="app min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4">
      <h1 class="text-2xl font-bold text-gray-800 mb-6 text-center">WER Tool</h1>

      <!-- 輸入區 -->
      <div v-if="!isMarking" class="space-y-4">
        <!-- 說明區塊 -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p class="font-medium mb-2">Word Error Rate (WER) 標記工具</p>
          <ul class="list-disc list-inside space-y-1 text-blue-700">
            <li>快速標記語音辨識或文字轉錄的錯誤，計算 WER</li>
            <li>大部分操作基於<strong>鍵盤快捷鍵</strong>，提升標記效率</li>
            <li>資料會自動儲存於<strong>瀏覽器本地</strong>，重新整理不會遺失</li>
          </ul>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6">
          <TextInputArea :initial-text="inputText" @start-marking="handleStartMarking" @clear="handleClearAll" />
        </div>
      </div>

      <!-- 標記區 -->
      <div v-else class="space-y-4">
        <div class="flex justify-between items-center">
          <div class="text-xs text-gray-500 space-y-1">
            <p>
              <kbd class="px-1 bg-gray-200 rounded">←</kbd>
              <kbd class="px-1 bg-gray-200 rounded">→</kbd> 移動 |
              <kbd class="px-1 bg-gray-200 rounded">空白</kbd> 切換狀態 |
              <kbd class="px-1 bg-gray-200 rounded">D</kbd> 刪除區域 |
              <kbd class="px-1 bg-gray-200 rounded">A</kbd> 復原
            </p>
            <p>
              <kbd class="px-1 bg-gray-200 rounded">Z</kbd>+<kbd class="px-1 bg-gray-200 rounded"
                >←→</kbd
              >
              調整左邊界 |
              <kbd class="px-1 bg-gray-200 rounded">X</kbd>+<kbd class="px-1 bg-gray-200 rounded"
                >←→</kbd
              >
              調整右邊界 |
              <kbd class="px-1 bg-gray-200 rounded">S</kbd> 分割 |
              <kbd class="px-1 bg-gray-200 rounded">C</kbd> 合併下一個
            </p>
            <p>
              <kbd class="px-1 bg-gray-200 rounded">Enter</kbd> 編輯模式 |
              <kbd class="px-1 bg-gray-200 rounded">Esc</kbd> 離開編輯/重置
            </p>
          </div>
          <div class="flex gap-2">
            <button
              class="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
              @click="handleReParseAll"
            >
              重新判定全部
            </button>
            <button
              v-if="isTextEditMode"
              class="px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
              @click="exitTextEditMode"
            >
              離開編輯模式
            </button>
            <button
              v-else
              class="px-3 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition-colors"
              @click="enterTextEditMode"
            >
              編輯模式
            </button>
            <button
              class="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
              @click="handleBackToInput"
            >
              重新輸入
            </button>
          </div>
        </div>

        <!-- 批次合併工具 -->
        <div class="flex items-center gap-2 text-sm">
          <span class="text-gray-600">批次合併：</span>
          <input
            v-model="mergeChar"
            type="text"
            class="w-24 px-2 py-1 border border-gray-300 rounded text-center"
            placeholder="文字"
          />
          <button
            class="px-2 py-1 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
            :disabled="!mergeChar.trim()"
            @click="batchMerge('left')"
          >
            ← 向左
          </button>
          <button
            class="px-2 py-1 bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
            :disabled="!mergeChar.trim()"
            @click="batchMerge('right')"
          >
            向右 →
          </button>
        </div>

        <!-- 文字編輯模式提示 -->
        <div
          v-if="isTextEditMode"
          class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800"
        >
          📝 編輯模式：可直接修改下方文字，修改後點擊「重新判定」按鈕重新分詞。按
          <kbd class="px-1 bg-yellow-200 rounded">Esc</kbd> 離開編輯模式。
        </div>

        <div class="bg-white rounded-lg shadow-md p-6">
          <p class="text-sm text-gray-500 mb-4">
            點擊詞彙切換正確/錯誤狀態（藍色=正確，紅色=錯誤，灰色=不計入統計）
          </p>
          <div class="marking-area">
            <MarkingLine
              v-for="line in lines"
              :key="line.id"
              :line="line"
              :selected-segment-id="selection.lineId === line.id ? selection.segmentId : null"
              :edit-mode="selection.lineId === line.id ? editMode : 'none'"
              :is-text-edit-mode="isTextEditMode"
              @toggle-segment="handleToggleSegment"
              @select-segment="handleSelectSegment"
              @update-line-text="handleUpdateLineText"
              @re-parse-line="handleReParseLine"
            />
          </div>
        </div>

        <!-- 總計統計 -->
        <TotalStats :lines="lines" />
      </div>
    </div>

    <!-- 頁尾版權聲明 -->
    <footer class="mt-8 py-4 border-t border-gray-200 text-center text-xs text-gray-500">
      <p>&copy; 2025 WER Tool. All rights reserved.</p>
      <p class="mt-1">
        問題回報或建議請聯繫：
        <a href="mailto:johnnypcp0313@gmail.com" class="text-blue-500 hover:underline">
          johnnypcp0313@gmail.com
        </a>
      </p>
    </footer>
  </div>
</template>
