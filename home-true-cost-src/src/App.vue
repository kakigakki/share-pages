<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useHomeCostCalculator } from './composables/useHomeCostCalculator'
import HomeInputForm from './components/HomeInputForm.vue'
import ResultHeadline from './components/ResultHeadline.vue'
import LoanSummary from './components/LoanSummary.vue'
import CostBreakdown from './components/CostBreakdown.vue'
import BuyVsRent from './components/BuyVsRent.vue'
import InvestmentComparison from './components/InvestmentComparison.vue'
import ScenarioTable from './components/ScenarioTable.vue'

const calc = useHomeCostCalculator()

watch(calc.calculated, async (on) => {
  if (!on) return
  await nextTick()
  document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
</script>

<template>
  <header class="mx-auto max-w-5xl px-5 pt-14 pb-8 sm:pt-20">
    <p class="text-xs font-semibold tracking-widest text-accent">HOME TRUE COST</p>
    <h1 class="mt-3 text-4xl font-extrabold leading-tight sm:text-6xl">買う前に、全部計算しよう。</h1>
    <p class="mt-4 max-w-xl text-base leading-relaxed text-mute sm:text-lg">
      住宅ローンだけでは見えない、<br />「家を持つ本当のコスト」を計算します。
    </p>
    <p class="mt-6 text-sm text-mute">広告の月々○万円だけで、家を買う判断をしていませんか？</p>
    <a
      v-if="!calc.calculated.value"
      href="#form"
      class="mt-5 inline-block rounded-xl bg-ink px-6 py-3.5 text-[15px] font-bold text-white"
    >
      買う場合のコストを計算する
    </a>
  </header>

  <main class="mx-auto max-w-5xl px-5 pb-16">
    <div
      id="form"
      class="scroll-mt-4"
      :class="calc.calculated.value ? 'grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start' : 'max-w-md'"
    >
      <div :class="calc.calculated.value ? 'lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto' : ''">
        <HomeInputForm :calc="calc" />
      </div>

      <div v-if="calc.calculated.value" id="results" class="min-w-0 scroll-mt-4 space-y-5">
        <ResultHeadline :calc="calc" />
        <LoanSummary :calc="calc" />
        <CostBreakdown :calc="calc" />
        <BuyVsRent :calc="calc" />
        <InvestmentComparison :calc="calc" />
        <ScenarioTable :calc="calc" />

        <section class="rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed">
          <h2 class="text-base font-bold">3つの「コスト」の違い</h2>
          <dl class="mt-3 space-y-3">
            <div>
              <dt class="font-semibold">① ローン返済額</dt>
              <dd class="text-mute">広告に載る数字。元本の返済（資産になる部分）と利息が含まれます。</dd>
            </div>
            <div>
              <dt class="font-semibold">② 実際の毎月支出（キャッシュフロー）</dt>
              <dd class="text-mute">ローンに、固定資産税・都市計画税・保険・修繕・管理費・駐車場を加えた、毎月実際に出ていく現金。</dd>
            </div>
            <div>
              <dt class="font-semibold">③ 実質月額（経済的コスト）</dt>
              <dd class="text-mute">
                累計の現金支出に頭金・諸費用の機会費用を加え、売却後に手元に残る金額を差し引いた「住むために失う価値」を居住月数で割ったもの。ローン元本は資産になるため、そのままコストにはなりません。
              </dd>
            </div>
          </dl>
          <p class="mt-3 text-xs text-mute">
            各数値は「概算」「仮定」「情景」のいずれかです。固定資産税・諸費用は概算、利回りは仮定、房価は情景として扱っています。
          </p>
        </section>
      </div>
    </div>
  </main>

  <footer class="border-t border-line bg-white">
    <div class="mx-auto max-w-5xl px-5 py-8 text-xs leading-relaxed text-mute">
      <p>
        本計算器は一般的な前提条件をもとにした概算シミュレーションです。税金、ローン、保険、修繕費、物件価格などの実際の金額を保証するものではありません。住宅購入の判断は、金融機関、不動産会社、税理士等の専門家にもご確認ください。
      </p>
      <p class="mt-2">入力内容はお使いのブラウザ内でのみ計算され、外部に送信されません。</p>
    </div>
  </footer>
</template>
