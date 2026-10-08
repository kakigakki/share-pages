<script setup lang="ts">
import type { EstimateKind, HomeCostCalculator, OverrideKey } from '../composables/useHomeCostCalculator'
import NumberField from './NumberField.vue'

defineProps<{
  calc: HomeCostCalculator
  k: OverrideKey
  label: string
  unit?: string
  tag?: EstimateKind
  decimal?: boolean
  hint?: string
}>()
</script>

<template>
  <NumberField
    :model-value="calc.value(k)"
    :label="label"
    :unit="unit"
    :tag="tag"
    :decimal="decimal"
    :hint="hint"
    :overridden="calc.isOverridden(k)"
    @update:model-value="(v) => calc.setOverride(k, v)"
    @reset="calc.resetOverride(k)"
  />
</template>
