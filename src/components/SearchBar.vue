<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  isOpen: boolean
  searchStatus: string
  caseSensitive: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:caseSensitive': [value: boolean]
  next: []
  prev: []
  close: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const localQuery = ref('')

// 當開啟時自動聚焦
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  }
)

function handleInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  localQuery.value = value
  emit('update:modelValue', value)
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) {
      emit('prev')
    } else {
      emit('next')
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="isOpen"
      class="search-bar fixed top-16 right-4 z-50 bg-white rounded-xl shadow-lg border border-slate-200 p-3 flex items-center gap-2"
    >
      <!-- 搜尋圖示 -->
      <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      <!-- 搜尋輸入框 -->
      <input
        ref="inputRef"
        type="text"
        :value="localQuery"
        class="w-40 px-2 py-1.5 text-sm border-none outline-none bg-transparent"
        placeholder="搜尋文字..."
        @input="handleInput"
        @keydown="handleKeyDown"
      />

      <!-- 匹配狀態 -->
      <span v-if="searchStatus" class="text-xs text-slate-500 min-w-[50px] text-center shrink-0">
        {{ searchStatus }}
      </span>

      <!-- 導航按鈕 -->
      <div class="flex items-center gap-0.5 border-l border-slate-200 pl-2">
        <button
          class="p-1.5 hover:bg-slate-100 hover:-translate-y-0.5 active:opacity-70 rounded transition-all duration-200"
          title="上一個 (Shift+Enter)"
          @click="emit('prev')"
        >
          <svg class="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          class="p-1.5 hover:bg-slate-100 hover:translate-y-0.5 active:opacity-70 rounded transition-all duration-200"
          title="下一個 (Enter)"
          @click="emit('next')"
        >
          <svg class="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <!-- 大小寫敏感切換 -->
      <button
        class="p-1.5 rounded transition-all duration-200 text-xs font-mono shrink-0 active:opacity-70"
        :class="caseSensitive ? 'bg-blue-100 text-blue-700 shadow-sm' : 'hover:bg-slate-100 text-slate-500'"
        title="區分大小寫"
        @click="emit('update:caseSensitive', !caseSensitive)"
      >
        Aa
      </button>

      <!-- 關閉按鈕 -->
      <button
        class="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-all duration-200 shrink-0 active:opacity-70"
        title="關閉 (Esc)"
        @click="emit('close')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Transition>
</template>
