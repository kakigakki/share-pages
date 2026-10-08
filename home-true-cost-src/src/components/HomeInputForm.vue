<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HomeCostCalculator } from '../composables/useHomeCostCalculator'
import { formatMan, formatYen } from '../utils/formatCurrency'
import NumberField from './NumberField.vue'
import OverrideField from './OverrideField.vue'
import SegToggle from './SegToggle.vue'

const props = defineProps<{ calc: HomeCostCalculator }>()
const c = props.calc
const showDetail = ref(false)
const initialDetail = ref(false)

const isCondo = computed(() => c.base.propertyType === 'condo')
const loanAmount = computed(() => Math.max(0, c.base.price - c.base.downPayment))
</script>

<template>
  <div class="space-y-5">
    <section class="space-y-4 rounded-2xl border border-line bg-white p-5">
      <h2 class="text-sm font-bold text-mute">まず、この6つだけ</h2>
      <div class="grid grid-cols-2 gap-3">
        <SegToggle
          v-model="c.base.propertyType"
          :options="[
            { value: 'condo', label: 'マンション' },
            { value: 'house', label: '戸建て' },
          ]"
        />
        <SegToggle
          v-model="c.base.buildingAge"
          :options="[
            { value: 'new', label: '新築' },
            { value: 'used', label: '中古' },
          ]"
        />
      </div>
      <NumberField v-model="c.base.price" label="物件価格" unit="万円" :scale="10000" :hint="formatYen(c.base.price)" />
      <NumberField v-model="c.base.downPayment" label="頭金" unit="万円" :scale="10000" :hint="`借入額 ${formatMan(loanAmount)}（${formatYen(loanAmount)}）`" />
      <SegToggle
        v-model="c.base.rateMode"
        label="金利タイプ"
        :options="[
          { value: 'fixed', label: '固定' },
          { value: 'variable_conservative', label: '変動・慎重' },
          { value: 'variable_aggressive', label: '変動・積極' },
        ]"
      />
      <p class="-mt-2 text-[11px] leading-relaxed text-mute">
        目安（2026年9〜10月）：変動 約1.2%／フラット35 最多 3.83%。慎重は金利が大きく上がる前提、積極は小幅な上昇で止まる前提。
      </p>
      <div class="grid grid-cols-2 gap-3">
        <NumberField
          v-model="c.currentRate.value"
          :label="c.base.rateMode === 'fixed' ? '年利（固定）' : '当初年利（変動）'"
          unit="%"
          decimal
        />
        <NumberField v-model="c.base.loanYears" label="返済期間" unit="年" />
      </div>
      <NumberField
        v-model="c.base.monthlyRent"
        label="比較用の月額家賃"
        unit="円/月"
        hint="今の家賃、または同条件で借りた場合"
      />
      <button
        v-if="!c.calculated.value"
        type="button"
        class="w-full rounded-xl bg-accent py-3.5 text-[15px] font-bold text-white transition active:scale-[0.99]"
        @click="c.calculated.value = true"
      >
        まず計算する
      </button>
    </section>

    <template v-if="c.calculated.value">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 text-left"
        @click="showDetail = !showDetail"
      >
        <span>
          <span class="block text-sm font-bold">さらに精度を上げる</span>
          <span class="text-xs text-mute">税・保険・修繕・管理費・機会費用・家計</span>
        </span>
        <span class="text-mute">{{ showDetail ? '▲' : '▼' }}</span>
      </button>

      <div v-if="showDetail" class="space-y-5">
        <section class="space-y-4 rounded-2xl border border-line bg-white p-5">
          <SegToggle
            v-model="c.base.loanType"
            label="返済方式"
            :options="[
              { value: 'equal_payment', label: '元利均等' },
              { value: 'equal_principal', label: '元金均等' },
            ]"
          />
        </section>

        <section class="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h3 class="text-sm font-bold">保有コスト</h3>
          <OverrideField :calc="c" k="fixedAssetTax" label="固定資産税" unit="円/年" tag="概算" hint="これは税務計算ではなく概算です。実際の税額が分かれば入力してください。" />
          <OverrideField :calc="c" k="cityPlanningTax" label="都市計画税" unit="円/年" tag="概算" />
          <OverrideField :calc="c" k="fireInsurance" label="火災保険" unit="円/年" tag="概算" />
          <OverrideField :calc="c" k="earthquakeInsurance" label="地震保険" unit="円/年" tag="概算" />
          <OverrideField :calc="c" k="repairCostPerYear" label="年度修繕準備金" unit="円/年" tag="概算" hint="外壁・屋根・設備更新などの年平均の目安" />
          <template v-if="isCondo">
            <OverrideField :calc="c" k="managementFee" label="管理費" unit="円/月" tag="概算" />
            <OverrideField :calc="c" k="repairReserve" label="修繕積立金" unit="円/月" tag="概算" />
            <OverrideField :calc="c" k="mgmtGrowthRate" label="管理費・積立金の年上昇率" unit="%" tag="仮定" decimal />
          </template>
          <OverrideField :calc="c" k="parkingFee" label="駐車場" unit="円/月" tag="概算" />
        </section>

        <section class="space-y-4 rounded-2xl border border-line bg-white p-5">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold">
              購入時の諸費用
              <span class="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">概算</span>
            </h3>
            <button type="button" class="text-xs text-accent underline" @click="initialDetail = !initialDetail">
              {{ initialDetail ? '簡易設定' : '詳細設定' }}
            </button>
          </div>
          <NumberField
            v-if="!initialDetail"
            :model-value="c.home.value.initialCosts"
            label="諸費用 合計"
            unit="円"
            :overridden="c.isOverridden('initialCosts')"
            @update:model-value="(v) => c.setOverride('initialCosts', v)"
            @reset="c.resetOverride('initialCosts')"
          />
          <template v-else>
            <NumberField
              v-for="i in c.initialItems.value"
              :key="i.key"
              :model-value="i.value"
              :label="i.label"
              unit="円"
              @update:model-value="(v) => c.setInitialItem(i.key, v)"
            />
            <div class="num text-right text-sm font-semibold">合計 {{ formatYen(c.home.value.initialCosts) }}</div>
          </template>
          <p class="text-[11px] text-mute">概算値です。実際の金額は物件・地域・契約条件によって異なります。</p>
        </section>

        <section class="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h3 class="text-sm font-bold">前提条件</h3>
          <OverrideField :calc="c" k="holdingYears" label="保有年数" unit="年" />
          <OverrideField :calc="c" k="investmentReturnRate" label="資金の投資利回り（機会費用）" unit="%" tag="仮定" decimal hint="頭金などを投資に回した場合の年率。将来の運用成果を保証するものではありません。" />
                      <OverrideField :calc="c" k="rateRiseConservative" label="慎重シナリオ：金利の最大上昇幅" unit="pt" tag="仮定" decimal hint="当初年利からこの幅まで段階的に上がる前提。" />
            <OverrideField :calc="c" k="rateRiseAggressive" label="積極シナリオ：金利の最大上昇幅" unit="pt" tag="仮定" decimal />
            <OverrideField :calc="c" k="rateRisePace" label="上昇ペース" unit="pt/年" tag="仮定" decimal hint="半年ごとの見直しで反映。実際の5年ルール・125%ルールは考慮していません。" />
          <OverrideField :calc="c" k="landRatio" label="土地の割合（物件価格に占める）" unit="%" tag="概算" decimal hint="建物は年数とともに価値が下がり、残るのは主に土地という前提で評価額を出します。" />
          <OverrideField :calc="c" k="buildingLifeYears" label="建物の評価がゼロになる年数" unit="年" tag="概算" hint="木造戸建ては30年前後が目安（税務上の耐用年数は22年）。" />
          <OverrideField :calc="c" k="expectedPropertyGrowthRate" label="土地の年変化率" unit="%" tag="情景" decimal hint="予測ではなく、条件を変えて見るための設定です。" />
        </section>

        <section class="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h3 class="text-sm font-bold">家計（買えるか・投資に回せるか）</h3>
          <OverrideField :calc="c" k="monthlyIncome" label="世帯月収（手取り）" unit="円/月" />
          <OverrideField :calc="c" k="monthlyLivingCost" label="住居費を除く月の生活費" unit="円/月" />
        </section>

        <section class="space-y-4 rounded-2xl border border-line bg-white p-5">
          <h3 class="text-sm font-bold">賃貸の条件</h3>
          <OverrideField :calc="c" k="rentManagementFee" label="管理費・共益費" unit="円/月" />
          <OverrideField :calc="c" k="rentParkingFee" label="駐車場" unit="円/月" />
          <OverrideField :calc="c" k="renewalCostPerYear" label="更新費用（年平均）" unit="円/年" tag="概算" />
          <OverrideField :calc="c" k="rentInsurancePerYear" label="火災保険" unit="円/年" tag="概算" />
          <OverrideField :calc="c" k="rentInitialCost" label="初期費用" unit="円" tag="概算" />
          <OverrideField :calc="c" k="rentGrowthRate" label="家賃の年上昇率" unit="%" tag="仮定" decimal />
        </section>
      </div>
    </template>
  </div>
</template>
