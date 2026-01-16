<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAutoResize } from '@/composables/useAutoResize'

const props = defineProps<{
  initialText?: string
}>()

const inputText = ref(props.initialText || '')

// 自動調整 textarea 高度（最小 6 行，最大 20 行）
const { textareaRef, resize: resizeTextarea, handleInput } = useAutoResize(6, 20)

// 當外部傳入的 initialText 變化時，更新內部狀態
watch(
  () => props.initialText,
  (newText) => {
    if (newText !== undefined) {
      inputText.value = newText
      // 內容變化時重新調整高度
      resizeTextarea()
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
        ref="textareaRef"
        v-model="inputText"
        class="w-full min-h-40 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors text-slate-700 placeholder-slate-400 overflow-hidden"
        placeholder="請在此貼上或輸入要標記的文字（支援多行）..."
        @input="handleInput"
      ></textarea>
      <div class="absolute bottom-3 right-3 text-xs text-slate-400">
        {{ inputText.length }} 字
      </div>
    </div>
    <div class="flex gap-3">
      <button
        class="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        :disabled="!inputText.trim()"
        @click="handleStart"
      >
        開始標記
      </button>
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-x-2"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 -translate-x-2"
      >
      <button
        v-if="inputText.trim()"
        class="px-6 py-2.5 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors duration-200 border border-red-200"
        @click="handleClear"
      >
        清除
      </button>
      </Transition>
    </div>
  </div>
</template>
