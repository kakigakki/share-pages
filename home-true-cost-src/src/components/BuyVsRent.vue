<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'
import { t } from '../i18n'
import { CHECKPOINT_YEARS } from '../utils/simulation'
import CostChart from './CostChart.vue'

const props = defineProps<{ calc: HomeCostCalculator }>()
const r = computed(() => props.calc.result.value)
const v = computed(() => props.calc.buyVsRent.value)
const years = computed(() => props.calc.home.value.holdingYears)

const verdictText = computed(() =>
  v.value.verdict === 'buy'
    ? t('この条件では、購入のほうが有利になる可能性があります。')
    : v.value.verdict === 'rent'
      ? t('この条件では、賃貸のほうが有利になる可能性があります。')
      : t('この条件では、購入と賃貸はほぼ同程度です。'),
)
const verdictColor = computed(() =>
  v.value.verdict === 'buy' ? 'bg-emerald-50 text-emerald-900' : v.value.verdict === 'rent' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-800',
)

const series = computed(() => [
  { name: '買う（残る資産を差し引き後）', color: '#1f6f5c', values: r.value.rows.map((x) => x.buyNetCostAfterAsset) },
  { name: '借りる', color: '#64748b', values: r.value.rows.map((x) => x.rentNetCost) },
])
const table = computed(() =>
  [...new Set([...CHECKPOINT_YEARS, years.value])]
    .filter((y) => r.value.rows[y])
    .sort((a, b) => a - b)
    .map((y) => {
      const row = r.value.rows[y]
      return { year: y, buy: row.buyNetCost, asset: row.propertyValue - row.loanBalance, rent: row.rentNetCost, diff: row.rentNetCost - row.buyNetCostAfterAsset }
    }),
)
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">{{ t('買う vs 借りる（{n}年後）', { n: years }) }}</h2>
    <p class="mt-1 text-sm text-mute">{{ t('同じ条件で{rent}の家賃で住み続けた場合との比較', { rent: formatYen(calc.base.monthlyRent) }) }}</p>

    <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-xl bg-slate-50 p-4">
        <div class="text-mute">{{ t('買う：総支出＋機会費用') }}</div>
        <div class="num text-xl font-bold">{{ formatMan(r.holding.buyNetCost) }}</div>
        <div class="num mt-1 text-xs text-mute">{{ t('残る資産') }} {{ formatMan(r.holding.propertyValue - r.holding.loanBalance) }}</div>
      </div>
      <div class="rounded-xl bg-slate-50 p-4">
        <div class="text-mute">{{ t('借りる：総支出＋機会費用') }}</div>
        <div class="num text-xl font-bold">{{ formatMan(r.holding.rentNetCost) }}</div>
      </div>
    </div>

    <p class="mt-3 rounded-xl px-4 py-3 text-sm" :class="verdictColor">
      <b>{{ verdictText }}</b>
      <span class="num block">
        {{ t('差額：約{amount}（{who}）', { amount: formatMan(Math.abs(v.diff)), who: v.diff >= 0 ? t('購入が安い') : t('賃貸が安い') }) }}
      </span>
    </p>

    <h3 class="mt-6 text-sm font-bold">{{ t('累計コストの推移') }}</h3>
    <CostChart :series="series" :marker="years" />

    <div class="mt-4 overflow-x-auto">
      <table class="num w-full min-w-[520px] text-sm">
        <thead class="text-left text-xs text-mute">
          <tr>
            <th class="py-2 font-medium">{{ t('期間') }}</th>
            <th class="py-2 text-right font-medium">{{ t('買う（総支出）') }}</th>
            <th class="py-2 text-right font-medium">{{ t('残る資産') }}</th>
            <th class="py-2 text-right font-medium">{{ t('借りる') }}</th>
            <th class="py-2 text-right font-medium">{{ t('差額（賃貸−購入）') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table" :key="row.year" class="border-t border-line" :class="row.year === years ? 'bg-amber-50/60 font-semibold' : ''">
            <td class="py-2">{{ row.year }}{{ t('年') }}</td>
            <td class="py-2 text-right">{{ formatMan(row.buy) }}</td>
            <td class="py-2 text-right">{{ formatMan(row.asset) }}</td>
            <td class="py-2 text-right">{{ formatMan(row.rent) }}</td>
            <td class="py-2 text-right" :class="row.diff >= 0 ? 'text-emerald-700' : 'text-amber-700'">
              {{ row.diff >= 0 ? '+' : '' }}{{ formatMan(row.diff) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-mute">
      {{ t('買う側の総支出 ＝ 累計の現金支出（頭金・諸費用含む）＋ 頭金・諸費用の機会費用。売却はしない前提です。') }}
      {{ t('差額は、買う側から「残る資産（土地・建物の評価額 − ローン残高）」を差し引いて賃貸と比べたものです。評価額は概算で、建物は年数とともにゼロへ向かいます。') }}
    </p>
  </section>
</template>
