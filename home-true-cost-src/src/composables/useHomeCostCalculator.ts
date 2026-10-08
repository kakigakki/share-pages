import { computed, reactive, ref } from 'vue'
import type { BuildingAge, HomePurchaseInput, LoanType, PropertyType, RateMode, RentInput } from '../types/calculator'
import {
  estimateCityPlanningTax,
  estimateEarthquakeInsurance,
  estimateFireInsurance,
  estimateFixedAssetTax,
  estimateInitialCostItems,
  estimateRepairCostPerYear,
} from '../utils/japaneseTaxes'
import { calculateBuyVsRent, judgeAffordability, simulate } from '../utils/simulation'

/** 「概算 / 仮定 / 情景」のどれとして表示するか */
export type EstimateKind = '概算' | '仮定' | '情景'

export type OverrideKey =
  | 'rateRiseConservative'
  | 'rateRiseAggressive'
  | 'rateRisePace'
  | 'holdingYears'
  | 'fixedAssetTax'
  | 'cityPlanningTax'
  | 'fireInsurance'
  | 'earthquakeInsurance'
  | 'repairCostPerYear'
  | 'managementFee'
  | 'repairReserve'
  | 'parkingFee'
  | 'mgmtGrowthRate'
  | 'initialCosts'
  | 'landRatio'
  | 'buildingLifeYears'
  | 'expectedPropertyGrowthRate'
  | 'investmentReturnRate'
  | 'monthlyIncome'
  | 'monthlyLivingCost'
  | 'rentManagementFee'
  | 'rentParkingFee'
  | 'renewalCostPerYear'
  | 'rentInsurancePerYear'
  | 'rentInitialCost'
  | 'rentGrowthRate'

