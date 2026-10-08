<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'
import { CHECKPOINT_YEARS } from '../utils/simulation'
import CostChart from './CostChart.vue'

const props = defineProps<{ calc: HomeCostCalculator }>()
const r = computed(() => props.calc.result.value)
const v = computed(() => props.calc.buyVsRent.value)
const years = computed(() => props.calc.home.value.holdingYears)

const verdictText = computed(() =>
  v.value.verdict === 'buy'
    ? 'この条件では、購入のほうが有利になる可能性があります。'
    : v.value.verdict === 'rent'
      ? 'この条件では、賃貸のほうが有利になる可能性があります。'
      : 'この条件では、購入と賃貸はほぼ同程度です。',
)
const verdictColor = computed(() =>
  v.value.verdict === 'buy' ? 'bg-emerald-50 text-emerald-900' : v.value.verdict === 'rent' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-800',
)

const series = computed(() => [
  { name: '買う（純コスト）', color: '#1f6f5c', values: r.value.rows.map((x) => x.buyNetCost) },
  { name: '借りる', color: '#64748b', values: r.value.rows.map((x) => x.rentNetCost) },
])
const table = computed(() =>
  [...new Set([...CHECKPOINT_YEARS, years.value])]
    .filter((y) => r.value.rows[y])
    .sort((a, b) => a - b)
    .map((y) => {
      const row = r.value.rows[y]
      return { year: y, buy: row.buyNetCost, rent: row.rentNetCost, diff: row.rentNetCost - row.buyNetCost }
    }),
)
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">買う vs 借りる（{{ years }}年後）</h2>
    <p class="mt-1 text-sm text-mute">同じ条件で{{ formatYen(calc.base.monthlyRent) }}の家賃で住み続けた場合との比較</p>

    <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-xl bg-slate-50 p-4">
        <div class="text-mute">買う：総純コスト</div>
        <div class="num text-xl font-bold">{{ formatMan(r.holding.buyNetCost) }}</div>
      </div>
      <div class="rounded-xl bg-slate-50 p-4">
        <div class="text-mute">借りる：総コスト</div>
        <div class="num text-xl font-bold">{{ formatMan(r.holding.rentNetCost) }}</div>
      </div>
    </div>

    <p class="mt-3 rounded-xl px-4 py-3 text-sm" :class="verdictColor">
      <b>{{ verdictText }}</b>
      <span class="num block">
        差額：約{{ formatMan(Math.abs(v.diff)) }}（{{ v.diff >= 0 ? '購入が安い' : '賃貸が安い' }}）
      </span>
    </p>

    <h3 class="mt-6 text-sm font-bold">累計コストの推移</h3>
    <CostChart :series="series" :marker="years" />

    <div class="mt-4 overflow-x-auto">
      <table class="num w-full min-w-[420px] text-sm">
        <thead class="text-left text-xs text-mute">
          <tr>
            <th class="py-2 font-medium">期間</th>
            <th class="py-2 text-right font-medium">買う</th>
            <th class="py-2 text-right font-medium">借りる</th>
            <th class="py-2 text-right font-medium">差額（賃貸−購入）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in table" :key="t.year" class="border-t border-line" :class="t.year === years ? 'bg-amber-50/60 font-semibold' : ''">
            <td class="py-2">{{ t.year }}年</td>
            <td class="py-2 text-right">{{ formatMan(t.buy) }}</td>
            <td class="py-2 text-right">{{ formatMan(t.rent) }}</td>
            <td class="py-2 text-right" :class="t.diff >= 0 ? 'text-emerald-700' : 'text-amber-700'">
              {{ t.diff >= 0 ? '+' : '' }}{{ formatMan(t.diff) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-mute">
      買う場合の純コスト ＝ 累計の現金支出（頭金・諸費用含む）＋ 頭金・諸費用の機会費用 − 売却後に手元に残る金額（売却価格 − 売却費用 − ローン残高）。
      その時点で売却した場合を想定した比較で、早期ほど諸費用や売却費用の影響が大きく出ます。
    </p>
  </section>
</template>
