import { ref, computed, watch } from 'vue'
import type { TextLine, SearchMatch } from '@/types'

export function useSearch(getLines: () => TextLine[]) {
  const searchQuery = ref('')
  const isSearchOpen = ref(false)
  const currentMatchIndex = ref(0)
  const caseSensitive = ref(false)

  // 所有匹配結果
  const matches = computed<SearchMatch[]>(() => {
    if (!searchQuery.value.trim()) return []

    const lines = getLines()
    const results: SearchMatch[] = []
    const query = caseSensitive.value ? searchQuery.value : searchQuery.value.toLowerCase()

    for (const line of lines) {
      for (const segment of line.segments) {
        const text = caseSensitive.value ? segment.text : segment.text.toLowerCase()

        let startIndex = 0
        while (true) {
          const matchIndex = text.indexOf(query, startIndex)
          if (matchIndex === -1) break

          results.push({
            lineId: line.id,
            segmentId: segment.id,
            matchIndex,
            matchLength: query.length,
          })
          startIndex = matchIndex + 1
        }
      }
    }

    return results
  })

  // 當前選中的匹配
  const currentMatch = computed(() => {
    if (matches.value.length === 0) return null
    const safeIndex = Math.min(currentMatchIndex.value, matches.value.length - 1)
    return matches.value[safeIndex] || null
  })

  // 搜尋結果統計文字
  const searchStatus = computed(() => {
    if (!searchQuery.value.trim()) return ''
    if (matches.value.length === 0) return '無匹配'
    return `${currentMatchIndex.value + 1} / ${matches.value.length}`
  })

  // 下一個匹配
  function nextMatch() {
    if (matches.value.length === 0) return
    currentMatchIndex.value = (currentMatchIndex.value + 1) % matches.value.length
  }

  // 上一個匹配
  function prevMatch() {
    if (matches.value.length === 0) return
    currentMatchIndex.value =
      currentMatchIndex.value === 0 ? matches.value.length - 1 : currentMatchIndex.value - 1
  }

  // 開啟搜尋
  function openSearch() {
    isSearchOpen.value = true
  }

  // 關閉搜尋
  function closeSearch() {
    isSearchOpen.value = false
    searchQuery.value = ''
    currentMatchIndex.value = 0
  }

  // 當搜尋字串變化時重置 index
  watch(searchQuery, () => {
    currentMatchIndex.value = 0
  })

  // 取得特定 segment 的所有匹配
  function getSegmentMatches(segmentId: string): SearchMatch[] {
    return matches.value.filter((m) => m.segmentId === segmentId)
  }

  return {
    searchQuery,
    isSearchOpen,
    caseSensitive,
    matches,
    currentMatch,
    currentMatchIndex,
    searchStatus,
    nextMatch,
    prevMatch,
    openSearch,
    closeSearch,
    getSegmentMatches,
  }
}
