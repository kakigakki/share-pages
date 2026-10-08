import type { LoanType } from '../types/calculator'

export interface LoanMonth {
  month: number
  rate: number // その月の年利 %
  payment: number
  interest: number
  principal: number
  balance: number
}

/** 月ごとの年利(%)。固定なら定数、変動ならシナリオの経路 */
export type RatePath = (month: number) => number

/** 変動金利は半年ごとに見直し。当初年利から pace(pt/年) のペースで上がり、cap(pt) で頭打ち */
export function makeRiseRatePath(initialPct: number, capPt: number, pacePtPerYear: number): RatePath {
  return (k) => initialPct + Math.min(capPt, Math.floor((k - 1) / 6) * (pacePtPerYear / 2))
}

const monthlyRate = (annualPct: number) => annualPct / 100 / 12

/** 元利均等の毎月返済額（n回払い）M = P·r·(1+r)^n / ((1+r)^n − 1)。利率0は P/n。円未満四捨五入 */
export function calculateEqualPaymentMonths(principal: number, annualPct: number, n: number): number {
  if (principal <= 0 || n <= 0) return 0
  const r = monthlyRate(annualPct)
  if (r === 0) return Math.round(principal / n)
  const g = Math.pow(1 + r, n)
  return Math.round((principal * r * g) / (g - 1))
}

export function calculateEqualPayment(principal: number, annualPct: number, years: number): number {
  return calculateEqualPaymentMonths(principal, annualPct, Math.round(years * 12))
}

/**
 * 返済スケジュール（毎月）。最終回で端数を調整し、残高は必ず0になる。
 * 変動金利は見直しのたびに残りの期間で再計算する単純化（実際の5年ルール・125%ルールは考慮しない）。
 */
export function buildLoanSchedule(
  principal: number,
  rate: number | RatePath,
  years: number,
  type: LoanType = 'equal_payment',
): LoanMonth[] {
  const n = Math.round(years * 12)
  if (principal <= 0 || n <= 0) return []
  const rateAt: RatePath = typeof rate === 'number' ? () => rate : rate
  const principalPart = Math.round(principal / n)
  const out: LoanMonth[] = []
  let bal = principal
  let fixedPay = 0
  for (let k = 1; k <= n; k++) {
    const pct = rateAt(k)
    if (k === 1 || (k - 1) % 6 === 0) fixedPay = calculateEqualPaymentMonths(bal, pct, n - k + 1)
    const interest = Math.round(bal * monthlyRate(pct))
    let pay: number
    if (k === n) pay = bal + interest
    else if (type === 'equal_payment') pay = Math.min(fixedPay, bal + interest)
    else pay = Math.min(principalPart, bal) + interest
    const prin = pay - interest
    bal -= prin
    out.push({ month: k, rate: pct, payment: pay, interest, principal: prin, balance: bal })
  }
  return out
}

/** 初月の返済額 */
export function calculateLoanPayment(
  principal: number,
  annualPct: number,
  years: number,
  type: LoanType = 'equal_payment',
): number {
  return buildLoanSchedule(principal, annualPct, years, type)[0]?.payment ?? 0
}

export function calculateTotalInterest(schedule: LoanMonth[]): number {
  return schedule.reduce((s, m) => s + m.interest, 0)
}

export function calculateTotalPayment(schedule: LoanMonth[]): number {
  return schedule.reduce((s, m) => s + m.payment, 0)
}

/** monthsElapsed ヶ月後のローン残高 */
export function calculateRemainingLoan(schedule: LoanMonth[], principal: number, monthsElapsed: number): number {
  if (monthsElapsed <= 0) return principal
  if (monthsElapsed >= schedule.length) return 0
  return schedule[monthsElapsed - 1].balance
}
