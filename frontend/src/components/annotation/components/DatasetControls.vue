<template>
  <div class="annotation-sidebar__content annotation-sidebar__content--carousel">
    <div class="annotation-intro-card">
      <div>
        <span>当前数据集</span>
        <strong>{{ datasetState.selectedDataset || "尚未选择" }}</strong>
      </div>
      <div>
        <span>类别模板</span>
        <strong>{{ selectedDatasetTemplateLabel }}</strong>
      </div>
      <div>
        <span>写入权限</span>
        <strong>{{ canWrite ? "可写入" : "只读" }}</strong>
      </div>
    </div>

    <div class="annotation-carousel annotation-carousel--content">
      <div class="annotation-carousel__viewport annotation-carousel__viewport--standalone">
        <div class="annotation-carousel__track" :style="carouselTrackStyle">
          <section
            class="native-workspace__group annotation-sidebar__section annotation-carousel__slide"
            role="tabpanel"
            :aria-hidden="currentPanel !== 'dataset'"
          >
            <div class="annotation-sidebar__section-head">
              <div>
                <p class="workspace__section-label">01 Dataset</p>
                <h4>当前数据集概况</h4>
              </div>
              <span :class="['native-pill', canWrite ? 'native-pill--accent' : 'native-pill--neutral']">
                {{ canWrite ? "可写入" : "只读" }}
              </span>
            </div>

            <label class="native-field">
              <span>切换数据集</span>
              <select
                :value="datasetState.selectedDataset"
                @change="emit('reload-annotation-data', $event.target.value)"
                :disabled="!canOperate || datasetState.loading"
              >
                <option v-if="!datasetState.datasetItems.length" value="">
                  {{ datasetState.loading ? "正在加载..." : "暂无数据集" }}
                </option>
                <option
                  v-for="item in datasetState.datasetItems"
                  :key="item.name"
                  :value="item.name"
                >
                  {{ item.name }}
                </option>
              </select>
            </label>

            <div class="annotation-dataset-overview">
              <article class="annotation-dataset-overview__card">
                <span>所属</span>
                <strong>{{ getDatasetOwnerLabel(datasetState.datasetMeta) }}</strong>
              </article>
              <article class="annotation-dataset-overview__card">
                <span>开放性</span>
                <strong>{{ datasetState.datasetMeta?.is_public ? "公开数据集" : "私有数据集" }}</strong>
              </article>
              <article class="annotation-dataset-overview__card">
                <span>类别范围</span>
                <strong>{{ selectedDatasetTemplateLabel }}</strong>
              </article>
            </div>

            <p class="native-hint">{{ datasetState.hint || "当前没有可访问的数据集。" }}</p>

            <div class="annotation-sidebar__stats annotation-sidebar__stats--four">
              <article class="annotation-sidebar__stat">
                <span>原始图片</span>
                <strong>{{ datasetState.counts.source }}</strong>
              </article>
              <article class="annotation-sidebar__stat">
                <span>已标注</span>
                <strong>{{ datasetState.counts.annotated }}</strong>
              </article>
              <article class="annotation-sidebar__stat">
                <span>Train</span>
                <strong>{{ datasetState.counts.train }}</strong>
              </article>
              <article class="annotation-sidebar__stat">
                <span>Val</span>
                <strong>{{ datasetState.counts.val }}</strong>
              </article>
            </div>

            <div class="native-inline-actions">
              <button
                type="button"
                class="primary"
                @click="emit('open-source-folder-picker')"
                :disabled="!canOperate || !canWrite || !datasetState.selectedDataset || uploadingSourceImages"
              >
                {{ uploadingSourceImages ? "导入中..." : "上传图片文件夹" }}
              </button>
              <button
                type="button"
                class="secondary"
                @click="emit('handle-dataset-download')"
                :disabled="!canOperate || !datasetState.selectedDataset"
              >
                下载数据集
              </button>
              <button
                type="button"
                class="secondary"
                @click="emit('handle-dataset-delete')"
                :disabled="!canOperate || !datasetState.selectedDataset || !canWrite"
              >
                删除数据集
              </button>
            </div>
          </section>

          <section
            class="native-workspace__group annotation-sidebar__section annotation-carousel__slide"
            role="tabpanel"
            :aria-hidden="currentPanel !== 'classes'"
          >
            <div class="annotation-sidebar__section-head">
              <div>
                <p class="workspace__section-label">02 Classes</p>
                <h4>类别库与建议</h4>
              </div>
              <span class="native-pill native-pill--neutral">{{ datasetState.classes.length }} 类</span>
            </div>

            <label class="native-field">
              <span>当前类别</span>
              <select
                :value="selectedClass"
                @change="emit('handle-selected-class-change', $event.target.value)"
                :disabled="!canOperate || !datasetState.classes.length"
              >
                <option v-if="!datasetState.classes.length" value="">暂无类别</option>
                <option
                  v-for="item in datasetState.classes"
                  :key="item"
                  :value="item"
                >
                  {{ item }}
                </option>
              </select>
            </label>

            <div class="native-inline-actions annotation-carousel__class-actions">
              <input
                :value="customClass"
                @input="emit('update:custom-class', $event.target.value)"
                placeholder="新增类别，例如 Corn leaf curl"
                :disabled="!canOperate || !canWrite"
              />
              <button
                type="button"
                class="secondary"
                @click="emit('handle-add-class')"
                :disabled="!canOperate || !canWrite"
              >
                添加
              </button>
              <button
                type="button"
                class="secondary"
                @click="emit('handle-delete-class')"
                :disabled="!canOperate || !canWrite || !selectedClass || datasetState.classes.length <= 1"
              >
                删除
              </button>
            </div>

            <div v-if="false" class="annotation-class-cloud">
              <template v-if="datasetState.classes.length">
                <button
                  v-for="item in datasetState.classes"
                  :key="item"
                  type="button"
                  :class="['annotation-class-cloud__item', { 'is-active': selectedClass === item }]"
                  @click="emit('handle-selected-class-change', item)"
                >
                  {{ item }}
                </button>
              </template>
              <span v-else class="annotation-class-cloud__empty">
                当前数据集还没有类别，先选模板或手动新增类别。
              </span>
            </div>

            <div v-if="selectedClassAdvice" class="annotation-advice-card">
              <div class="annotation-advice-card__head">
                <strong>{{ selectedClassAdvice.class_name }}</strong>
                <span>建议区</span>
              </div>
              <p>{{ selectedClassAdvice.summary }}</p>
              <p v-if="selectedClassAdvice.detail" class="annotation-advice-card__meta">
                {{ selectedClassAdvice.detail }}
              </p>
              <ul class="native-list native-list--stacked">
                <li
                  v-for="item in selectedClassAdvice.advice"
                  :key="item"
                  class="native-list__item native-list__item--stacked"
                >
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
            <div v-else class="annotation-advice-card annotation-advice-card--placeholder">
              <div class="annotation-advice-card__head">
                <strong>{{ selectedClass || "尚未选择类别" }}</strong>
                <span>建议区</span>
              </div>
              <p>新增类别后会自动调用实验室大模型生成建议并写入知识库缓存，后续识别和推荐会直接复用。</p>
            </div>
          </section>

          <section
            class="native-workspace__group annotation-sidebar__section annotation-carousel__slide"
            role="tabpanel"
            :aria-hidden="currentPanel !== 'create'"
          >
            <div class="annotation-sidebar__section-head">
              <div>
                <p class="workspace__section-label">03 Create</p>
                <h4>新建数据集</h4>
              </div>
              <span class="native-pill native-pill--neutral">
                {{ datasetCreateMode === "template" ? "模板建库" : "复制当前类别库" }}
              </span>
            </div>

            <div class="annotation-mode-switch">
              <button
                type="button"
                :class="['annotation-mode-switch__item', { 'is-active': datasetCreateMode === 'template' }]"
                @click="emit('update:dataset-create-mode', 'template')"
              >
                按作物模板创建
              </button>
              <button
                type="button"
                :class="['annotation-mode-switch__item', { 'is-active': datasetCreateMode === 'clone' }]"
                @click="emit('update:dataset-create-mode', 'clone')"
              >
                复制当前类别库
              </button>
            </div>

            <label class="native-field">
              <span>数据集名称</span>
              <input
                :value="datasetCreateName"
                @input="emit('update:dataset-create-name', $event.target.value)"
                placeholder="例如 corn_leaf_stage2"
                :disabled="!canOperate"
              />
            </label>

            <div v-if="datasetCreateMode === 'template'" class="annotation-template-carousel">
              <div class="annotation-template-carousel__head">
                <span class="annotation-template-carousel__meta">
                  {{ String(selectedTemplateIndex + 1).padStart(2, "0") }}/{{ visibleTemplateCards.length }}
                </span>
                <div class="annotation-template-carousel__controls">
                  <button
                    type="button"
                    class="secondary annotation-template-carousel__nav"
                    @click="shiftTemplate(-1)"
                    :disabled="!canOperate || visibleTemplateCards.length <= 1"
                  >
                    上一个
                  </button>
                  <button
                    type="button"
                    class="secondary annotation-template-carousel__nav"
                    @click="shiftTemplate(1)"
                    :disabled="!canOperate || visibleTemplateCards.length <= 1"
                  >
                    下一个
                  </button>
                </div>
              </div>

              <div class="annotation-template-carousel__viewport">
                <div class="annotation-template-carousel__track" :style="templateCarouselStyle">
                  <button
                    v-for="template in visibleTemplateCards"
                    :key="template.key"
                    type="button"
                    :class="['annotation-template-card', 'annotation-template-card--compact', { 'is-active': datasetTemplateKey === template.key }]"
                    @click="selectTemplate(template.key)"
                    :disabled="!canOperate"
                  >
                    <div class="annotation-template-card__head">
                      <strong>{{ template.label }}</strong>
                      <span>{{ template.class_count }} 类</span>
                    </div>
                    <p>{{ template.description }}</p>
                    <div class="annotation-template-card__preview">
                      <span v-for="cls in template.classes.slice(0, 4)" :key="cls">{{ cls }}</span>
                      <span v-if="!template.classes.length">空白模板</span>
                    </div>
                  </button>
                </div>
              </div>

              <div class="annotation-template-carousel__pager">
                <button
                  v-for="template in visibleTemplateCards"
                  :key="`${template.key}-pager`"
                  type="button"
                  :class="['annotation-template-carousel__pager-item', { 'is-active': datasetTemplateKey === template.key }]"
                  @click="selectTemplate(template.key)"
                  :disabled="!canOperate"
                >
                  {{ template.label }}
                </button>
              </div>
            </div>

            <div v-else class="annotation-clone-card">
              <strong>{{ datasetState.selectedDataset || "暂无可复制数据集" }}</strong>
              <p>复制模式会沿用当前数据集的类别集合，适合做版本迭代或精修集。</p>
            </div>

            <label class="native-checkbox">
              <input
                type="checkbox"
                :checked="datasetPublic"
                @change="emit('update:dataset-public', $event.target.checked)"
                :disabled="!canOperate"
              />
              <span>创建为公开数据集</span>
            </label>

            <div class="native-inline-actions">
              <button
                type="button"
                class="primary"
                @click="emit('handle-dataset-create')"
                :disabled="!canOperate || (datasetCreateMode === 'clone' && !datasetState.selectedDataset)"
              >
                创建并切换
              </button>
            </div>
          </section>

          <section
            class="native-workspace__group annotation-sidebar__section annotation-carousel__slide"
            role="tabpanel"
            :aria-hidden="currentPanel !== 'import'"
          >
            <div class="annotation-sidebar__section-head">
              <div>
                <p class="workspace__section-label">04 Import</p>
                <h4>导入本地现成数据集</h4>
              </div>
              <span class="native-pill native-pill--neutral">目录直传</span>
            </div>

            <p class="native-hint">
              这里导入的是已经整理好的本地数据集目录，例如包含 `classes.txt`、`images/`、`labels/` 的 YOLO 结构。
            </p>

            <div class="annotation-clone-card">
              <strong>{{ datasetImportFolderLabel || "尚未选择目录" }}</strong>
              <p>
                {{ datasetImportFiles.length
                  ? `已选 ${datasetImportFiles.length} 个文件，可以直接导入。`
                  : "点击下面按钮后选择本地数据集文件夹，支持直接选整个目录，不需要先手动压缩。" }}
              </p>
            </div>

            <label class="native-field">
              <span>导入后数据集名称</span>
              <input
                :value="datasetImportName"
                @input="emit('update:dataset-import-name', $event.target.value)"
                placeholder="留空则尝试使用目录名"
                :disabled="!canOperate"
              />
            </label>

            <label class="native-checkbox">
              <input
                type="checkbox"
                :checked="datasetImportPublic"
                @change="emit('update:dataset-import-public', $event.target.checked)"
                :disabled="!canOperate"
              />
              <span>导入为公开数据集</span>
            </label>

            <div class="native-inline-actions">
              <button
                type="button"
                class="secondary"
                @click="emit('open-dataset-folder-import-picker')"
                :disabled="!canOperate || importingDatasetFolder"
              >
                选择本地数据集目录
              </button>
              <button
                type="button"
                class="primary"
                @click="emit('handle-dataset-folder-import')"
                :disabled="!canOperate || !datasetImportFiles.length || importingDatasetFolder"
              >
                {{ importingDatasetFolder ? "导入中..." : "导入现成数据集" }}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="native-feedback">
      <p>{{ status }}</p>
      <strong v-if="error">{{ error }}</strong>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const defaultFlowPanels = [
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
  canOperate: Boolean,
  canWrite: Boolean,
  datasetState: {
    type: Object,
    required: true,
  },
  selectedClass: String,
  customClass: String,
  datasetCreateName: String,
  datasetPublic: Boolean,
  datasetCreateMode: String,
  datasetTemplateKey: String,
  datasetImportName: String,
  datasetImportPublic: Boolean,
  datasetImportFolderLabel: String,
  datasetImportFiles: {
    type: Array,
    default: () => [],
  },
  importingDatasetFolder: Boolean,
  uploadingSourceImages: Boolean,
  selectedClassAdvice: Object,
  visibleTemplateCards: {
    type: Array,
    default: () => [],
  },
  selectedDatasetTemplateLabel: String,
  createTemplate: Object,
  status: String,
  error: String,
  activePanel: String,
  flowPanels: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'reload-annotation-data',
  'handle-dataset-create',
  'handle-dataset-delete',
  'handle-dataset-download',
  'handle-add-class',
  'handle-delete-class',
  'handle-selected-class-change',
  'open-source-folder-picker',
  'open-dataset-folder-import-picker',
  'handle-dataset-folder-import',
  'update:custom-class',
  'update:dataset-create-name',
  'update:dataset-public',
  'update:dataset-create-mode',
  'update:dataset-template-key',
  'update:dataset-import-name',
  'update:dataset-import-public',
])

