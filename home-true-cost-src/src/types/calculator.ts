export type PropertyType = 'house' | 'condo'
export type LoanType = 'equal_payment' | 'equal_principal'
export type BuildingAge = 'new' | 'used'
export type RateMode = 'fixed' | 'variable_conservative' | 'variable_aggressive'

/** 金額は円、期間は年/月、率は % 表記（例: 1.0 = 1.0%） */
export interface HomePurchaseInput {
  price: number
  downPayment: number
  interestRate: number // 当初年利 %
  rateMode: RateMode
  rateRiseCap: number // 変動時：当初からの最大上昇幅 pt（固定は0）
  rateRisePace: number // 変動時：上昇ペース pt/年
  loanYears: number
  loanType: LoanType
  propertyType: PropertyType
  buildingAge: BuildingAge
  holdingYears: number

  fixedAssetTax: number // 円/年
  cityPlanningTax: number // 円/年
  fireInsurance: number // 円/年
  earthquakeInsurance: number // 円/年
  repairCostPerYear: number // 円/年（年度修繕準備金）

  managementFee: number // 円/月（マンション）
  repairReserve: number // 円/月（マンション）
  parkingFee: number // 円/月
  mgmtGrowthRate: number // %/年（管理費・修繕積立金の上昇率）

  initialCosts: number // 購入時の諸費用合計

  landRatio: number // 物件価格に占める土地の割合 %（概算）
  buildingLifeYears: number // 建物の評価がゼロになるまでの年数（概算）
  expectedPropertyGrowthRate: number // %/年（土地のみに適用する情景シミュレーション）
  investmentReturnRate: number // %/年（仮定）

  monthlyIncome: number
  monthlyLivingCost: number // 住居費を除く生活費
}

export interface RentInput {
  monthlyRent: number
  managementFee: number
  parkingFee: number
  renewalCostPerYear: number
  insurancePerYear: number
  initialCost: number
  rentGrowthRate: number // %/年
}

export interface YearRow {
  year: number
  buyCashCum: number // 累計現金支出（頭金・諸費用含む）
  landValue: number
  buildingValue: number
  propertyValue: number // 土地＋建物の評価額（売却しない前提の参考値）
  loanBalance: number
  opportunityCost: number
  buyNetCost: number // 累計現金支出＋機会費用（資産評価額は差し引かない）
  buyNetCostIfSold: number // 保有期間末に売却した場合：上記 − (評価額 − 売却費用 − ローン残高)
  buyNetCostAfterAsset: number // 上記 − (評価額 − ローン残高)
  rentNetCost: number
  buyWealth: number
  rentWealth: number
  downInvestFV: number
  diffInvestFV: number
}

export interface MonthlyBreakdown {
  loan: number
  tax: number
  insurance: number
  repair: number
  management: number // 管理費・修繕積立金・駐車場
  opportunity: number
}

export interface SimulationResult {
  rows: YearRow[] // index = year
  loanFirstPayment: number
  loanPeakPayment: number // 返済期間中の最大の月返済額
  loanPeakRate: number // 返済期間中の最高年利 %
  loanTotalPayment: number
  loanTotalInterest: number
  loanFirstInterest: number
  loanFirstPrincipal: number
  loanAmount: number
  firstYearCashMonthly: number // ② 実際の毎月支出（初年度平均）
  firstYearHoldingMonthly: number
  rentMonthlyFirst: number
  effectiveMonthlyIfSold: number // 期間末に売却した場合の実質月額
  effectiveMonthly: number // ③ 実質月額（保有期間平均）
  holding: YearRow
  breakdown: MonthlyBreakdown
  rentBreakdownMonthly: number
  surplusBuyMonthly: number
  surplusRentMonthly: number
  shortfallBuy: boolean
}
