import type { HomePurchaseInput, RentInput, SimulationResult, YearRow } from '../types/calculator'
import {
  buildLoanSchedule,
  calculateRemainingLoan,
  calculateTotalInterest,
  calculateTotalPayment,
} from './mortgage'
import {
  calculateFuturePropertyValue,
  calculateInvestmentFutureValue,
  calculateOpportunityCost,
  monthlyRateFromAnnual,
} from './investment'
import { calculateNetSaleProceeds, calculateSellingCost } from './japaneseTaxes'

export const CHECKPOINT_YEARS = [1, 5, 10, 15, 20, 25, 30, 35]

export const horizonYears = (holdingYears: number) => Math.min(50, Math.max(35, holdingYears))

/** 年次シミュレーション。買う場合・借りる場合を同じ月次ループで積み上げる */
export function simulate(home: HomePurchaseInput, rent: RentInput): SimulationResult {
  const H = horizonYears(home.holdingYears)
  const loanAmount = Math.max(0, home.price - home.downPayment)
  const schedule = buildLoanSchedule(loanAmount, home.interestRate, home.loanYears, home.loanType)

  const upfront = home.downPayment + home.initialCosts
  const rm = monthlyRateFromAnnual(home.investmentReturnRate)
  const gm = home.mgmtGrowthRate / 100
  const gr = rent.rentGrowthRate / 100

  const fixedMonthlyHolding =
    (home.fixedAssetTax + home.cityPlanningTax + home.fireInsurance + home.earthquakeInsurance + home.repairCostPerYear) /
    12
  const holdingMonthly = (yIdx: number) =>
    fixedMonthlyHolding + (home.managementFee + home.repairReserve) * Math.pow(1 + gm, yIdx) + home.parkingFee
  const rentMonthly = (yIdx: number) =>
    (rent.monthlyRent + rent.managementFee + rent.parkingFee) * Math.pow(1 + gr, yIdx) +
    (rent.renewalCostPerYear + rent.insurancePerYear) / 12

  const rentUpfrontOpp = (y: number) => calculateOpportunityCost(rent.initialCost, home.investmentReturnRate, y)

  let buyCash = upfront
  let rentCash = rent.initialCost
  let investBuy = 0
  let investRent = Math.max(0, upfront - rent.initialCost)
  let diffInvest = 0

  const rows: YearRow[] = []
  const makeRow = (year: number): YearRow => {
    const m = year * 12
    const propertyValue = calculateFuturePropertyValue(home.price, home.expectedPropertyGrowthRate, year)
    const loanBalance = calculateRemainingLoan(schedule, loanAmount, m)
    const sellingCost = calculateSellingCost(propertyValue)
    const netSaleProceeds = calculateNetSaleProceeds(propertyValue, sellingCost, loanBalance)
    const opportunityCost = calculateOpportunityCost(upfront, home.investmentReturnRate, year)
    return {
      year,
      buyCashCum: buyCash,
      propertyValue,
      loanBalance,
      sellingCost,
      netSaleProceeds,
      opportunityCost,
      buyNetCost: buyCash - netSaleProceeds + opportunityCost,
      rentNetCost: rentCash + rentUpfrontOpp(year),
      buyWealth: netSaleProceeds + investBuy,
      rentWealth: investRent,
      downInvestFV: calculateInvestmentFutureValue(upfront, home.investmentReturnRate, year),
      diffInvestFV: diffInvest,
    }
  }
  rows.push(makeRow(0))

  for (let m = 1; m <= H * 12; m++) {
    const y = Math.floor((m - 1) / 12)
    const loanPay = schedule[m - 1]?.payment ?? 0
    const buyMonthly = loanPay + holdingMonthly(y)
    const rentM = rentMonthly(y)
    buyCash += buyMonthly
    rentCash += rentM
    const surplusBuy = home.monthlyIncome - home.monthlyLivingCost - buyMonthly
    const surplusRent = home.monthlyIncome - home.monthlyLivingCost - rentM
    investBuy = investBuy * (1 + rm) + Math.max(0, surplusBuy)
    investRent = investRent * (1 + rm) + Math.max(0, surplusRent)
    diffInvest = diffInvest * (1 + rm) + Math.max(0, buyMonthly - rentM)
    if (m % 12 === 0) rows.push(makeRow(m / 12))
  }

  const holding = rows[Math.min(home.holdingYears, H)]
  const loanFirstPayment = schedule[0]?.payment ?? 0
  const firstYearLoan = schedule.slice(0, 12).reduce((s, x) => s + x.payment, 0) / 12
  const hold1 = holdingMonthly(0)
  const firstYearCashMonthly = firstYearLoan + hold1
  const rentMonthlyFirst = rentMonthly(0)
  const monthsHeld = Math.max(1, home.holdingYears * 12)

  const surplusBuyMonthly = home.monthlyIncome - home.monthlyLivingCost - firstYearCashMonthly
  const surplusRentMonthly = home.monthlyIncome - home.monthlyLivingCost - rentMonthlyFirst

  return {
    rows,
    loanFirstPayment,
    loanTotalPayment: calculateTotalPayment(schedule),
    loanTotalInterest: calculateTotalInterest(schedule),
    loanFirstInterest: schedule[0]?.interest ?? 0,
    loanFirstPrincipal: schedule[0]?.principal ?? 0,
    loanAmount,
    firstYearCashMonthly,
    firstYearHoldingMonthly: hold1,
    rentMonthlyFirst,
    effectiveMonthly: holding.buyNetCost / monthsHeld,
    holding,
    breakdown: {
      loan: firstYearLoan,
      tax: (home.fixedAssetTax + home.cityPlanningTax) / 12,
      insurance: (home.fireInsurance + home.earthquakeInsurance) / 12,
      repair: home.repairCostPerYear / 12,
      management: home.managementFee + home.repairReserve + home.parkingFee,
      opportunity: (upfront * (home.investmentReturnRate / 100)) / 12,
    },
    rentBreakdownMonthly: rentMonthlyFirst,
    surplusBuyMonthly,
    surplusRentMonthly,
    shortfallBuy: surplusBuyMonthly < 0,
  }
}

export type Verdict = 'buy' | 'rent' | 'even'

/** 購入 vs 賃貸（保有期間時点の純コスト差。正なら購入のほうが安い） */
export function calculateBuyVsRent(result: SimulationResult): { diff: number; verdict: Verdict } {
  const { buyNetCost, rentNetCost } = result.holding
  const diff = rentNetCost - buyNetCost
  const base = Math.max(Math.abs(buyNetCost), Math.abs(rentNetCost), 1)
  if (Math.abs(diff) / base < 0.03) return { diff, verdict: 'even' }
  return { diff, verdict: diff > 0 ? 'buy' : 'rent' }
}

export type AffordabilityLevel = 'comfortable' | 'normal' | 'heavy' | 'severe'

export function judgeAffordability(monthlyHousing: number, monthlyIncome: number) {
  const ratio = monthlyIncome > 0 ? monthlyHousing / monthlyIncome : 0
  let level: AffordabilityLevel
  let label: string
  if (ratio < 0.2) [level, label] = ['comfortable', '比較的余裕があります']
  else if (ratio < 0.3) [level, label] = ['normal', '一般的な範囲']
  else if (ratio < 0.4) [level, label] = ['heavy', '家計への負担が大きくなります']
  else [level, label] = ['severe', 'かなり慎重に検討してください']
  return { ratio, level, label }
}
