import { ref } from 'vue'
import zh from './zh'

export type Locale = 'ja' | 'zh'

const STORAGE_KEY = 'home-true-cost.locale'

/** 言語切替ボタンを表示するか。false の間は常に日本語（保存済みの言語設定や端末の言語も無視する） */
export const LANGUAGE_SWITCH_ENABLED = false

function initialLocale(): Locale {
  if (!LANGUAGE_SWITCH_ENABLED) return 'ja'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ja' || saved === 'zh') return saved
  } catch {
    // localStorage が使えない環境では端末の言語設定に従う
  }
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'ja'
}

export const locale = ref<Locale>(initialLocale())

function applyDocument(l: Locale) {
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'ja'
  document.title = t('買う前に、全部計算しよう。| 家の本当のコスト')
}

export function setLocale(l: Locale) {
  locale.value = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    // 保存できなくても動作には影響しない
  }
  applyDocument(l)
}

export function initDocumentLocale() {
  applyDocument(locale.value)
}

/**
 * 日本語の原文をそのままキーにする。中国語では辞書の訳を返し、無ければ原文を返す。
 * 差し込みは {name} 形式。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  // 中国語では日本語の中黒（・）を読点に直す
  let s = locale.value === 'zh' ? (zh[key] ?? key).replace(/・/g, '、') : key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}
