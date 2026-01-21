<script setup lang="ts">
import type { TextLine, PreviewHighlight, SearchMatch } from '@/types'
import { getLineStats } from '@/composables/useScoring'
import { useAutoResizeWithRef } from '@/composables/useAutoResize'
import { computed, ref, watch, nextTick } from 'vue'
import Segment from './Segment.vue'

const props = defineProps<{
  line: TextLine
  lineNumber?: number
  selectedSegmentId: string | null
  editMode: 'none' | 'left' | 'right'
  isTextEditMode: boolean
  shouldFocus?: boolean
  getPreviewHighlight?: (segmentId: string) => PreviewHighlight | null
  isAdjacentPreview?: (segmentId: string) => boolean
  getSearchMatches?: (segmentId: string) => SearchMatch[]
  currentSearchMatch?: SearchMatch | null
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 自動調整 textarea 高度（最小 1 行，最大 10 行）
const { resize: resizeTextarea } = useAutoResizeWithRef(textareaRef, 1, 10)

// 取得選中的 segment 資訊
function getSelectedSegment() {
  if (!props.selectedSegmentId) return null
  return props.line.segments.find((s) => s.id === props.selectedSegmentId) ?? null
}

// 聚焦並選取對應文字
function focusAndSelectText(el: HTMLTextAreaElement) {
  el.focus()
  const segment = getSelectedSegment()
  if (segment) {
    // 使用 requestAnimationFrame 確保在 focus 完成後再設定選取範圍
    requestAnimationFrame(() => {
      el.setSelectionRange(segment.startIndex, segment.endIndex)
    })
  }
}

// 當需要 focus 時，自動聚焦輸入框並選取文字
// 合併監聽 textareaRef 和 shouldFocus 的變化
watch(
  [textareaRef, () => props.shouldFocus],
  ([el, shouldFocus]) => {
    if (el && shouldFocus && props.isTextEditMode) {
      focusAndSelectText(el)
    }
  },
)

const emit = defineEmits<{
  toggleSegment: [lineId: string, segmentId: string]
  selectSegment: [lineId: string, segmentId: string]
  updateLineText: [lineId: string, newText: string]
  reParseLine: [lineId: string]
}>()

const stats = computed(() => getLineStats(props.line))

// 編輯中的文字
const editingText = ref(props.line.originalText)

// 當 line 變化時更新編輯文字並調整高度
watch(
  () => props.line.originalText,
  (newText) => {
    editingText.value = newText
    // 文字變更後調整 textarea 高度
    nextTick(() => {
      resizeTextarea()
    })
  },
)

function handleToggle(segmentId: string) {
  emit('toggleSegment', props.line.id, segmentId)
}

function handleSelect(segmentId: string) {
  emit('selectSegment', props.line.id, segmentId)
}

function handleTextChange(e: Event) {
  const target = e.target as HTMLTextAreaElement
  editingText.value = target.value
  emit('updateLineText', props.line.id, target.value)
  resizeTextarea()
}

function handleReParseLine() {
  emit('reParseLine', props.line.id)
}
</script>

<template>
  <div
    :data-line-id="line.id"
    class="marking-line flex items-start gap-4 py-2 border-b border-gray-200 transition-all duration-200"
  >
    <!-- 行號 -->
    <span
      v-if="lineNumber !== undefined"
      class="w-6 text-right text-xs text-slate-400 pt-4 shrink-0 select-none"
    >
      {{ lineNumber }}
    </span>

    <!-- 文字編輯模式 / 標記模式 切換 -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
      mode="out-in"
    >
      <!-- 文字編輯模式 -->
      <div v-if="isTextEditMode" key="edit" class="flex-1 flex items-start gap-2">
        <textarea
          ref="textareaRef"
          :value="editingText"
          rows="1"
          class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none leading-relaxed overflow-hidden"
          @input="handleTextChange"
        />
      </div>

      <!-- 標記模式 -->
      <div v-else key="mark" class="segments flex-1 flex flex-wrap items-baseline gap-1 pt-4">
        <TransitionGroup
          enter-active-class="transition-opacity duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          move-class="transition-transform duration-200 ease-out"
        >
          <Segment
            v-for="segment in line.segments"
            :key="segment.id"
            :segment="segment"
            :is-selected="segment.id === selectedSegmentId"
            :edit-mode="segment.id === selectedSegmentId ? editMode : 'none'"
            :preview-highlight="getPreviewHighlight?.(segment.id) ?? null"
            :is-adjacent-preview="isAdjacentPreview?.(segment.id) ?? false"
            :search-matches="getSearchMatches?.(segment.id)"
            :current-search-match="currentSearchMatch"
            @toggle="handleToggle"
            @select="handleSelect"
          />
        </TransitionGroup>
      </div>
    </Transition>

    <!-- 右側固定區域：重置按鈕 + 統計數字 -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- 重新判定按鈕 -->
      <button
        class="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 text-sm rounded-full hover:bg-blue-100 hover:text-blue-600 hover:rotate-180 active:bg-blue-200 transition-all duration-300"
        @click="handleReParseLine"
        title="重新判定此行（重新分詞）"
      >
        ↻
      </button>

      <!-- 統計數字：固定三位數寬度 -->
      <div class="stats flex items-center gap-1 text-sm font-mono">
        <span class="w-8 text-right text-blue-600" title="此行總詞數（不含標點）">{{
          stats.totalCount
        }}</span>
        <span class="w-10 text-right text-red-500" title="此行錯誤數">{{
          stats.errorCount > 0 ? `(${stats.errorCount})` : ''
        }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marking-line:last-child {
  border-bottom: none;
}
</style>
