<template>
  <section class="dataset-setup-flow">
    <div class="dataset-setup-flow__header">
      <div>
        <p class="workspace__section-label">Setup Flow</p>
      </div>
      <span class="dataset-setup-flow__counter">
        {{ String(activePanelIndex + 1).padStart(2, "0") }}/{{ resolvedPanels.length }}
      </span>
    </div>

    <div class="dataset-setup-flow__tabs" role="tablist" aria-label="数据集准备功能切换">
      <button
        v-for="item in resolvedPanels"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="activePanel === item.id"
        :class="['dataset-setup-flow__tab', { 'is-active': activePanel === item.id }]"
        @click="emit('update:activePanel', item.id)"
      >
        <span>{{ item.eyebrow }}</span>
        <strong>{{ item.label }}</strong>
        <small v-if="item.summary">{{ item.summary }}</small>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const defaultPanels = [
  {
    id: 'dataset',
    eyebrow: '01 Dataset',
    label: '数据集准备',
  },
  {
    id: 'classes',
    eyebrow: '02 Classes',
    label: '类别库与建议',
  },
  {
    id: 'create',
    eyebrow: '03 Create',
    label: '新建数据集',
  },
  {
    id: 'import',
    eyebrow: '04 Import',
    label: '导入现成数据集',
  },
]

const props = defineProps({
  activePanel: {
    type: String,
    default: 'dataset',
  },
  panels: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:activePanel'])

const resolvedPanels = computed(() => (props.panels?.length ? props.panels : defaultPanels))

const activePanelIndex = computed(() => {
  const index = resolvedPanels.value.findIndex((item) => item.id === props.activePanel)
  return index >= 0 ? index : 0
})
</script>

<style scoped>
.dataset-setup-flow {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 100% 0%, rgba(184, 125, 72, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(247, 241, 233, 0.88));
  border: 1px solid rgba(31, 36, 32, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

.dataset-setup-flow__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.dataset-setup-flow__counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  min-height: 30px;
  padding: 0 16px;
  border-radius: 999px;
  color: var(--surface-ink);
  background: rgba(21, 37, 29, 0.06);
  font-size: 0.92rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.dataset-setup-flow__tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.dataset-setup-flow__tab {
  display: grid;
  gap: 8px;
  min-height: 128px;
  padding: 22px 20px;
  text-align: left;
  border-radius: 30px;
  border: 1px solid rgba(21, 37, 29, 0.08);
  background: rgba(255, 255, 255, 0.74);
  color: var(--surface-ink);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.dataset-setup-flow__tab:hover {
  transform: translateY(-1px);
  border-color: rgba(42, 105, 74, 0.18);
}

.dataset-setup-flow__tab span {
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.dataset-setup-flow__tab strong {
  font-size: clamp(1.2rem, 1.6vw, 1.9rem);
  line-height: 1.06;
}

.dataset-setup-flow__tab small {
  color: var(--muted-strong);
  font-size: 0.88rem;
  line-height: 1.55;
}

.dataset-setup-flow__tab.is-active {
  color: #f8fbf7;
  border-color: rgba(42, 105, 74, 0.22);
  background:
    radial-gradient(circle at top right, rgba(193, 233, 139, 0.16), transparent 32%),
    linear-gradient(135deg, #2f6f4f 0%, #173d2d 100%);
  box-shadow: 0 18px 34px rgba(23, 61, 45, 0.16);
}

.dataset-setup-flow__tab.is-active span,
.dataset-setup-flow__tab.is-active small {
  color: rgba(244, 250, 243, 0.82);
}

@media (max-width: 1180px) {
  .dataset-setup-flow__tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .dataset-setup-flow {
    padding: 14px;
    border-radius: 24px;
  }

  .dataset-setup-flow__header {
    align-items: center;
  }

  .dataset-setup-flow__counter {
    min-width: 64px;
    min-height: 40px;
    padding: 0 14px;
    font-size: 0.84rem;
  }

  .dataset-setup-flow__tabs {
    grid-template-columns: 1fr;
  }

  .dataset-setup-flow__tab {
    min-height: 96px;
    padding: 16px;
    border-radius: 24px;
  }

  .dataset-setup-flow__tab strong {
    font-size: 1.08rem;
  }
}

</style>
