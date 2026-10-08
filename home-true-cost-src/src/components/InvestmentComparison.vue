<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'
import { t } from '../i18n'
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
const buyEquity = computed(() => r.value.holding.propertyValue - r.value.holding.loanBalance)
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">{{ t('買わなかったお金を投資したら？') }}</h2>
    <p class="mt-1 text-sm text-mute">
      {{ t('利回り{rate}%（仮定）で運用した場合。保証された数値ではありません。', { rate: h.investmentReturnRate }) }}
    </p>
    <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">
          {{ t('買わずに頭金＋諸費用 {amount} を投資 → {n}年後', { amount: formatMan(upfront), n: h.holdingYears }) }}
        </div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.downInvestFV) }}</div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">{{ t('借りて毎月浮く分（買うより安い差額）を投資 → 積み上がり') }}</div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.diffInvestFV) }}</div>
      </div>
    </div>
    <div class="mt-3"><CostChart :series="invest" :marker="h.holdingYears" /></div>

    <h3 class="mt-6 text-sm font-bold">{{ t('家計から見た資産の積み上がり') }}</h3>
    <p class="mt-1 text-sm text-mute">
      {{ t('毎月の手取りから、生活費と住居費を払った残りを投資に回し続けたら、{n}年後の手元の資産はいくら？', { n: h.holdingYears }) }}
    </p>

    <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="font-semibold">{{ t('買う場合') }}</div>
        <div class="num mt-1 text-xs leading-relaxed text-mute">
          {{ t('手取り') }} {{ formatYen(h.monthlyIncome) }}<br />
          − {{ t('生活費') }} {{ formatYen(h.monthlyLivingCost) }}<br />
          − {{ t('住居費') }} {{ formatYen(r.firstYearCashMonthly) }}（{{ t('ローン・税・保険・修繕・管理費') }}）
        </div>
        <div class="mt-1 text-xs text-mute">{{ t('＝ 毎月投資に回せる額') }}</div>
        <div class="num text-lg font-bold" :class="r.shortfallBuy ? 'text-opp' : ''">
          {{ formatYen(r.surplusBuyMonthly) }}
        </div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="font-semibold">{{ t('借りる場合') }}</div>
        <div class="num mt-1 text-xs leading-relaxed text-mute">
          {{ t('手取り') }} {{ formatYen(h.monthlyIncome) }}<br />
          − {{ t('生活費') }} {{ formatYen(h.monthlyLivingCost) }}<br />
          − {{ t('住居費') }} {{ formatYen(r.rentMonthlyFirst) }}（{{ t('家賃・管理費・駐車場など') }}）
        </div>
        <div class="mt-1 text-xs text-mute">{{ t('＝ 毎月投資に回せる額') }}</div>
        <div class="num text-lg font-bold">{{ formatYen(r.surplusRentMonthly) }}</div>
      </div>
    </div>
    <p v-if="r.shortfallBuy" class="mt-2 text-xs text-opp">
      {{ t('この条件では、月収から生活費と住居費を引くと赤字になります。') }}
    </p>

    <div class="mt-3"><CostChart :series="wealth" :marker="h.holdingYears" /></div>

    <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">{{ t('買う：{n}年後の資産合計', { n: h.holdingYears }) }}</div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.buyWealth) }}</div>
        <div class="num text-xs text-mute">
          {{ t('家（土地・建物の評価額 − ローン残高）') }}{{ formatMan(buyEquity) }}<br />
          ＋ {{ t('投資') }} {{ formatMan(r.holding.buyWealth - buyEquity) }}
        </div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <div class="text-mute">{{ t('借りる：{n}年後の資産合計', { n: h.holdingYears }) }}</div>
        <div class="num text-lg font-bold">{{ formatMan(r.holding.rentWealth) }}</div>
        <div class="num text-xs text-mute">{{ t('すべて投資（家は持たない）') }}</div>
      </div>
    </div>

    <div class="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-mute">
      <p class="font-semibold text-ink">{{ t('この試算の前提') }}</p>
      <ul class="list-disc space-y-1 pl-4">
        <li>{{ t('買う場合：手持ち資金は頭金と諸費用に使うので、投資は0円からスタート。') }}</li>
        <li>{{ t('借りる場合：頭金と諸費用に使うはずだった額から、賃貸の初期費用を引いた残りを最初に一括投資。') }}</li>
        <li>{{ t('上の住居費は初年度の金額です。計算では、金利上昇や管理費の上昇、家賃の上昇に応じて毎年の余りを変えています。') }}</li>
        <li>{{ t('どちらも毎月の余りを同じ利回り（{rate}%・仮定）で積み立てて運用。', { rate: h.investmentReturnRate }) }}</li>
        <li>{{ t('買う側の家は売却しない前提で、土地・建物の評価額（建物は年数とともに価値が下がる）からローン残高を引いて計上。') }}</li>
        <li>{{ t('利回りや土地の価格の設定次第で結果は大きく変わります。「家だけが資産形成の方法ではない」ことを確認するための試算で、どちらが得かを断定するものではありません。') }}</li>
      </ul>
    </div>
  </section>
</template>
