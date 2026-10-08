import type { BuildingAge, PropertyType } from '../types/calculator'

/**
 * すべて「概算」。法定の固定値ではなく、物件・地域・契約条件で大きく変わる。
 * 固定資産税は評価額（購入価格ではない）に基づくため、ここでは実勢の傾向から価格比で粗く置く。
 */
export function estimateFixedAssetTax(price: number, type: PropertyType): number {
  return Math.round((price * (type === 'house' ? 0.0028 : 0.0026)) / 1000) * 1000
}

export function estimateCityPlanningTax(price: number): number {
  return Math.round((price * 0.0005) / 1000) * 1000
}

export const estimateFireInsurance = (type: PropertyType) => (type === 'house' ? 50_000 : 20_000)
export const estimateEarthquakeInsurance = (type: PropertyType) => (type === 'house' ? 30_000 : 15_000)
export const estimateRepairCostPerYear = (type: PropertyType) => (type === 'house' ? 150_000 : 0)

export interface InitialCostItem {
  key: string
  label: string
  value: number
}

/** 購入時の諸費用の概算内訳 */
export function estimateInitialCostItems(price: number, age: BuildingAge): InitialCostItem[] {
  const brokerage = age === 'used' ? Math.round((price * 0.03 + 60_000) * 1.1) : 0
  return [
    { key: 'brokerage', label: '仲介手数料', value: brokerage },
    { key: 'registration', label: '登録免許税・司法書士費用', value: Math.round(price * 0.007 + 100_000) },
    { key: 'stamp', label: '印紙税・不動産取得税', value: Math.round(50_000 + price * 0.003) },
    { key: 'fireInitial', label: '火災保険（初期）', value: 100_000 },
    { key: 'moving', label: '引越し', value: 150_000 },
    { key: 'furniture', label: '家具・家電', value: 500_000 },
    { key: 'renovation', label: '装修', value: age === 'used' ? 1_000_000 : 0 },
  ]
}

/** 売却時の費用（仲介手数料＋その他）の概算 */
export function calculateSellingCost(salePrice: number): number {
  if (salePrice <= 0) return 0
  return Math.round((salePrice * 0.03 + 60_000) * 1.1 + 100_000)
}

export const calculateNetSaleProceeds = (salePrice: number, sellingCost: number, remainingLoan: number) =>
  salePrice - sellingCost - remainingLoan
