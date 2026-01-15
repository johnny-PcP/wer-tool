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
  <div class="app min-h-dvh flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-slate-200">
      <div class="max-w-5xl mx-auto px-4 py-4">
        <div class="flex items-center justify-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <span class="text-white font-bold text-lg">W</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Johnny's WER Tool
            </h1>
            <p class="text-xs text-slate-500">Word Error Rate Calculator</p>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
      <!-- 輸入區 -->
      <div v-if="!isMarking" class="space-y-5">
        <!-- 說明區塊 -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <p class="font-semibold text-blue-900 mb-3">Word Error Rate (WER) 標記工具</p>
          <ul class="space-y-2 text-sm text-blue-700">
            <li>快速標記語音辨識或文字轉錄的錯誤，計算 WER</li>
            <li>大部分操作基於<strong class="text-blue-800">鍵盤快捷鍵</strong>，提升標記效率</li>
            <li>資料會自動儲存於<strong class="text-blue-800">瀏覽器本地</strong>，重新整理不會遺失</li>
          </ul>
        </div>

        <div class="bg-white rounded-xl shadow-md p-6 border border-slate-200">
          <TextInputArea :initial-text="inputText" @start-marking="handleStartMarking" @clear="handleClearAll" />
        </div>
      </div>

      <!-- 標記區 -->
      <div v-else class="space-y-4">
        <!-- 工具列 -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <!-- 快捷鍵說明 -->
            <div class="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
              <p class="flex flex-wrap items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">←</kbd>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">→</kbd>
                <span class="text-slate-500">移動</span>
                <span class="text-slate-300 mx-1">|</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">Space</kbd>
                <span class="text-slate-500">切換狀態</span>
                <span class="text-slate-300 mx-1">|</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">D</kbd>
                <span class="text-slate-500">刪除</span>
                <span class="text-slate-300 mx-1">|</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">A</kbd>
                <span class="text-slate-500">復原</span>
              </p>
              <p class="flex flex-wrap items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">Z</kbd>
                <span class="text-slate-400">+</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">←→</kbd>
                <span class="text-slate-500">調整左邊界</span>
                <span class="text-slate-300 mx-1">|</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">X</kbd>
                <span class="text-slate-400">+</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">←→</kbd>
                <span class="text-slate-500">調整右邊界</span>
                <span class="text-slate-300 mx-1">|</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">S</kbd>
                <span class="text-slate-500">分割</span>
                <span class="text-slate-300 mx-1">|</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">C</kbd>
                <span class="text-slate-500">合併</span>
              </p>
              <p class="flex flex-wrap items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">Enter</kbd>
                <span class="text-slate-500">編輯模式</span>
                <span class="text-slate-300 mx-1">|</span>
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">Esc</kbd>
                <span class="text-slate-500">離開/重置</span>
              </p>
            </div>
            <!-- 操作按鈕 -->
            <div class="flex flex-wrap gap-2">
              <button
                class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-all shadow-sm hover:shadow"
                @click="handleReParseAll"
              >
                重新判定
              </button>
              <button
                v-if="isTextEditMode"
                class="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-all shadow-sm hover:shadow"
                @click="exitTextEditMode"
              >
                離開編輯
              </button>
              <button
                v-else
                class="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-all shadow-sm hover:shadow"
                @click="enterTextEditMode"
              >
                編輯模式
              </button>
              <button
                class="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-all border border-slate-200"
                @click="handleBackToInput"
              >
                重新輸入
              </button>
            </div>
          </div>
        </div>

        <!-- 文字編輯模式提示 -->
        <div
          v-if="isTextEditMode"
          class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3"
        >
          <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-amber-900">編輯模式</p>
            <p class="text-amber-700 mt-0.5">
              可直接修改下方文字，修改後點擊「重新判定」按鈕重新分詞。按
              <kbd class="px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs font-mono">Esc</kbd>
              離開編輯模式。
            </p>
          </div>
        </div>

        <!-- 標記區域 -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
            <!-- 左側：狀態說明 -->
            <div class="flex items-center gap-4">
              <p class="text-sm text-slate-500">點擊詞彙切換狀態：</p>
              <div class="flex items-center gap-4 text-xs">
                <span class="flex items-center gap-1.5">
                  <span class="w-3 h-3 bg-blue-500 rounded"></span>
                  <span class="text-slate-600">正確</span>
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="w-3 h-3 bg-red-500 rounded"></span>
                  <span class="text-slate-600">錯誤</span>
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="w-3 h-3 bg-slate-300 rounded"></span>
                  <span class="text-slate-600">不計入</span>
                </span>
              </div>
            </div>
            <!-- 右側：批次合併 -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-slate-600">批次合併：</span>
              <input
                v-model="mergeChar"
                type="text"
                class="w-24 px-2 py-1 text-sm border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="輸入文字"
              />
              <button
                class="px-2.5 py-1 text-sm bg-violet-50 text-violet-600 font-medium rounded-lg hover:bg-violet-100 transition-colors border border-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!mergeChar.trim()"
                @click="batchMerge('left')"
              >
                ← 向左
              </button>
              <button
                class="px-2.5 py-1 text-sm bg-violet-50 text-violet-600 font-medium rounded-lg hover:bg-violet-100 transition-colors border border-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!mergeChar.trim()"
                @click="batchMerge('right')"
              >
                向右 →
              </button>
            </div>
          </div>
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
    </main>

    <!-- 頁尾版權聲明 -->
    <footer class="mt-auto py-6 border-t border-slate-200 bg-white">
      <div class="max-w-5xl mx-auto px-4 text-center">
        <p class="text-sm text-slate-500">&copy; 2025 WER Tool. All rights reserved.</p>
        <p class="text-xs text-slate-400 mt-1">
          問題回報或建議請聯繫：
          <a href="mailto:johnny_pcp@hotmail.com" class="text-blue-500 hover:text-blue-600 hover:underline transition-colors">
            johnny_pcp@hotmail.com
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
