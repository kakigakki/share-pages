<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatYen } from '../utils/formatCurrency'
import { t } from '../i18n'

const props = defineProps<{ calc: HomeCostCalculator }>()
const r = computed(() => props.calc.result.value)

const parts = computed(() => {
  const b = r.value.breakdown
  return [
    { key: 'loan', label: 'ローン返済', value: b.loan, color: 'bg-loan' },
    { key: 'tax', label: '税金', value: b.tax, color: 'bg-tax' },
    { key: 'ins', label: '保険', value: b.insurance, color: 'bg-ins' },
    { key: 'repair', label: '修繕', value: b.repair, color: 'bg-repair' },
    { key: 'mgmt', label: '管理費等', value: b.management, color: 'bg-mgmt' },
    { key: 'opp', label: '機会費用', value: b.opportunity, color: 'bg-opp' },
  ].filter((p) => p.value > 0)
})
const total = computed(() => parts.value.reduce((s, p) => s + p.value, 0))
const rentTotal = computed(() => r.value.rentBreakdownMonthly)
const max = computed(() => Math.max(total.value, rentTotal.value, 1))
const loanShare = computed(() => (total.value ? r.value.breakdown.loan / total.value : 0))
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">{{ t('月々いくらかかる？（初年度の月平均）') }}</h2>

    <div class="mt-4 space-y-4">
      <div>
        <div class="mb-1 flex justify-between text-sm">
          <span class="font-semibold">{{ t('買う場合') }}</span>
          <span class="num font-bold">{{ formatYen(total) }}</span>
        </div>
        <div class="flex h-9 overflow-hidden rounded-lg bg-slate-100" :style="{ width: (total / max) * 100 + '%' }">
          <div
            v-for="p in parts"
            :key="p.key"
            :class="p.color"
            :style="{ width: (p.value / total) * 100 + '%' }"
            :title="`${t(p.label)} ${formatYen(p.value)}`"
          />
        </div>
      </div>
      <div>
        <div class="mb-1 flex justify-between text-sm">
          <span class="font-semibold">{{ t('借りる場合') }}</span>
          <span class="num font-bold">{{ formatYen(rentTotal) }}</span>
        </div>
        <div class="h-9 rounded-lg bg-slate-400" :style="{ width: (rentTotal / max) * 100 + '%' }" />
      </div>
    </div>

    <ul class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      <li v-for="p in parts" :key="p.key" class="flex items-center gap-2">
        <span class="h-3 w-3 shrink-0 rounded-sm" :class="p.color" />
        <span class="text-mute">{{ t(p.label) }}</span>
        <span class="num ml-auto font-semibold">{{ formatYen(p.value) }}</span>
      </li>
    </ul>
    <p class="mt-4 text-xs leading-relaxed text-mute">
      {{ t('ローンは、この月額のうち {pct}% にすぎません。機会費用は「頭金・諸費用を投資に回していた場合に得られた利益」の月割りで、仮定の利回りに基づきます。', { pct: (loanShare * 100).toFixed(0) }) }}
    </p>
  </section>
</template>
