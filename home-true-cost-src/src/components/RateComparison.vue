<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'

const props = defineProps<{ calc: HomeCostCalculator }>()
const labels = {
  fixed: '固定',
  variable_conservative: '変動・慎重',
  variable_aggressive: '変動・積極',
} as const

const rows = computed(() =>
  props.calc.rateComparison.value.map((x) => ({
    mode: x.mode,
    label: labels[x.mode],
    initialRate: x.home.interestRate,
    peakRate: x.result.loanPeakRate,
    first: x.result.loanFirstPayment,
    peak: x.result.loanPeakPayment,
    interest: x.result.loanTotalInterest,
    effective: x.result.effectiveMonthly,
    selected: x.mode === props.calc.base.rateMode,
  })),
)
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">固定 vs 変動：金利タイプ別の比較</h2>
    <p class="mt-1 text-sm text-mute">同じ物件・同じ借入額で、金利タイプだけを変えた場合です。</p>

    <div class="mt-4 overflow-x-auto">
      <table class="num w-full min-w-[560px] text-sm">
        <thead class="text-left text-xs text-mute">
          <tr>
            <th class="py-2 font-medium">タイプ</th>
            <th class="py-2 text-right font-medium">年利（当初→最高）</th>
            <th class="py-2 text-right font-medium">当初返済</th>
            <th class="py-2 text-right font-medium">最大返済</th>
            <th class="py-2 text-right font-medium">総利息</th>
            <th class="py-2 text-right font-medium">実質月額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="x in rows" :key="x.mode" class="border-t border-line" :class="x.selected ? 'bg-amber-50/60 font-semibold' : ''">
            <td class="py-2">{{ x.label }}</td>
            <td class="py-2 text-right">
              {{ x.initialRate.toFixed(2) }}%
              <template v-if="x.peakRate > x.initialRate + 0.001">→ {{ x.peakRate.toFixed(2) }}%</template>
            </td>
            <td class="py-2 text-right">{{ formatYen(x.first) }}</td>
            <td class="py-2 text-right">{{ formatYen(x.peak) }}</td>
            <td class="py-2 text-right">{{ formatMan(x.interest) }}</td>
            <td class="py-2 text-right">{{ formatYen(x.effective) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-mute">
      <p class="font-semibold text-ink">この前提の根拠（2026年9〜10月時点の報道ベース。仮定であり予測ではありません）</p>
      <ul class="list-disc space-y-1 pl-4">
        <li>日銀は2026年9月に政策金利を1.25%へ引き上げ（1995年以来の水準）。変動金利の新規借入平均は約1.2%、フラット35の最多金利は3.83%（10月）。</li>
        <li>日銀の中立金利は1〜2.5%程度との推計があり、政策金利の着地を1〜2%台とみる見方が多い。</li>
        <li><b>積極</b>：政策金利が中立金利の下限付近で止まり、変動金利が当初から +0.5pt ほど上がる前提。</li>
        <li><b>慎重</b>：固定金利を上回るストレス想定。段階的に利上げが進み、当初から +3.5pt（約4.7%）まで上がる前提。1990年の日本の政策金利は約6%、海外では2022〜23年に米・英が約1年半で5pt前後引き上げた例があり、起こりえない水準ではありません。</li>
        <li>簡略化：金利は半年ごとに反映し、見直しのたびに返済額を再計算します。実際の5年ルール・125%ルール（返済額の急増を抑える仕組み）は考慮していません。</li>
        <li>固定は、変動より当初の返済が高い代わりに、期間中の金利変動リスクを負いません。</li>
      </ul>
    </div>
  </section>
</template>
