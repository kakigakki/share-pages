<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EstimateKind } from '../composables/useHomeCostCalculator'
import { t } from '../i18n'

const props = defineProps<{
  modelValue: number
  label: string
  unit?: string // '円' | '円/月' | '円/年' | '%' | '年'
  decimal?: boolean
  tag?: EstimateKind
  overridden?: boolean
  hint?: string
  scale?: number // 表示単位（万円なら 10000）。modelValue は常に元の単位
}>()
const emit = defineEmits<{ 'update:modelValue': [number]; reset: [] }>()

const nf = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const sc = computed(() => props.scale ?? 1)
const text = ref(nf.format(props.modelValue / sc.value))
const focused = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    if (!focused.value) text.value = nf.format(v / sc.value)
  },
)

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const half = raw.replace(/[０-９．]/g, (c) => (c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
  const num = parseFloat(half.replace(props.decimal ? /[^\d.-]/g : /[^\d-]/g, ''))
  text.value = raw
  if (!Number.isNaN(num)) emit('update:modelValue', Math.round(num * sc.value))
}
const onFocus = () => (focused.value = true)
function onBlur() {
  focused.value = false
  text.value = nf.format(props.modelValue / sc.value)
}

const isYen = computed(() => props.unit?.startsWith('円'))
const suffix = computed(() =>
  props.unit === '円' ? '' : props.unit?.startsWith('万') ? props.unit : (props.unit ?? '').replace('円', ''),
)
const tagClass = computed(() =>
  props.tag === '概算'
    ? 'bg-amber-50 text-amber-700'
    : props.tag === '仮定'
      ? 'bg-sky-50 text-sky-700'
      : 'bg-violet-50 text-violet-700',
)
</script>

<template>
  <label class="block">
    <span class="mb-1 flex items-center gap-2 text-[13px] font-medium text-ink">
      {{ t(label) }}
      <span v-if="tag" class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="tagClass">{{ t(tag) }}</span>
      <button
        v-if="overridden"
        type="button"
        class="ml-auto text-[11px] font-normal text-accent underline"
        @click.prevent="emit('reset')"
      >
        {{ t('初期値に戻す') }}
      </button>
    </span>
    <span
      class="flex items-center rounded-lg border border-line bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
    >
      <span v-if="isYen" class="pl-3 text-mute">¥</span>
      <input
        :value="text"
        inputmode="decimal"
        class="num w-full bg-transparent px-3 py-2.5 text-right text-[15px] outline-none"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <span v-if="suffix" class="whitespace-nowrap pr-3 text-xs text-mute">{{ t(suffix) }}</span>
    </span>
    <span v-if="hint" class="mt-1 block text-[11px] text-mute">{{ t(hint) }}</span>
  </label>
</template>
