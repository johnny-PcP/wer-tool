<script setup lang="ts">
import type { TextLine } from '@/types'
import { getTotalStats } from '@/composables/useScoring'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    lines: TextLine[]
    layout?: 'horizontal' | 'vertical'
    startLine?: number | null
    endLine?: number | null
  }>(),
  {
    layout: 'horizontal',
    startLine: null,
    endLine: null,
  },
)

const emit = defineEmits<{
  'update:startLine': [value: number | null]
  'update:endLine': [value: number | null]
}>()

const stats = computed(() => getTotalStats(props.lines, props.startLine, props.endLine))

// 範圍提示文字
const rangeHint = computed(() => {
  if (props.startLine && props.endLine) {
    return `第 ${props.startLine} - ${props.endLine} 段`
  } else if (props.startLine) {
    return `第 ${props.startLine} 段起`
  } else if (props.endLine) {
    return `至第 ${props.endLine} 段`
  }
  return '全部'
})

function handleStartChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:startLine', value ? parseInt(value, 10) : null)
}

function handleEndChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:endLine', value ? parseInt(value, 10) : null)
}
</script>

<template>
  <!-- 橫向佈局（預設，小尺寸用） -->
  <div v-if="layout === 'horizontal'" class="total-stats bg-white rounded-xl shadow-sm border border-slate-200 p-5">
    <!-- 範圍選擇 -->
    <div class="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-100">
      <span class="text-sm text-slate-600">計分範圍：</span>
      <div class="flex items-center gap-1">
        <span class="text-xs text-slate-500">從第</span>
        <input
          type="number"
          min="1"
          :max="endLine || lines.length"
          :value="startLine ?? ''"
          placeholder="1"
          class="w-14 px-2 py-1 text-sm text-center border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          @input="handleStartChange"
        />
        <span class="text-xs text-slate-500">段</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-xs text-slate-500">到第</span>
        <input
          type="number"
          :min="startLine || 1"
          :max="lines.length"
          :value="endLine ?? ''"
          :placeholder="String(lines.length)"
          class="w-14 px-2 py-1 text-sm text-center border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          @input="handleEndChange"
        />
        <span class="text-xs text-slate-500">段</span>
      </div>
      <span class="text-xs text-slate-400 ml-2">({{ rangeHint }})</span>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- 總詞數 -->
      <div class="stat-item bg-slate-50 rounded-lg p-4 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
        <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">總詞數</p>
        <p class="text-2xl font-bold text-slate-700 tabular-nums transition-all duration-300">{{ stats.totalCount }}</p>
      </div>
      <!-- 錯誤數 -->
      <div class="stat-item bg-red-50 rounded-lg p-4 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
        <p class="text-xs text-red-500 uppercase tracking-wide mb-1">錯誤數</p>
        <p class="text-2xl font-bold text-red-600 tabular-nums transition-all duration-300">{{ stats.errorCount }}</p>
      </div>
      <!-- 正確率 -->
      <div class="stat-item bg-emerald-50 rounded-lg p-4 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
        <p class="text-xs text-emerald-500 uppercase tracking-wide mb-1">正確率</p>
        <p class="text-2xl font-bold text-emerald-600 tabular-nums transition-all duration-300">{{ stats.correctRate.toFixed(1) }}%</p>
      </div>
      <!-- WER -->
      <div class="stat-item bg-amber-50 rounded-lg p-4 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
        <p class="text-xs text-amber-500 uppercase tracking-wide mb-1">WER</p>
        <p class="text-2xl font-bold text-amber-600 tabular-nums transition-all duration-300">{{ stats.errorRate.toFixed(1) }}%</p>
      </div>
    </div>
  </div>

  <!-- 直向佈局（大尺寸側邊欄用） -->
  <div v-else class="space-y-2">
    <!-- 範圍選擇（精簡版） -->
    <div class="bg-slate-100 rounded-lg px-2 py-2 space-y-1">
      <p class="text-[10px] text-slate-500 text-center">計分範圍</p>
      <div class="flex items-center gap-1 justify-center">
        <input
          type="number"
          min="1"
          :max="endLine || lines.length"
          :value="startLine ?? ''"
          placeholder="1"
          class="w-10 px-1 py-0.5 text-xs text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          @input="handleStartChange"
        />
        <span class="text-xs text-slate-400">-</span>
        <input
          type="number"
          :min="startLine || 1"
          :max="lines.length"
          :value="endLine ?? ''"
          :placeholder="String(lines.length)"
          class="w-10 px-1 py-0.5 text-xs text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          @input="handleEndChange"
        />
      </div>
    </div>
    <!-- 總詞數 -->
    <div class="bg-slate-50 rounded-lg px-3 py-2 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
      <p class="text-[10px] text-slate-500 uppercase tracking-wide">總詞數</p>
      <p class="text-lg font-bold text-slate-700 tabular-nums transition-all duration-300">{{ stats.totalCount }}</p>
    </div>
    <!-- 錯誤數 -->
    <div class="bg-red-50 rounded-lg px-3 py-2 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
      <p class="text-[10px] text-red-500 uppercase tracking-wide">錯誤數</p>
      <p class="text-lg font-bold text-red-600 tabular-nums transition-all duration-300">{{ stats.errorCount }}</p>
    </div>
    <!-- 正確率 -->
    <div class="bg-emerald-50 rounded-lg px-3 py-2 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
      <p class="text-[10px] text-emerald-500 uppercase tracking-wide">正確率</p>
      <p class="text-lg font-bold text-emerald-600 tabular-nums transition-all duration-300">{{ stats.correctRate.toFixed(1) }}%</p>
    </div>
    <!-- WER -->
    <div class="bg-amber-50 rounded-lg px-3 py-2 text-center hover:brightness-95 hover:shadow-md transition-all duration-200">
      <p class="text-[10px] text-amber-500 uppercase tracking-wide">WER</p>
      <p class="text-lg font-bold text-amber-600 tabular-nums transition-all duration-300">{{ stats.errorRate.toFixed(1) }}%</p>
    </div>
  </div>
</template>
