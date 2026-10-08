<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'
import CostChart from './CostChart.vue'

const props = defineProps<{ calc: HomeCostCalculator }>()
const r = computed(() => props.calc.result.value)
const h = computed(() => props.calc.home.value)

const invest = computed(() => [
  { name: '買わずに頭金・諸費用を投資', color: '#dc2626', values: r.value.rows.map((x) => x.downInvestFV) },
  { name: '借りて毎月浮く分を投資', color: '#0891b2', values: r.value.rows.map((x) => x.diffInvestFV) },
])
const wealth = computed(() => [
  { name: '買う：不動産純資産＋金融資産', color: '#1f6f5c', values: r.value.rows.map((x) => x.buyWealth) },
  { name: '借りる：金融資産', color: '#64748b', values: r.value.rows.map((x) => x.rentWealth) },
])
const at = computed(() => r.value.rows[Math.min(30, r.value.rows.length - 1)])
const upfront = computed(() => h.value.downPayment + h.value.initialCosts)
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">買わなかったお金を投資したら？</h2>
    <p class="mt-1 text-sm text-mute">
      利回り{{ h.investmentReturnRate }}%（仮定）で運用した場合。保証された数値ではありません。
    </p>
    <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">買わずに頭金＋諸費用 {{ formatMan(upfront) }} を投資 → {{ h.holdingYears }}年後</div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.downInvestFV) }}</div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">借りて毎月浮く分（買うより安い差額）を投資 → 積み上がり</div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.diffInvestFV) }}</div>
      </div>
    </div>
    <div class="mt-3"><CostChart :series="invest" :marker="h.holdingYears" /></div>

    <h3 class="mt-6 text-sm font-bold">家計から見た資産の積み上がり</h3>
    <div class="mt-2 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">買う：毎月投資に回せる額</div>
        <div class="num text-lg font-bold" :class="r.shortfallBuy ? 'text-opp' : ''">
          {{ formatYen(r.surplusBuyMonthly) }}
        </div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">借りる：毎月投資に回せる額</div>
        <div class="num text-lg font-bold">{{ formatYen(r.surplusRentMonthly) }}</div>
      </div>
    </div>
    <p v-if="r.shortfallBuy" class="mt-2 text-xs text-opp">
      この条件では、月収から生活費と住居費を引くと赤字になります。
    </p>
    <div class="mt-3"><CostChart :series="wealth" :marker="h.holdingYears" /></div>
    <p class="num mt-2 text-sm">
      30年後： 買う <b>{{ formatMan(at.buyWealth) }}</b> ／ 借りる <b>{{ formatMan(at.rentWealth) }}</b>
    </p>
    <p class="mt-2 text-xs leading-relaxed text-mute">
      買う側の不動産は「土地＋建物の評価額 − ローン残高」で評価（売却はしない前提）。投資額は、月収−生活費−住居費の余剰を毎月積み立てる単純モデルです。
      房価・利回りの設定次第で結果は大きく変わります。家は唯一の資産形成手段ではない、という確認のための試算です。
    </p>
  </section>
</template>