const carouselPanels = computed(() => (props.flowPanels?.length ? props.flowPanels : defaultFlowPanels))
const currentPanel = computed(() => props.activePanel || carouselPanels.value[0]?.id || 'dataset')

const activePanelIndex = computed(() => {
  const index = carouselPanels.value.findIndex((item) => item.id === currentPanel.value)
  return index >= 0 ? index : 0
})

const carouselTrackStyle = computed(() => ({
  '--carousel-count': carouselPanels.value.length,
  width: `${carouselPanels.value.length * 100}%`,
  transform: `translateX(-${activePanelIndex.value * (100 / carouselPanels.value.length)}%)`,
}))

const selectedTemplateIndex = computed(() => {
  const cards = props.visibleTemplateCards || []
  if (!cards.length) return 0
  const index = cards.findIndex((item) => item.key === props.datasetTemplateKey)
  return index >= 0 ? index : 0
})

const templateCarouselStyle = computed(() => {
  const count = Math.max(props.visibleTemplateCards?.length || 0, 1)
  return {
    '--template-count': count,
    width: `${count * 100}%`,
    transform: `translateX(-${selectedTemplateIndex.value * (100 / count)}%)`,
  }
})

const selectTemplate = (key) => {
  emit('update:dataset-template-key', key)
}