export function useHomeCostCalculator() {
  const base = reactive({
    price: 50_000_000,
    downPayment: 5_000_000,
    rateMode: 'variable_conservative' as RateMode,
    fixedRate: 3.8, // 2026年10月 フラット35の最多金利 3.83% を参考
    variableRate: 1.2, // 2026年9月 新規借入の変動金利の平均 約1.2% を参考
    loanYears: 35,
    loanType: 'equal_payment' as LoanType,
    propertyType: 'condo' as PropertyType,
    buildingAge: 'new' as BuildingAge,
    monthlyRent: 150_000,
  })
  const overrides = reactive<Partial<Record<OverrideKey, number>>>({})
  const initialItemOverrides = reactive<Record<string, number>>({})

  const calculated = ref(false)

  const initialItems = computed(() =>
    estimateInitialCostItems(base.price, base.buildingAge).map((i) => ({
      ...i,
      estimate: i.value,
      value: initialItemOverrides[i.key] ?? i.value,
    })),
  )

  const defaults = computed<Record<OverrideKey, number>>(() => {
    const condo = base.propertyType === 'condo'
    return {
      holdingYears: 35,
      rateRiseConservative: 2.0,
      rateRiseAggressive: 0.5,
      rateRisePace: 0.25,
      fixedAssetTax: estimateFixedAssetTax(base.price, base.propertyType),
      cityPlanningTax: estimateCityPlanningTax(base.price),
      fireInsurance: estimateFireInsurance(base.propertyType),
      earthquakeInsurance: estimateEarthquakeInsurance(base.propertyType),
      repairCostPerYear: estimateRepairCostPerYear(base.propertyType),
      managementFee: condo ? 15_000 : 0,
      repairReserve: condo ? 15_000 : 0,
      parkingFee: condo ? 10_000 : 0,
      mgmtGrowthRate: 1,
      initialCosts: initialItems.value.reduce((s, i) => s + i.value, 0),
      landRatio: condo ? 30 : 50,
      buildingLifeYears: condo ? 50 : 30,
      expectedPropertyGrowthRate: 0,
      investmentReturnRate: 5,
      monthlyIncome: 600_000,
      monthlyLivingCost: 300_000,
      rentManagementFee: 5_000,
      rentParkingFee: 10_000,
      renewalCostPerYear: 75_000,
      rentInsurancePerYear: 15_000,
      rentInitialCost: 300_000,
      rentGrowthRate: 0,
    }
  })

  const value = (k: OverrideKey) => overrides[k] ?? defaults.value[k]
  const isOverridden = (k: OverrideKey) => overrides[k] !== undefined
  const setOverride = (k: OverrideKey, v: number) => {
    overrides[k] = v
    if (k === 'initialCosts') for (const key of Object.keys(initialItemOverrides)) delete initialItemOverrides[key]
  }
  const resetOverride = (k: OverrideKey) => {
    delete overrides[k]
    if (k === 'initialCosts') for (const key of Object.keys(initialItemOverrides)) delete initialItemOverrides[key]
  }
  const setInitialItem = (key: string, v: number) => {
    initialItemOverrides[key] = v
    delete overrides.initialCosts
  }

  const riseCap = (m: RateMode) =>
    m === 'fixed' ? 0 : m === 'variable_conservative' ? value('rateRiseConservative') : value('rateRiseAggressive')

  /** 画面の「年利」入力欄が編集する対象（選択中の金利タイプの当初年利） */
  const currentRate = computed({
    get: () => (base.rateMode === 'fixed' ? base.fixedRate : base.variableRate),
    set: (v: number) => {
      if (base.rateMode === 'fixed') base.fixedRate = v
      else base.variableRate = v
    },
  })

  const home = computed<HomePurchaseInput>(() => ({
    price: base.price,
    downPayment: Math.min(base.downPayment, base.price),
    interestRate: base.rateMode === 'fixed' ? base.fixedRate : base.variableRate,
    rateMode: base.rateMode,
    rateRiseCap: riseCap(base.rateMode),
    rateRisePace: value('rateRisePace'),
    loanYears: base.loanYears,
    loanType: base.loanType,
    propertyType: base.propertyType,
    buildingAge: base.buildingAge,
    holdingYears: value('holdingYears'),
    fixedAssetTax: value('fixedAssetTax'),
    cityPlanningTax: value('cityPlanningTax'),
    fireInsurance: value('fireInsurance'),
    earthquakeInsurance: value('earthquakeInsurance'),
    repairCostPerYear: value('repairCostPerYear'),
    managementFee: value('managementFee'),
    repairReserve: value('repairReserve'),
    parkingFee: value('parkingFee'),
    mgmtGrowthRate: value('mgmtGrowthRate'),
    initialCosts: overrides.initialCosts ?? initialItems.value.reduce((s, i) => s + i.value, 0),
    landRatio: value('landRatio'),
    buildingLifeYears: value('buildingLifeYears'),
    expectedPropertyGrowthRate: value('expectedPropertyGrowthRate'),
    investmentReturnRate: value('investmentReturnRate'),
    monthlyIncome: value('monthlyIncome'),
    monthlyLivingCost: value('monthlyLivingCost'),
  }))

  const rent = computed<RentInput>(() => ({
    monthlyRent: base.monthlyRent,
    managementFee: value('rentManagementFee'),
    parkingFee: value('rentParkingFee'),
    renewalCostPerYear: value('renewalCostPerYear'),
    insurancePerYear: value('rentInsurancePerYear'),
    initialCost: value('rentInitialCost'),
    rentGrowthRate: value('rentGrowthRate'),
  }))

  const result = computed(() => simulate(home.value, rent.value))
  const buyVsRent = computed(() => calculateBuyVsRent(result.value))
  const affordability = computed(() => judgeAffordability(result.value.firstYearCashMonthly, home.value.monthlyIncome))

  /** 土地の価格変化率の3情景（悲観/中立/楽観）。各情景で同じ他条件を使う */
  /** 固定 / 変動（慎重） / 変動（積極）を同じ条件で並べて比較 */
  const rateComparison = computed(() =>
    (['fixed', 'variable_conservative', 'variable_aggressive'] as RateMode[]).map((mode) => {
      const h: HomePurchaseInput = {
        ...home.value,
        rateMode: mode,
        interestRate: mode === 'fixed' ? base.fixedRate : base.variableRate,
        rateRiseCap: riseCap(mode),
      }
      const res = simulate(h, rent.value)
      return { mode, home: h, result: res }
    }),
  )

  const scenarios = computed(() =>
    [-1, 0, 1].map((g) => {
      const r = simulate({ ...home.value, expectedPropertyGrowthRate: g }, rent.value)
      return { growth: g, label: g < 0 ? '悲観' : g === 0 ? '中立' : '楽観', result: r }
    }),
  )

  return {
    base,
    overrides,
    calculated,
    defaults,
    initialItems,
    value,
    isOverridden,
    setOverride,
    resetOverride,
    setInitialItem,
    home,
    rent,
    result,
    buyVsRent,
    affordability,
    scenarios,
    currentRate,
    rateComparison,
  }
}

export type HomeCostCalculator = ReturnType<typeof useHomeCostCalculator>
