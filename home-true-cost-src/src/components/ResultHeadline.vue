<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatPercent, formatYen } from '../utils/formatCurrency'

const props = defineProps<{ calc: HomeCostCalculator }>()
const r = computed(() => props.calc.result.value)

// 数字の変化をなめらかに見せる（目安の表示のみ。値そのものは変えない）
const shown = ref(r.value.effectiveMonthly)
let raf = 0
watch(
  () => r.value.effectiveMonthly,
  (to) => {
    cancelAnimationFrame(raf)
    const from = shown.value
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 450)
      shown.value = from + (to - from) * (1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  },
)
onBeforeUnmount(() => cancelAnimationFrame(raf))

const other = computed(() => r.value.effectiveMonthly - r.value.loanFirstPayment)
const aff = computed(() => props.calc.affordability.value)
const affColor = computed(
  () =>
    ({ comfortable: 'bg-emerald-50 text-emerald-800', normal: 'bg-sky-50 text-sky-800', heavy: 'bg-amber-50 text-amber-800', severe: 'bg-red-50 text-red-800' })[
      aff.value.level
    ],
)
</script>

<template>
  <section class="rounded-3xl bg-ink p-6 text-white sm:p-8">
    <p class="text-sm text-white/70">この家の「本当の月額」</p>
    <p class="num mt-1 text-5xl font-extrabold leading-tight sm:text-6xl">
      {{ formatYen(shown) }}<span class="ml-1 text-xl font-medium text-white/70">/ 月</span>
    </p>
    <p class="mt-1 text-xs text-white/60">
      保有{{ calc.home.value.holdingYears }}年で売却した場合の実質コスト ÷ 居住月数（機会費用込み）
    </p>

    <div class="mt-6 space-y-2 text-sm">
      <div class="flex items-baseline justify-between border-t border-white/15 pt-3">
        <span class="text-white/70">広告のローン返済額</span>
        <span class="num text-lg font-bold">{{ formatYen(r.loanFirstPayment) }}</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-white/70">実際の毎月支出（税・保険・修繕・管理費込み）</span>
        <span class="num text-lg font-bold">{{ formatYen(r.firstYearCashMonthly) }}</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-white/70">機会費用・資産価値まで含めた実質月額</span>
        <span class="num text-lg font-bold text-amber-300">{{ formatYen(r.effectiveMonthly) }}</span>
      </div>
    </div>

    <p class="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm leading-relaxed">
      ローン返済に対して
      <b class="num">{{ other >= 0 ? '+' : '-' }}{{ formatYen(Math.abs(other)) }} / 月</b>
      {{ other >= 0 ? 'の追加コスト' : '分、実質コストが低い（資産価値の上昇などによる）' }}。
      ローン以外にも、毎月これだけのお金が動いています。
    </p>

    <div class="mt-4 rounded-xl px-4 py-3 text-sm" :class="affColor">
      <span class="font-bold">住居費 / 月収 = {{ formatPercent(aff.ratio, 1) }}</span>
      ：{{ aff.label }}
      <span class="block text-[11px] opacity-70">※ 当サイトの参考指標であり、金融上の助言ではありません。</span>
    </div>
  </section>
</template>
