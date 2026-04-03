<template>
  <nav :class="['workspace-nav', `workspace-nav--${layout}`]" aria-label="工作区导航">
    <button
      v-for="item in visibleItems"
      :key="item.id"
      type="button"
      :class="['workspace-nav__item', { 'is-active': item.id === activeWorkspace }]"
      @click="handleChange(item.id)"
    >
      <span class="workspace-nav__glyph" aria-hidden="true">{{ item.navGlyph || item.step || item.label?.[0] || '?' }}</span>
      <span class="workspace-nav__content">
        <em>{{ item.groupLabel || item.group || '工作区' }}</em>
        <strong>{{ item.label }}</strong>
        <small>{{ item.hint || item.summary || item.focusTitle || '' }}</small>
      </span>
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { WORKSPACES } from '@/appConfig'

const props = defineProps({
  items: {
    type: Array,
    default: () => WORKSPACES,
  },
  activeWorkspace: {
    type: String,
    default: '',
  },
  onChangeWorkspace: {
    type: Function,
    default: null,
  },
  canShowAdmin: {
    type: Boolean,
    default: false,
  },
  layout: {
    type: String,
    default: 'rail',
  },
})

const visibleItems = computed(() => {
  return (props.items || []).filter((item) => props.canShowAdmin || item.id !== 'admin')
})

function handleChange(workspaceId) {
  props.onChangeWorkspace?.(workspaceId)
}
</script>
