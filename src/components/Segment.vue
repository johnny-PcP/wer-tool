<script setup lang="ts">
import type { Segment } from '@/types'

defineOptions({
  name: 'TextSegment',
})

defineProps<{
  segment: Segment
  isSelected: boolean
  editMode: 'none' | 'left' | 'right'
}>()

const emit = defineEmits<{
  toggle: [id: string]
  select: [id: string]
}>()

function handleClick(id: string) {
  emit('select', id)
  emit('toggle', id)
}
</script>

<template>
  <span
    :data-segment-id="segment.id"
    class="segment cursor-pointer px-0.5 transition-colors relative"
    :class="[
      segment.isDeleted
        ? 'segment-deleted'
        : segment.isError
          ? 'segment-error'
          : 'segment-correct',
      isSelected ? 'segment-selected' : '',
    ]"
    @click="handleClick(segment.id)"
  >
    <!-- 左邊箭頭指示器 -->
    <span
      v-if="isSelected && editMode === 'left'"
      class="arrow-indicator arrow-left"
    >
      ◀
    </span>
    <!-- 右邊箭頭指示器 -->
    <span
      v-if="isSelected && editMode === 'right'"
      class="arrow-indicator arrow-right"
    >
      ▶
    </span>
    {{ segment.text }}
  </span>
</template>

<style scoped>
.segment {
  display: inline-block;
  border-bottom: 2px solid;
  margin: 0 1px;
  padding: 2px 4px;
  border-radius: 2px;
}

.segment-correct {
  border-bottom-color: #3b82f6;
}

.segment-error {
  border-bottom-color: #ef4444;
}

.segment-deleted {
  border-bottom-color: transparent;
  color: #9ca3af;
}

.segment-selected {
  outline: 2px solid #fbbf24;
  outline-offset: 1px;
  background-color: rgba(251, 191, 36, 0.1);
}

.segment:hover {
  opacity: 0.8;
}

.arrow-indicator {
  position: absolute;
  top: -14px;
  font-size: 10px;
  color: #f59e0b;
  animation: bounce 0.5s infinite alternate;
}

.arrow-left {
  left: 0;
}

.arrow-right {
  right: 0;
}

@keyframes bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-2px);
  }
}
</style>
