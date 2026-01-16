<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { TextLine, Selection } from '@/types'
import { parseText, reParseLine, resetIdCounters, reassignIds } from '@/composables/useTextParser'
import { useKeyboard } from '@/composables/useKeyboard'
import { useSegmentEditor } from '@/composables/useSegmentEditor'
import { useSegmentPreview } from '@/composables/useSegmentPreview'
import { useSearch } from '@/composables/useSearch'
import { useStorage } from '@/composables/useStorage'
import { useHistory } from '@/composables/useHistory'
import TextInputArea from '@/components/TextInputArea.vue'
import MarkingLine from '@/components/MarkingLine.vue'
import TotalStats from '@/components/TotalStats.vue'
import SearchBar from '@/components/SearchBar.vue'

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

// 設置邊界調整預覽
const { getPreviewHighlight, isAdjacentPreview } = useSegmentPreview(
  () => lines.value,
  selection,
  editMode,
)

// 設置搜尋功能
const search = useSearch(() => lines.value)

// 當前搜尋匹配變化時自動選取並滾動
watch(
  () => search.currentMatch.value,
  (match) => {
    if (match) {
      selection.lineId = match.lineId
      selection.segmentId = match.segmentId
      nextTick(() => {
        const el = document.querySelector(`[data-segment-id="${match.segmentId}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  },
)

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
      // 三態循環：正常 → 錯誤 → 不判定 → 正常
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

// 重新判定（全域）- 會重置所有標記！
function handleReParseAll() {
  if (!confirm('重新判定會重置所有標記，確定要繼續嗎？')) {
    return
  }
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

// 重置排列（保留標記狀態，修復方向鍵導航問題）
function handleReassignIds() {
  // 記住當前選中的位置（索引）
  const currentLineIndex = lines.value.findIndex(l => l.id === selection.lineId)
  const currentLine = lines.value[currentLineIndex]
  const currentSegmentIndex = currentLine
    ? currentLine.segments.findIndex(s => s.id === selection.segmentId)
    : -1

  reassignIds(lines.value)

  // 用相同的索引位置更新選擇，保持選擇器在當前段落
  const newLine = lines.value[currentLineIndex >= 0 ? currentLineIndex : 0]
  if (newLine) {
    selection.lineId = newLine.id
    const newSegment = newLine.segments[currentSegmentIndex >= 0 ? currentSegmentIndex : 0] || newLine.segments[0]
    if (newSegment) {
      selection.segmentId = newSegment.id
    }
  }
}

// 重新判定（單行，支援換行分割成多行）
function handleReParseLine(lineId: string) {
  saveCurrentState()
  const lineIndex = lines.value.findIndex((l) => l.id === lineId)
  if (lineIndex === -1) return

  const line = lines.value[lineIndex]
  if (!line) return

  const text = line.originalText

  // 檢查是否包含換行符
  if (text.includes('\n')) {
    // 分割成多行
    const lineTexts = text.split('\n').filter(t => t.trim() !== '')

    if (lineTexts.length === 0) {
      // 如果分割後全是空行，直接刪除此行
      lines.value.splice(lineIndex, 1)
      // 選取前一行或下一行
      const newSelectedLine = lines.value[lineIndex] || lines.value[lineIndex - 1]
      if (newSelectedLine && newSelectedLine.segments.length > 0) {
        selection.lineId = newSelectedLine.id
        selection.segmentId = newSelectedLine.segments[0]?.id ?? null
      }
      return
    }

    // 創建新的行（第一行保留原 ID）
    const newLines = lineTexts.map((lineText, i) =>
      reParseLine(lineText, i === 0 ? line.id : undefined)
    )

    // 替換原來的行
    lines.value.splice(lineIndex, 1, ...newLines)

    // 選取第一行的第一個區塊
    const firstNewLine = newLines[0]
    if (firstNewLine && firstNewLine.segments.length > 0) {
      selection.lineId = firstNewLine.id
      selection.segmentId = firstNewLine.segments[0]?.id ?? null
    }
  } else {
    // 沒有換行符，正常重新解析
    const newLine = reParseLine(text, line.id)
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

// 全域鍵盤事件（Enter、Esc 和 Ctrl+F）
function handleGlobalKeyDown(e: KeyboardEvent) {
  // Ctrl+F 或 Cmd+F 開啟搜尋（在標記模式下）
  if ((e.ctrlKey || e.metaKey) && e.key === 'f' && isMarking.value) {
    e.preventDefault()
    search.openSearch()
    return
  }

  // 如果在輸入框內，不處理
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
    // 在文字編輯模式下按 Esc 離開
    if (e.key === 'Escape' && isTextEditMode.value) {
      e.preventDefault()
      exitTextEditMode()
    }
    // 在搜尋框按 Esc 關閉搜尋
    if (e.key === 'Escape' && search.isSearchOpen.value) {
      e.preventDefault()
      search.closeSearch()
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
    if (search.isSearchOpen.value) {
      search.closeSearch()
    } else if (isTextEditMode.value) {
      exitTextEditMode()
    }
  } else if (e.key === 'r' || e.key === 'R') {
    // 重置排列（保留標記狀態，修復方向鍵導航問題）
    e.preventDefault()
    handleReassignIds()
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
    <!-- Header (sticky) -->
    <header class="sticky top-0 z-50 bg-white shadow-sm border-b border-slate-200">
      <div class="max-w-5xl mx-auto px-4 py-3">
        <div class="flex items-center justify-center gap-3">
          <div
            class="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md"
          >
            <span class="text-white font-bold text-base">W</span>
          </div>
          <div>
            <h1
              class="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
            >
              Johnny's WER Tool
            </h1>
            <p class="text-xs text-slate-500">Word Error Rate Calculator</p>
          </div>
        </div>
      </div>
    </header>

    <!-- 搜尋列 -->
    <SearchBar
      :is-open="search.isSearchOpen.value"
      :search-status="search.searchStatus.value"
      :case-sensitive="search.caseSensitive.value"
      @update:model-value="search.searchQuery.value = $event"
      @update:case-sensitive="search.caseSensitive.value = $event"
      @next="search.nextMatch()"
      @prev="search.prevMatch()"
      @close="search.closeSearch()"
    />

    <main class="flex-1 max-w-5xl 2xl:max-w-7xl w-full mx-auto px-4 py-6">
      <!-- 輸入區 -->
      <Transition
        enter-active-class="transition-all duration-400 ease-out"
        enter-from-class="opacity-0 translate-y-3"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-250 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-3"
        mode="out-in"
      >
      <div v-if="!isMarking" key="input" class="space-y-5">
        <!-- 說明區塊 -->
        <div
          class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm"
        >
          <p class="font-semibold text-blue-900 mb-3">Word Error Rate (WER) 標記工具</p>
          <ul class="space-y-2 text-sm text-blue-700">
            <li>快速標記語音辨識或文字轉錄的錯誤，計算 WER</li>
            <li>大部分操作基於<strong class="text-blue-800">鍵盤快捷鍵</strong>，提升標記效率</li>
            <li>
              資料會自動儲存於<strong class="text-blue-800">瀏覽器本地</strong>，重新整理不會遺失
            </li>
          </ul>
        </div>

        <div class="bg-white rounded-xl shadow-md p-6 border border-slate-200">
          <TextInputArea
            :initial-text="inputText"
            @start-marking="handleStartMarking"
            @clear="handleClearAll"
          />
        </div>
      </div>

      <!-- 標記區（大尺寸三欄佈局） -->
      <div v-else key="marking" class="2xl:flex 2xl:gap-4">
        <!-- 左側：快捷鍵說明（大尺寸時固定） -->
        <aside class="hidden 2xl:block 2xl:w-48 2xl:shrink-0">
          <div class="sticky top-20 space-y-2 text-xs text-slate-600">
            <p class="font-medium text-slate-700 mb-2">快捷鍵</p>
            <div class="space-y-1.5">
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >↑↓←→</kbd
                >
                <span class="text-slate-500">移動</span>
              </p>
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >Space</kbd
                >
                <span class="text-slate-500">切換狀態</span>
              </p>
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >D</kbd
                >
                <span class="text-slate-500">刪除</span>
              </p>
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >A</kbd
                >
                <span class="text-slate-500">復原</span>
              </p>
            </div>
            <div class="pt-2 border-t border-slate-200 space-y-1.5">
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >Z</kbd
                >
                <span class="text-slate-400">+</span>
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >←→</kbd
                >
              </p>
              <p class="text-slate-500 pl-1">調整左邊界</p>
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >X</kbd
                >
                <span class="text-slate-400">+</span>
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >←→</kbd
                >
              </p>
              <p class="text-slate-500 pl-1">調整右邊界</p>
              <p class="flex items-center gap-1.5 mt-2">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >C</kbd
                >
                <span class="text-slate-500">快速向右合併</span>
              </p>
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >S</kbd
                >
                <span class="text-slate-500">分割邊界</span>
              </p>
            </div>
            <div class="pt-2 border-t border-slate-200 space-y-1.5">
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >Enter</kbd
                >
                <span class="text-slate-500">編輯模式</span>
              </p>
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >Esc</kbd
                >
                <span class="text-slate-500">離開</span>
              </p>
              <p class="flex items-center gap-1.5">
                <kbd
                  class="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono"
                  >R</kbd
                >
                <span class="text-slate-500">重置排列</span>
              </p>
            </div>
          </div>
        </aside>

        <!-- 中間：主要內容區 -->
        <div class="flex-1 space-y-4">
          <!-- 小尺寸工具列 -->
          <div class="2xl:hidden bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-2.5">
            <!-- 快捷鍵說明 -->
            <div class="text-xs text-slate-600 space-y-0.5">
              <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">↑↓←→</kbd>
                  <span class="text-slate-500">移動</span>
                </span>
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">Space</kbd>
                  <span class="text-slate-500">切換</span>
                </span>
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">D</kbd>
                  <span class="text-slate-500">刪除</span>
                </span>
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">A</kbd>
                  <span class="text-slate-500">復原</span>
                </span>
                <span class="inline-flex items-center gap-0.5">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">Z</kbd>
                  <span class="text-slate-400">+</span>
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">←→</kbd>
                  <span class="text-slate-500 ml-0.5">左邊界</span>
                </span>
                <span class="inline-flex items-center gap-0.5">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">X</kbd>
                  <span class="text-slate-400">+</span>
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">←→</kbd>
                  <span class="text-slate-500 ml-0.5">右邊界</span>
                </span>
              </p>
              <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">C</kbd>
                  <span class="text-slate-500">合併</span>
                </span>
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">S</kbd>
                  <span class="text-slate-500">分割</span>
                </span>
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">Enter</kbd>
                  <span class="text-slate-500">編輯</span>
                </span>
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">Esc</kbd>
                  <span class="text-slate-500">離開</span>
                </span>
                <span class="inline-flex items-center gap-1">
                  <kbd class="px-1 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono">R</kbd>
                  <span class="text-slate-500">重置排列</span>
                </span>
              </p>
            </div>
            <!-- 操作按鈕（水平排列） -->
            <div class="flex flex-wrap gap-2">
              <button
                class="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 active:opacity-80 transition-all duration-200 shadow-sm hover:shadow"
                title="重新分詞並重置所有標記（警告：會清除目前的標記）"
                @click="handleReParseAll"
              >
                重新判定
              </button>
              <button
                v-if="isTextEditMode"
                class="px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 active:opacity-80 transition-all duration-200 shadow-sm hover:shadow"
                title="離開文字編輯模式，返回標記模式"
                @click="exitTextEditMode"
              >
                離開編輯
              </button>
              <button
                v-else
                class="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 active:opacity-80 transition-all duration-200 shadow-sm hover:shadow"
                title="進入文字編輯模式，可修改原始文字"
                @click="enterTextEditMode"
              >
                編輯模式
              </button>
              <button
                class="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 active:opacity-80 transition-all duration-200 border border-slate-200"
                title="返回文字輸入畫面，保留目前文字內容"
                @click="handleBackToInput"
              >
                重新輸入
              </button>
            </div>
          </div>

          <!-- 文字編輯模式提示 -->
          <Transition
            enter-active-class="transition-all duration-250 ease-out"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2"
          >
          <div
            v-if="isTextEditMode"
            class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3"
          >
            <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <svg
                class="w-5 h-5 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <div>
              <p class="font-medium text-amber-900">編輯模式</p>
              <p class="text-amber-700 mt-0.5">
                可直接修改下方文字，修改後點擊「重新判定」按鈕重新分詞。按
                <kbd
                  class="px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs font-mono"
                  >Esc</kbd
                >
                離開編輯模式。
              </p>
            </div>
          </div>
          </Transition>

          <!-- 標記區域 -->
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div
              class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100"
            >
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
                <span class="text-sm text-slate-600">批次合併邊界：</span>
                <input
                  v-model="mergeChar"
                  type="text"
                  class="w-24 px-2 py-1 text-sm border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="輸入文字"
                  title="輸入要邊界的文字（如「請」、「的」）"
                />
                <button
                  class="px-2.5 py-1 text-sm bg-violet-50 text-violet-600 font-medium rounded-lg hover:bg-violet-100 hover:-translate-x-0.5 active:opacity-80 transition-all duration-200 border border-violet-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0"
                  :disabled="!mergeChar.trim()"
                  title="將所有匹配的文字合併到前一個區塊"
                  @click="batchMerge('left')"
                >
                  ← 向左
                </button>
                <button
                  class="px-2.5 py-1 text-sm bg-violet-50 text-violet-600 font-medium rounded-lg hover:bg-violet-100 hover:translate-x-0.5 active:opacity-80 transition-all duration-200 border border-violet-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0"
                  :disabled="!mergeChar.trim()"
                  title="將所有匹配的文字合併到後一個區塊"
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
                :should-focus="isTextEditMode && selection.lineId === line.id"
                :get-preview-highlight="
                  selection.lineId === line.id ? getPreviewHighlight : undefined
                "
                :is-adjacent-preview="selection.lineId === line.id ? isAdjacentPreview : undefined"
                :get-search-matches="
                  search.isSearchOpen.value ? search.getSegmentMatches : undefined
                "
                :current-search-match="search.currentMatch.value"
                @toggle-segment="handleToggleSegment"
                @select-segment="handleSelectSegment"
                @update-line-text="handleUpdateLineText"
                @re-parse-line="handleReParseLine"
              />
            </div>
          </div>

          <!-- 總計統計（小尺寸時顯示在下方） -->
          <div class="2xl:hidden">
            <TotalStats :lines="lines" />
          </div>
        </div>

        <!-- 右側：操作按鈕（大尺寸時固定） -->
        <aside class="hidden 2xl:block 2xl:w-32 2xl:shrink-0">
          <div class="sticky top-20 space-y-2">
            <p class="font-medium text-slate-700 text-xs mb-2">操作</p>
            <button
              class="w-full px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 active:opacity-80 transition-all duration-200 shadow-sm hover:shadow"
              title="重新分詞並重置所有標記（警告：會清除目前的標記）"
              @click="handleReParseAll"
            >
              重新判定
            </button>
            <button
              v-if="isTextEditMode"
              class="w-full px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 active:opacity-80 transition-all duration-200 shadow-sm hover:shadow flex flex-col items-center leading-tight"
              title="離開文字編輯模式，返回標記模式"
              @click="exitTextEditMode"
            >
              <span>離開編輯</span>
              <span class="text-[10px] opacity-75">(Esc)</span>
            </button>
            <button
              v-else
              class="w-full px-3 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 active:opacity-80 transition-all duration-200 shadow-sm hover:shadow flex flex-col items-center leading-tight"
              title="進入文字編輯模式，可修改原始文字"
              @click="enterTextEditMode"
            >
              <span>編輯模式</span>
              <span class="text-[10px] opacity-75">(Enter)</span>
            </button>
            <button
              class="w-full px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 active:opacity-80 transition-all duration-200 border border-slate-200"
              title="返回文字輸入畫面，保留目前文字內容"
              @click="handleBackToInput"
            >
              重新輸入
            </button>

            <!-- 統計數據（大尺寸時顯示在操作下方） -->
            <div class="pt-3 mt-3 border-t border-slate-200 space-y-2">
              <p class="font-medium text-slate-700 text-xs mb-2">統計</p>
              <TotalStats :lines="lines" layout="vertical" />
            </div>
          </div>
        </aside>
      </div>
      </Transition>
    </main>

    <!-- 頁尾版權聲明 -->
    <footer class="mt-auto py-6 border-t border-slate-200 bg-white">
      <div class="max-w-5xl mx-auto px-4 text-center">
        <p class="text-sm text-slate-500">&copy; 2025 WER Tool. All rights reserved.</p>
        <p class="text-xs text-slate-400 mt-1">
          問題回報或建議請聯繫：
          <a
            href="mailto:johnny_pcp@hotmail.com"
            class="text-blue-500 hover:text-blue-600 hover:underline transition-colors"
          >
            johnny_pcp@hotmail.com
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
