<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatMan } from '../utils/formatCurrency'
import { t } from '../i18n'

export interface ChartSeries {
  name: string
  color: string
  values: number[] // index = 年
  dashed?: boolean
}

const props = defineProps<{ series: ChartSeries[]; marker?: number }>()

const W = 640
const H = 280
const pad = { l: 56, r: 14, t: 14, b: 28 }

const years = computed(() => Math.max(...props.series.map((s) => s.values.length - 1), 1))
const bounds = computed(() => {
  const all = props.series.flatMap((s) => s.values)
  let lo = Math.min(0, ...all)
  let hi = Math.max(...all, 1)
  const step = niceStep((hi - lo) / 4)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  return { lo, hi, step }
})

function niceStep(raw: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

const x = (yr: number) => pad.l + (yr / years.value) * (W - pad.l - pad.r)
const y = (v: number) => pad.t + (1 - (v - bounds.value.lo) / (bounds.value.hi - bounds.value.lo || 1)) * (H - pad.t - pad.b)

const yTicks = computed(() => {
  const out: number[] = []
  for (let v = bounds.value.lo; v <= bounds.value.hi + 1; v += bounds.value.step) out.push(v)
  return out
})
const xTicks = computed(() => {
  const step = years.value > 30 ? 5 : years.value > 15 ? 5 : 2
  const out: number[] = []
  for (let t = 0; t <= years.value; t += step) out.push(t)
  return out
})
const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

const hover = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const svg = e.currentTarget as SVGElement
  const rect = svg.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * W
  const yr = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * years.value)
  hover.value = Math.max(0, Math.min(years.value, yr))
}
</script>

<template>
  <div>
    <div class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <span v-for="s in series" :key="s.name" class="flex items-center gap-1.5">
        <span class="inline-block h-0.5 w-4" :style="{ background: s.color }" />{{ t(s.name) }}
      </span>
    </div>
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full touch-pan-y select-none"
      role="img"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <g v-for="t in yTicks" :key="t">
        <line :x1="pad.l" :x2="W - pad.r" :y1="y(t)" :y2="y(t)" stroke="#e2e7e4" />
        <text :x="pad.l - 6" :y="y(t) + 4" text-anchor="end" font-size="11" fill="#66736e">{{ formatMan(t) }}</text>
      </g>
      <text v-for="tick in xTicks" :key="'x' + tick" :x="x(tick)" :y="H - 8" text-anchor="middle" font-size="11" fill="#66736e">
        {{ tick }}{{ t('年') }}
      </text>
      <line
        v-if="marker !== undefined && marker <= years"
        :x1="x(marker)"
        :x2="x(marker)"
        :y1="pad.t"
        :y2="H - pad.b"
        stroke="#16201d"
        stroke-dasharray="3 3"
        opacity="0.35"
      />
      <path
        v-for="s in series"
        :key="s.name"
        :d="path(s.values)"
        fill="none"
        :stroke="s.color"
        stroke-width="2.5"
        stroke-linejoin="round"
        :stroke-dasharray="s.dashed ? '6 4' : undefined"
      />
      <g v-if="hover !== null">
        <line :x1="x(hover)" :x2="x(hover)" :y1="pad.t" :y2="H - pad.b" stroke="#16201d" opacity="0.3" />
        <circle v-for="s in series" :key="s.name" :cx="x(hover)" :cy="y(s.values[hover] ?? 0)" r="4" :fill="s.color" />
      </g>
    </svg>
    <div class="num mt-1 min-h-[2.5rem] text-xs text-mute">
      <template v-if="hover !== null">
        <b class="text-ink">{{ t('{n}年目', { n: hover }) }}</b>
        <span v-for="s in series" :key="s.name" class="ml-3">
          <span :style="{ color: s.color }">●</span> {{ t(s.name) }} {{ formatMan(s.values[hover] ?? 0) }}
        </span>
      </template>
      <template v-else>{{ t('グラフ上をなぞると各年の値が表示されます。') }}</template>
    </div>
  </div>
</template>
