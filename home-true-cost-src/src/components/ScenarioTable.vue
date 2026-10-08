<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'

const props = defineProps<{ calc: HomeCostCalculator }>()
const years = computed(() => props.calc.home.value.holdingYears)
const rows = computed(() =>
  props.calc.scenarios.value.map((s) => ({
    ...s,
    value: s.result.holding.propertyValue,
    effective: s.result.holding.buyNetCostAfterAsset / Math.max(1, props.calc.home.value.holdingYears * 12),
    diff: s.result.holding.rentNetCost - s.result.holding.buyNetCostAfterAsset,
  })),
)
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">{{ years }}年後、この家の評価額は？（情景）</h2>
    <p class="mt-1 text-sm text-mute">
      売却はしない前提で、残る土地・建物の評価額の目安です。建物は年数とともにゼロへ向かい、土地は年変化率を変えた「もしも」で見ます。未来の地価は予測できず、どれが正しいと示すものではありません。
    </p>
    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <div v-for="s in rows" :key="s.growth" class="rounded-xl bg-slate-50 p-4 text-sm">
        <div class="text-mute">{{ s.label }}（{{ s.growth > 0 ? '+' : '' }}{{ s.growth }}%/年）</div>
        <div class="num mt-1 text-xl font-bold">{{ formatMan(s.value) }}</div>
        <div class="mt-2 text-xs text-mute">残る資産を差し引いた月額</div>
        <div class="num font-semibold">{{ formatYen(s.effective) }}</div>
        <div class="mt-2 text-xs text-mute">賃貸との差額（賃貸−購入）</div>
        <div class="num font-semibold" :class="s.diff >= 0 ? 'text-emerald-700' : 'text-amber-700'">
          {{ s.diff >= 0 ? '+' : '' }}{{ formatMan(s.diff) }}
        </div>
      </div>
    </div>
  </section>
</template>
