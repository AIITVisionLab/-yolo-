<template>
  <div :class="[{ 'brand-mark--compact': compact }]">
    <div class="brand-mark__glyph" aria-hidden="true">
      <svg>
        <image href="../../../public/favicon.svg" class="icon" viewBox="0 0 100 100"></image>
      </svg>
    </div>
  </div>
</template>

<script setup>
defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
})
</script>
