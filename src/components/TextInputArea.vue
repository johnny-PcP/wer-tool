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
    <div class="relative">
      <textarea
        v-model="inputText"
        class="w-full h-56 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors text-slate-700 placeholder-slate-400"
        placeholder="請在此貼上或輸入要標記的文字（支援多行）..."
      ></textarea>
      <div class="absolute bottom-3 right-3 text-xs text-slate-400">
        {{ inputText.length }} 字
      </div>
    </div>
    <div class="flex gap-3">
      <button
        class="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        :disabled="!inputText.trim()"
        @click="handleStart"
      >
        開始標記
      </button>
      <button
        v-if="inputText.trim()"
        class="px-6 py-2.5 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors border border-red-200"
        @click="handleClear"
      >
        清除
      </button>
    </div>
  </div>
</template>