const shiftTemplate = (offset) => {
  const cards = props.visibleTemplateCards || []
  if (!cards.length) return
  const nextIndex = (selectedTemplateIndex.value + offset + cards.length) % cards.length
  selectTemplate(cards[nextIndex].key)
}

const getDatasetOwnerLabel = (datasetMeta) => {
  if (!datasetMeta) return '未分配'
  return datasetMeta.owner_display_name || datasetMeta.owner_username || (datasetMeta.is_official ? '官方资源' : '当前用户')
}
</script>

<style scoped>
.annotation-sidebar__content--carousel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
  min-height: 100%;
}

.annotation-carousel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
  padding: 16px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.44);
  border: 1px solid rgba(21, 37, 29, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.annotation-carousel--content {
  grid-template-rows: minmax(0, 1fr);
  padding: 12px;
}

.annotation-carousel__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.annotation-carousel__counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  color: var(--surface-ink);
  background: rgba(21, 37, 29, 0.06);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.annotation-carousel__tabs {
  display: grid;
  margin: -10px 0;
  grid-template-columns: repeat(4, minmax(0, 20));
  gap: 10px;
}

.annotation-carousel__tab {
  display: grid;
  gap: 6px;
  min-height: 50px;
  padding: 14px;
  text-align: left;
  border-radius: 22px;
  border: 1px solid rgba(21, 37, 29, 0.08);
  background: rgba(255, 255, 255, 0.72);
  color: var(--surface-ink);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.annotation-carousel__tab:hover {
  transform: translateY(-1px);
  border-color: rgba(42, 105, 74, 0.18);
}

.annotation-carousel__tab span {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.annotation-carousel__tab strong {
  font-size: 1rem;
}

.annotation-carousel__tab small {
  color: var(--muted-strong);
  font-size: 0.82rem;
  line-height: 1.45;
}

.annotation-carousel__tab.is-active {
  color: #f8fbf7;
  border-color: rgba(42, 105, 74, 0.22);
  background:
    radial-gradient(circle at top right, rgba(193, 233, 139, 0.16), transparent 32%),
    linear-gradient(135deg, #2f6f4f 0%, #173d2d 100%);
  box-shadow: 0 18px 34px rgba(23, 61, 45, 0.16);
}

.annotation-carousel__tab.is-active span,
.annotation-carousel__tab.is-active small {
  color: rgba(244, 250, 243, 0.82);
}

.annotation-carousel__viewport {
  min-height: 0;
  overflow: hidden;
  border-radius: 24px;
}

.annotation-carousel__viewport--standalone {
  background: rgba(255, 255, 255, 0.38);
  border: 1px solid rgba(21, 37, 29, 0.06);
}

.annotation-carousel__track {
  display: flex;
  height: 100%;
  transition: transform 240ms ease;
  will-change: transform;
}

.annotation-carousel__slide {
  flex: 0 0 calc(100% / var(--carousel-count));
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  padding: 15px;
  padding-right: 15px;
  border-top: 0;
  overflow-y: auto;
}

.annotation-carousel__slide::-webkit-scrollbar,
.annotation-template-carousel__pager::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.annotation-carousel__slide::-webkit-scrollbar-thumb,
.annotation-template-carousel__pager::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(42, 105, 74, 0.22);
}

.annotation-sidebar__stats--four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.annotation-carousel__class-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: stretch;
}

.annotation-template-carousel {
  display: grid;
  gap: 10px;
}

.annotation-template-carousel__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.annotation-template-carousel__meta {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(42, 105, 74, 0.08);
  color: var(--surface-ink);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.annotation-template-carousel__controls {
  display: flex;
  gap: 8px;
}

.annotation-template-carousel__nav {
  min-height: 36px;
  padding-inline: 12px;
  border-radius: 999px;
}

.annotation-template-carousel__viewport {
  overflow: hidden;
  border-radius: 24px;
}

.annotation-template-carousel__track {
  display: flex;
  transition: transform 220ms ease;
  will-change: transform;
}

.annotation-template-card--compact {
  flex: 0 0 calc(100% / var(--template-count));
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 176px;
  padding: 18px;
}

.annotation-template-card--compact p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  line-height: 1.6;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.annotation-template-card--compact .annotation-template-card__preview {
  gap: 8px;
}

.annotation-template-card--compact .annotation-template-card__preview span {
  max-width: 100%;
}

.annotation-template-carousel__pager {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.annotation-template-carousel__pager-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid rgba(21, 37, 29, 0.08);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted-strong);
  font-size: 0.82rem;
  font-weight: 700;
}

.annotation-template-carousel__pager-item.is-active {
  color: #f8fbf7;
  background: linear-gradient(135deg, #2f6f4f 0%, #173d2d 100%);
  border-color: rgba(42, 105, 74, 0.22);
}

@media (max-width: 1180px) {
  .annotation-sidebar__content--carousel {
    grid-template-rows: auto auto auto;
  }

  .annotation-carousel__tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .annotation-carousel__viewport {
    overflow: visible;
  }

  .annotation-carousel__track {
    width: 100% !important;
    transform: none !important;
    flex-direction: column;
    gap: 14px;
  }

  .annotation-carousel__slide {
    flex-basis: auto;
    overflow: visible;
    padding-right: 4px;
  }
}

@media (max-width: 760px) {
  .annotation-carousel {
    padding: 14px;
    border-radius: 24px;
  }

  .annotation-carousel__header,
  .annotation-template-carousel__head {
    flex-direction: column;
    align-items: stretch;
  }

  .annotation-carousel__tabs {
    grid-template-columns: 1fr;
  }

  .annotation-carousel__tab {
    min-height: 62px;
    padding: 10px 12px;
  }

  .annotation-carousel__tab-index {
    min-width: 48px;
    min-height: 40px;
    font-size: 0.74rem;
  }

  .annotation-carousel__class-actions,
  .annotation-sidebar__stats--four {
    grid-template-columns: 1fr;
  }

  .annotation-template-carousel__controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .annotation-template-card--compact {
    min-height: 164px;
  }
}

</style>
