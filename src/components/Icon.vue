<script setup>
// 统一线性图标（矢量）：路径取自 Uiverse 常见 stroke 图标风格，全部内联 SVG，不用字符
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 12 },
  weight: { type: [Number, String], default: 1.6 },
})

const SET = {
  'chevron-right': ['M9 5.5l6.5 6.5-6.5 6.5'],
  'chevron-left': ['M15 5.5L8.5 12l6.5 6.5'],
  'arrow-right': ['M4 12h15', 'M13 6l6 6-6 6'],
  'arrow-up-right': ['M7 17L17 7', 'M9.5 7H17V14.5'],
  plus: ['M12 5.5v13', 'M5.5 12h13'],
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  folder: ['M3.6 7.5A2 2 0 0 1 5.6 5.4h3.6l1.9 2.1h7.3a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z'],
  file: ['M7 3.6h6.2L17 7.4v13H7z', 'M13.1 3.6v3.8h3.8'],
}
const paths = computed(() => SET[props.name] || [])
const box = computed(() => `${props.size}px`)
</script>

<template>
  <svg
    class="ui-ico"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :style="{ width: box, height: box, strokeWidth: weight }"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.ui-ico {
  display: inline-block;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  vertical-align: middle;
}
</style>
