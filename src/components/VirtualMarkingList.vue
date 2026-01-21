<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { TextLine, PreviewHighlight, SearchMatch } from '@/types'
import MarkingLine from './MarkingLine.vue'

const props = defineProps<{
  lines: TextLine[]
  selectedLineId: string | null
  selectedSegmentId: string | null
  editMode: 'none' | 'left' | 'right'
  editingMode: 'viewing' | 'wer' | 'text'
  isTextEditMode: boolean
  getPreviewHighlight?: (segmentId: string) => PreviewHighlight | null
  isAdjacentPreview?: (segmentId: string) => boolean
  getSearchMatches?: (segmentId: string) => SearchMatch[]
  currentSearchMatch?: SearchMatch | null
}>()

const emit = defineEmits<{
  toggleSegment: [lineId: string, segmentId: string]
  selectSegment: [lineId: string, segmentId: string]
  updateLineText: [lineId: string, newText: string]
  reParseLine: [lineId: string]
}>()

const parentRef = ref<HTMLElement | null>(null)

// 估計每行高度（根據段落數量動態調整）
const estimateSize = (index: number) => {
  const line = props.lines[index]
  if (!line) return 60
  // 基礎高度 + 每 20 個段落增加一點高度（考慮換行）
  const segmentCount = line.segments.length
  return Math.max(60, 40 + Math.ceil(segmentCount / 10) * 20)
}

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.lines.length,
    getScrollElement: () => parentRef.value,
    estimateSize,
    overscan: 5, // 預渲染上下各 5 行
  }))
)

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

// 當選中的行變化時，滾動到該行
watch(
  () => props.selectedLineId,
  (lineId) => {
    if (!lineId) return
    const index = props.lines.findIndex((l) => l.id === lineId)
    if (index !== -1) {
      virtualizer.value.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
    }
  },
)

// 搜尋結果變化時，確保目標行可見
watch(
  () => props.currentSearchMatch,
  (match) => {
    if (!match) return
    const index = props.lines.findIndex((l) => l.id === match.lineId)
    if (index !== -1) {
      nextTick(() => {
        virtualizer.value.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
      })
    }
  },
)

// 暴露 scrollToIndex 方法供外部使用
defineExpose({
  scrollToIndex: (index: number) => {
    virtualizer.value.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
  },
})
</script>

<template>
  <div
    ref="parentRef"
    class="virtual-marking-list overflow-auto"
    style="max-height: 70vh"
  >
    <div
      class="relative w-full"
      :style="{ height: `${totalSize}px` }"
    >
      <div
        v-for="virtualRow in virtualItems"
        :key="String(virtualRow.key)"
        class="absolute top-0 left-0 w-full"
        :style="{
          transform: `translateY(${virtualRow.start}px)`,
        }"
        :data-index="virtualRow.index"
      >
        <MarkingLine
          :line="lines[virtualRow.index]!"
          :selected-segment-id="
            editingMode !== 'viewing' && selectedLineId === lines[virtualRow.index]?.id
              ? selectedSegmentId
              : null
          "
          :edit-mode="
            editingMode !== 'viewing' && selectedLineId === lines[virtualRow.index]?.id
              ? editMode
              : 'none'
          "
          :is-text-edit-mode="isTextEditMode"
          :should-focus="isTextEditMode && selectedLineId === lines[virtualRow.index]?.id"
          :get-preview-highlight="
            selectedLineId === lines[virtualRow.index]?.id ? getPreviewHighlight : undefined
          "
          :is-adjacent-preview="
            selectedLineId === lines[virtualRow.index]?.id ? isAdjacentPreview : undefined
          "
          :get-search-matches="getSearchMatches"
          :current-search-match="currentSearchMatch"
          @toggle-segment="(lineId: string, segmentId: string) => emit('toggleSegment', lineId, segmentId)"
          @select-segment="(lineId: string, segmentId: string) => emit('selectSegment', lineId, segmentId)"
          @update-line-text="(lineId: string, newText: string) => emit('updateLineText', lineId, newText)"
          @re-parse-line="(lineId: string) => emit('reParseLine', lineId)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-marking-list {
  contain: strict;
}
</style>
