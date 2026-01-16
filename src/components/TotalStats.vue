<script setup lang="ts">
import type { TextLine } from '@/types'
import { getTotalStats } from '@/composables/useScoring'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    lines: TextLine[]
    layout?: 'horizontal' | 'vertical'
  }>(),
  {
    layout: 'horizontal',
  },
)

const stats = computed(() => getTotalStats(props.lines))
</script>

<template>
  <!-- 橫向佈局（預設，小尺寸用） -->
  <div v-if="layout === 'horizontal'" class="total-stats bg-white rounded-xl shadow-sm border border-slate-200 p-5">
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
