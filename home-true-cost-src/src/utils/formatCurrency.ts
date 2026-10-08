import { locale } from '../i18n'

const nf = new Intl.NumberFormat('ja-JP')

export const formatYen = (n: number): string => `${n < 0 ? '-' : ''}¥${nf.format(Math.round(Math.abs(n)))}`

/** 例: 5,000万円 / 1.2億円（中国語: 5,000万日元 / 1.2亿日元） */
export function formatMan(n: number): string {
  const zh = locale.value === 'zh'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2).replace(/\.?0+$/, '')}${zh ? '亿日元' : '億円'}`
  return `${sign}${nf.format(Math.round(abs / 10_000))}${zh ? '万日元' : '万円'}`
}

export const formatNumber = (n: number): string => nf.format(Math.round(n))

export const formatPercent = (n: number, digits = 0): string => `${(n * 100).toFixed(digits)}%`
