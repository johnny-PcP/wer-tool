<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  initialText?: string
}>()

const inputText = ref(props.initialText || '')

// 當外部傳入的 initialText 變化時，更新內部狀態
watch(
  () => props.initialText,
  (newText) => {
    if (newText !== undefined) {
      inputText.value = newText
    }
  },
)

const emit = defineEmits<{
  startMarking: [text: string]
  clear: []
}>()

function handleStart() {
  if (inputText.value.trim()) {
    emit('startMarking', inputText.value)
  }
}

function handleClear() {
  if (confirm('確定要清除所有內容嗎？此操作無法復原。')) {
    inputText.value = ''
    emit('clear')
  }
}
</script>

<template>
  <div class="text-input-area space-y-4">
    <textarea
      v-model="inputText"
      class="w-full h-48 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      placeholder="請在此貼上或輸入要標記的文字（支援多行）..."
    ></textarea>
    <div class="flex gap-3">
      <button
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!inputText.trim()"
        @click="handleStart"
      >
        開始標記
      </button>
      <button
        v-if="inputText.trim()"
        class="px-6 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
        @click="handleClear"
      >
        清除
      </button>
    </div>
  </div>
</template>
