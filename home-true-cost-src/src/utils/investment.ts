/** 一括投資の将来価値 FV = PV × (1+r)^n（r は年率%） */
export function calculateInvestmentFutureValue(pv: number, annualPct: number, years: number): number {
  return pv * Math.pow(1 + annualPct / 100, years)
}

/** 機会費用 = 投資していれば得られた増加分 */
export function calculateOpportunityCost(pv: number, annualPct: number, years: number): number {
  return calculateInvestmentFutureValue(pv, annualPct, years) - pv
}

/** 年率を等価な月利に変換 */
export function monthlyRateFromAnnual(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1
}

/** 将来の物件価値（年変化率の情景シミュレーション。予測ではない） */
export function calculateFuturePropertyValue(price: number, growthPct: number, years: number): number {
  return price * Math.pow(1 + growthPct / 100, years)
}

/** 建物の評価額：購入時の建物価格から、耐用年数に向けて線形にゼロへ（概算） */
export function calculateBuildingValue(buildingPrice: number, lifeYears: number, years: number): number {
  if (lifeYears <= 0) return 0
  return buildingPrice * Math.max(0, 1 - years / lifeYears)
}
