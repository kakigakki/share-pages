<script setup lang="ts" generic="T extends string">
import { t } from '../i18n'
defineProps<{ modelValue: T; options: { value: T; label: string }[]; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [T] }>()
</script>

<template>
  <div>
    <div v-if="label" class="mb-1 text-[13px] font-medium">{{ t(label) }}</div>
    <div class="grid auto-cols-fr grid-flow-col rounded-lg bg-slate-200/70 p-0.5">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        class="whitespace-nowrap rounded-md px-2 py-2 text-sm transition"
        :class="modelValue === o.value ? 'bg-white font-semibold shadow-sm' : 'text-mute'"
        @click="emit('update:modelValue', o.value)"
      >
        {{ t(o.label) }}
      </button>
    </div>
  </div>
</template>
