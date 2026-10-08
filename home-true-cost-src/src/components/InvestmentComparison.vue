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
  { name: '買う：家の純資産＋投資', color: '#1f6f5c', values: r.value.rows.map((x) => x.buyWealth) },
  { name: '借りる：投資のみ', color: '#64748b', values: r.value.rows.map((x) => x.rentWealth) },
])
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
    <p class="mt-1 text-sm text-mute">
      毎月の手取りから、生活費と住居費を払った<b>残り</b>を投資に回し続けたら、{{ h.holdingYears }}年後の手元の資産はいくら？
    </p>

    <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="font-semibold">買う場合</div>
        <div class="num mt-1 text-xs leading-relaxed text-mute">
          手取り {{ formatYen(h.monthlyIncome) }}<br />
          − 生活費 {{ formatYen(h.monthlyLivingCost) }}<br />
          − 住居費 {{ formatYen(r.firstYearCashMonthly) }}（ローン・税・保険・修繕・管理費）
        </div>
        <div class="mt-1 text-xs text-mute">＝ 毎月投資に回せる額</div>
        <div class="num text-lg font-bold" :class="r.shortfallBuy ? 'text-opp' : ''">
          {{ formatYen(r.surplusBuyMonthly) }}
        </div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="font-semibold">借りる場合</div>
        <div class="num mt-1 text-xs leading-relaxed text-mute">
          手取り {{ formatYen(h.monthlyIncome) }}<br />
          − 生活費 {{ formatYen(h.monthlyLivingCost) }}<br />
          − 住居費 {{ formatYen(r.rentMonthlyFirst) }}（家賃・管理費・駐車場など）
        </div>
        <div class="mt-1 text-xs text-mute">＝ 毎月投資に回せる額</div>
        <div class="num text-lg font-bold">{{ formatYen(r.surplusRentMonthly) }}</div>
      </div>
    </div>
    <p v-if="r.shortfallBuy" class="mt-2 text-xs text-opp">
      この条件では、月収から生活費と住居費を引くと赤字になります。
    </p>

    <div class="mt-3"><CostChart :series="wealth" :marker="h.holdingYears" /></div>

    <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">買う：{{ h.holdingYears }}年後の資産合計</div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.buyWealth) }}</div>
        <div class="num text-xs text-mute">
          家（土地・建物の評価額 − ローン残高）{{ formatMan(r.holding.propertyValue - r.holding.loanBalance) }}<br />
          ＋ 投資 {{ formatMan(r.holding.buyWealth - (r.holding.propertyValue - r.holding.loanBalance)) }}
        </div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">借りる：{{ h.holdingYears }}年後の資産合計</div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.rentWealth) }}</div>
        <div class="num text-xs text-mute">すべて投資（家は持たない）</div>
      </div>
    </div>

    <div class="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-mute">
      <p class="font-semibold text-ink">この試算の前提</p>
      <ul class="list-disc space-y-1 pl-4">
        <li>買う場合：手持ち資金は頭金と諸費用に使うので、投資は0円からスタート。</li>
        <li>借りる場合：頭金と諸費用に使うはずだった額から、賃貸の初期費用を引いた残りを最初に一括投資。</li>
        <li>上の住居費は初年度の金額です。計算では、金利上昇や管理費の上昇、家賃の上昇に応じて毎年の余りを変えています。</li>
        <li>どちらも毎月の余りを同じ利回り（{{ h.investmentReturnRate }}%・仮定）で積み立てて運用。</li>
        <li>買う側の家は売却しない前提で、土地・建物の評価額（建物は年数とともに価値が下がる）からローン残高を引いて計上。</li>
        <li>利回りや土地の価格の設定次第で結果は大きく変わります。「家だけが資産形成の方法ではない」ことを確認するための試算で、どちらが得かを断定するものではありません。</li>
      </ul>
    </div>
  </section>
</template>
