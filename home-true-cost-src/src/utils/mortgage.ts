import type { LoanType } from '../types/calculator'

export interface LoanMonth {
  month: number
  payment: number
  interest: number
  principal: number
  balance: number
}

const monthlyRate = (annualPct: number) => annualPct / 100 / 12

/** 元利均等の毎月返済額 M = P·r·(1+r)^n / ((1+r)^n − 1)。利率0は P/n。円未満四捨五入 */
export function calculateEqualPayment(principal: number, annualPct: number, years: number): number {
  const n = Math.round(years * 12)
  if (principal <= 0 || n <= 0) return 0
  const r = monthlyRate(annualPct)
  if (r === 0) return Math.round(principal / n)
  const g = Math.pow(1 + r, n)
  return Math.round((principal * r * g) / (g - 1))
}

/** 返済スケジュール（毎月）。最終回で端数を調整し、残高は必ず0になる */
export function buildLoanSchedule(
  principal: number,
  annualPct: number,
  years: number,
  type: LoanType = 'equal_payment',
): LoanMonth[] {
  const n = Math.round(years * 12)
  if (principal <= 0 || n <= 0) return []
  const r = monthlyRate(annualPct)
  const fixed = calculateEqualPayment(principal, annualPct, years)
  const principalPart = Math.round(principal / n)
  const out: LoanMonth[] = []
  let bal = principal
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(bal * r)
    let pay: number
    if (k === n) pay = bal + interest
    else if (type === 'equal_payment') pay = Math.min(fixed, bal + interest)
    else pay = Math.min(principalPart, bal) + interest
    const prin = pay - interest
    bal -= prin
    out.push({ month: k, payment: pay, interest, principal: prin, balance: bal })
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
export function calculateRemainingLoan(
  schedule: LoanMonth[],
  principal: number,
  monthsElapsed: number,
): number {
  if (monthsElapsed <= 0) return principal
  if (monthsElapsed >= schedule.length) return 0
  return schedule[monthsElapsed - 1].balance
}
