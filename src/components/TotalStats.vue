<script setup lang="ts">
import type { TextLine } from '@/types'
import { getTotalStats } from '@/composables/useScoring'
import { computed } from 'vue'

const props = defineProps<{
  lines: TextLine[]
}>()

const stats = computed(() => getTotalStats(props.lines))
</script>

<template>
  <div class="total-stats bg-white rounded-xl shadow-sm border border-slate-200 p-5">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- 總詞數 -->
      <div class="stat-item bg-slate-50 rounded-lg p-4 text-center">
        <p class="text-xs text-slate-500 uppercase tracking-wide mb-1">總詞數</p>
        <p class="text-2xl font-bold text-slate-700">{{ stats.totalCount }}</p>
      </div>
      <!-- 錯誤數 -->
      <div class="stat-item bg-red-50 rounded-lg p-4 text-center">
        <p class="text-xs text-red-500 uppercase tracking-wide mb-1">錯誤數</p>
        <p class="text-2xl font-bold text-red-600">{{ stats.errorCount }}</p>
      </div>
      <!-- 正確率 -->
      <div class="stat-item bg-emerald-50 rounded-lg p-4 text-center">
        <p class="text-xs text-emerald-500 uppercase tracking-wide mb-1">正確率</p>
        <p class="text-2xl font-bold text-emerald-600">{{ stats.correctRate.toFixed(1) }}%</p>
      </div>
      <!-- WER -->
      <div class="stat-item bg-amber-50 rounded-lg p-4 text-center">
        <p class="text-xs text-amber-500 uppercase tracking-wide mb-1">WER</p>
        <p class="text-2xl font-bold text-amber-600">{{ stats.errorRate.toFixed(1) }}%</p>
      </div>
    </div>
  </div>
</template>
