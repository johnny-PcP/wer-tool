<script setup lang="ts">
import type { TextLine } from '@/types'
import { getLineStats } from '@/composables/useScoring'
import { computed, ref, watch } from 'vue'
import Segment from './Segment.vue'

const props = defineProps<{
  line: TextLine
  selectedSegmentId: string | null
  editMode: 'none' | 'left' | 'right'
  isTextEditMode: boolean
}>()

const emit = defineEmits<{
  toggleSegment: [lineId: string, segmentId: string]
  selectSegment: [lineId: string, segmentId: string]
  updateLineText: [lineId: string, newText: string]
  reParseLine: [lineId: string]
}>()

const stats = computed(() => getLineStats(props.line))

// 編輯中的文字
const editingText = ref(props.line.originalText)

// 當 line 變化時更新編輯文字
watch(
  () => props.line.originalText,
  (newText) => {
    editingText.value = newText
  },
)

function handleToggle(segmentId: string) {
  emit('toggleSegment', props.line.id, segmentId)
}

function handleSelect(segmentId: string) {
  emit('selectSegment', props.line.id, segmentId)
}

function handleTextChange(e: Event) {
  const target = e.target as HTMLInputElement
  editingText.value = target.value
  emit('updateLineText', props.line.id, target.value)
}

function handleReParseLine() {
  emit('reParseLine', props.line.id)
}
</script>

<template>
  <div class="marking-line flex items-baseline gap-4 py-2 border-b border-gray-200">
    <!-- 文字編輯模式 -->
    <template v-if="isTextEditMode">
      <div class="flex-1 flex items-center gap-2">
        <input
          type="text"
          :value="editingText"
          class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          @input="handleTextChange"
        />
      </div>
    </template>

    <!-- 標記模式 -->
    <template v-else>
      <div class="segments flex-1 flex flex-wrap items-baseline gap-1 pt-4">
        <Segment
          v-for="segment in line.segments"
          :key="segment.id"
          :segment="segment"
          :is-selected="segment.id === selectedSegmentId"
          :edit-mode="segment.id === selectedSegmentId ? editMode : 'none'"
          @toggle="handleToggle"
          @select="handleSelect"
        />
      </div>
    </template>

    <!-- 右側固定區域：重置按鈕 + 統計數字 -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- 重新判定按鈕 -->
      <button
        class="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 text-sm rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors"
        @click="handleReParseLine"
        title="重新判定此行（重新分詞）"
      >
        ↻
      </button>

      <!-- 統計數字：固定三位數寬度 -->
      <div class="stats flex items-center gap-1 text-sm font-mono">
        <span
          class="w-8 text-right text-blue-600"
          title="此行總詞數（不含標點）"
        >{{ stats.totalCount }}</span>
        <span
          class="w-10 text-right text-red-500"
          title="此行錯誤數"
        >{{ stats.errorCount > 0 ? `(${stats.errorCount})` : '' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marking-line:last-child {
  border-bottom: none;
}
</style>
