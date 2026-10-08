<script setup lang="ts">
import { computed } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'

const props = defineProps<{ calc: HomeCostCalculator }>()
const r = computed(() => props.calc.result.value)
const principalShare = computed(() =>
  r.value.loanFirstPayment ? r.value.loanFirstPrincipal / r.value.loanFirstPayment : 0,
)
</script>

<template>
  <section class="rounded-2xl border border-line bg-white p-5">
    <h2 class="text-base font-bold">① ローンの中身</h2>
    <dl class="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
      <div>
        <dt class="text-mute">借入額</dt>
        <dd class="num text-lg font-bold">{{ formatMan(r.loanAmount) }}</dd>
      </div>
      <div>
        <dt class="text-mute">{{ calc.base.loanType === 'equal_payment' ? '毎月返済' : '初月返済' }}</dt>
        <dd class="num text-lg font-bold">{{ formatYen(r.loanFirstPayment) }}</dd>
      </div>
      <div>
        <dt class="text-mute">総返済額</dt>
        <dd class="num text-lg font-bold">{{ formatMan(r.loanTotalPayment) }}</dd>
      </div>
      <div>
        <dt class="text-mute">総利息</dt>
        <dd class="num text-lg font-bold text-opp">{{ formatMan(r.loanTotalInterest) }}</dd>
      </div>
    </dl>
    <div class="mt-5">
      <div class="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <div class="bg-accent" :style="{ width: principalShare * 100 + '%' }" />
        <div class="bg-opp/70" :style="{ width: (1 - principalShare) * 100 + '%' }" />
      </div>
      <p class="mt-2 text-xs leading-relaxed text-mute">
        初月の返済のうち、元本 {{ formatYen(r.loanFirstPrincipal) }}（資産の購入に充てられる部分）、利息
        {{ formatYen(r.loanFirstInterest) }}（純粋なコスト）。返済額＝住居費ではありません。
      </p>
    </div>
  </section>
</template>
