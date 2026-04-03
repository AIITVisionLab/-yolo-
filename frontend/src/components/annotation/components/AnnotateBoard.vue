<template>
  <div class="annotate-board">
    <div class="native-workspace__section-head">
      <p class="workspace__section-label">Canvas</p>
      <h3>标注画面</h3>
      <p>图片导入、识别框复用、保存和框选都围绕同一块画布，避免右侧再拉出另一套操作区。</p>
    </div>

    <!-- 状态卡片 -->
    <div class="annotation-ops-banner annotation-ops-banner--annotate">
      <article class="annotation-ops-banner__card">
        <span>类别范围</span>
        <strong>{{ selectedDatasetTemplateLabel }}</strong>
        <p>{{ datasetState.classes.length ? `当前共 ${datasetState.classes.length} 个有效类别。` : "当前还没有可标注类别。" }}</p>
      </article>
      <article class="annotation-ops-banner__card">
        <span>当前图片</span>
        <strong>{{ selectedSourceImageName || imageFile?.name || "未载入" }}</strong>
        <p>
          {{ selectedSourceImageName
            ? `当前来自数据集原图队列${currentSourceImageMeta?.has_annotation ? "，已存在历史标注。" : "，尚未完成标注。"}`
            : imageFile
              ? `已准备 ${boxes.length} 个标注框。`
              : "可从本地上传，也可直接复用识别页图片。" }}
        </p>
      </article>
      <article class="annotation-ops-banner__card">
        <span>当前状态</span>
        <strong>{{ selectedBox ? `已选中 ${selectedBox.label}` : "等待框选" }}</strong>
        <p>{{ selectedBox ? "可以删除、修改类别或继续精修边界。" : "拖拽画布即可开始标注。" }}</p>
      </article>
    </div>

    <!-- 主要标注区域 -->
    <div class="annotation-board__main">
      <div class="annotation-stage-wrap">
        <div
          ref="frameRef"
          class="annotation-stage__frame"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
        >
          <div v-if="imageUrl" ref="mediaRef" class="annotation-stage__media">
            <img
              :src="imageUrl"
              alt="标注图片"
            />
          
            <!-- 标注框叠加层 -->
            <div class="annotation-stage__overlay" aria-hidden="true">
              <div
                v-for="(box, index) in boxes"
                :key="`${box.label}-${index}-${box.x1}`"
                :class="['annotation-box', { 'is-active': selectedIndex === index }, { 'is-assist': box.source === 'assist' }]"
                :style="getBoxStyle(box)"
                :title="box.label"
              >
                <span class="annotation-box__label">{{ box.label }}</span>
              </div>
              <span v-if="draftStyle" class="annotation-box annotation-box--draft" :style="draftStyle">
                <span class="annotation-box__anchor" aria-hidden="true" />
              </span>
            </div>
          </div>
          <div v-else class="native-empty">
            <strong>还没有标注图片</strong>
            <p>可以单独上传图片，也可以直接接收识别页中的图片和检测框。</p>
          </div>
        </div>

        <div class="annotation-stage__caption">
          <span>
            {{ datasetState.classes.length
              ? "拖拽画布即可框选。点击已有框可以快速切换到对应类别。"
              : "当前数据集还没有类别，请先回到数据集准备补齐类别。" }}
          </span>
          <strong>{{ selectedBox ? `当前选中：${selectedBox.label}` : "当前未选中任何标注框" }}</strong>
        </div>
      </div>

      <!-- 右侧上下文信息 -->
      <aside class="annotation-context">
        <div class="annotation-context-card">
          <p class="workspace__section-label">Selected</p>
          <h4>当前选中项</h4>
          <div v-if="selectedBox" class="annotation-context-list">
            <div class="annotation-context-item">
              <span>类别</span>
              <strong>{{ selectedBox.label }}</strong>
            </div>
            <div class="annotation-context-item">
              <span>来源</span>
              <strong>{{ selectedBox.source === "assist" ? "识别辅助" : "手动标注" }}</strong>
            </div>
            <div class="annotation-context-item">
              <span>坐标</span>
              <strong>
                {{ Math.round(selectedBox.x1) }}, {{ Math.round(selectedBox.y1) }} · 
                {{ Math.round(selectedBox.x2) }}, {{ Math.round(selectedBox.y2) }}
              </strong>
            </div>
          </div>
          <p v-else>点击画布中的任意标注框后，这里会显示类别、来源和坐标。</p>
        </div>

        <div class="annotation-context-card">
          <p class="workspace__section-label">Dataset</p>
          <h4>当前类别</h4>
          <p>{{ selectedDatasetTemplateLabel }}</p>
          <div class="annotation-context-pills">
            <span class="native-pill native-pill--neutral">{{ datasetState.classes.length }} 个类别</span>
            <span class="native-pill native-pill--neutral">{{ datasetState.counts.source }} 张原始图片</span>
            <span class="native-pill native-pill--neutral">{{ datasetState.counts.annotated }} 张已标注</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- 原图标注队列 -->
    <section class="asset-collection">
      <div class="asset-collection__head">
        <div>
          <p class="workspace__section-label">Queue</p>
          <h3>原图标注队列</h3>
        </div>
        <span class="native-pill native-pill--neutral">{{ datasetState.sourceImages.length }} 张</span>
      </div>
      
      <div v-if="!datasetState.sourceImages.length" class="native-empty native-empty--compact">
        <p>先上传图片文件夹，把原始图片放进当前数据集，再逐张标注。</p>
      </div>
      
      <div v-else class="asset-rows">
        <article
          v-for="item in datasetState.sourceImages"
          :key="item.name"
          :class="['asset-row', 'asset-row--compact', { 'is-active': selectedSourceImageName === item.name }]"
        >
          <div class="asset-row__main">
            <div class="asset-row__title">
              <strong>{{ item.name }}</strong>
              <div class="asset-row__badges">
                <span :class="['native-pill', item.has_annotation ? 'native-pill--accent' : 'native-pill--neutral']">
                  {{ item.has_annotation ? `已标注 ${item.annotation_count}` : "待标注" }}
                </span>
              </div>
            </div>
            <p>{{ item.updated_at || "刚刚导入" }}</p>
          </div>
          <div class="asset-row__actions">
            <button
              type="button"
              class="secondary native-utility-button"
              @click="$emit('load-dataset-source-image', item.name)"
              :disabled="loadingSourceImageName === item.name"
            >
              {{ loadingSourceImageName === item.name ? "载入中..." : (item.has_annotation ? "继续标注" : "开始标注") }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <!-- 标注列表 -->
    <section class="asset-collection">
      <div class="asset-collection__head">
        <div>
          <p class="workspace__section-label">Boxes</p>
          <h3>标注列表</h3>
        </div>
        <span class="native-pill native-pill--neutral">{{ boxes.length }} 个框</span>
      </div>
      
      <div v-if="!boxes.length" class="native-empty native-empty--compact">
        <p>开始框选或导入识别框后，这里会显示所有标注项。</p>
      </div>
      
      <ul v-else class="native-list native-list--stacked">
        <li
          v-for="(box, index) in boxes"
          :key="`${box.label}-${index}`"
          :class="['native-list__item', 'native-list__item--stacked', { 'is-active': selectedIndex === index }]"
        >
          <button
            type="button"
            class="native-list__button"
            @click="handleBoxClick(index, box.label)"
          >
            <strong>{{ box.label }}</strong>
            <span>{{ box.source === "assist" ? "识别辅助" : "手动标注" }}</span>
          </button>
        </li>
      </ul>
    </section>

    <!-- 专注模式按钮 -->
    <div class="annotation-focus-trigger">
      <button
        type="button"
        class="secondary"
        @click="$emit('set-focus-mode', true)"
        :disabled="!imageUrl"
      >
        🔍 专注标注模式
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  datasetState: Object,
  selectedDatasetTemplateLabel: String,
  selectedSourceImageName: String,
  imageFile: Object,
  imageUrl: String,
  imageMeta: Object,
  boxes: Array,
  draftBox: Object,
  selectedIndex: Number,
  selectedBox: Object,
  loadingSourceImageName: String,
  canOperate: Boolean
})

const emit = defineEmits([
  'load-dataset-source-image',
  'handle-pointer-down',
  'handle-pointer-move',
  'set-selected-index',
  'handle-selected-class-change',
  'set-focus-mode'
])

const frameRef = ref(null)
const mediaRef = ref(null)

const currentSourceImageMeta = computed(() => 
  props.datasetState?.sourceImages?.find((item) => item.name === props.selectedSourceImageName) || null
)

const boxStyle = (box, imageMeta) => {
  if (!imageMeta?.width || !imageMeta?.height) return null
  return {
    left: `${(box.x1 / imageMeta.width) * 100}%`,
    top: `${(box.y1 / imageMeta.height) * 100}%`,
    width: `${((box.x2 - box.x1) / imageMeta.width) * 100}%`,
    height: `${((box.y2 - box.y1) / imageMeta.height) * 100}%`,
  }
}

const getBoxStyle = (box) => {
  return boxStyle(box, props.imageMeta)
}

const draftStyle = computed(() => {
  if (!props.draftBox) return null
  const normalized = normalizeBox(props.draftBox)
  return boxStyle(normalized, props.imageMeta)
})

const normalizeBox = (box) => {
  return {
    label: box.label,
    x1: Math.min(box.x1, box.x2),
    y1: Math.min(box.y1, box.y2),
    x2: Math.max(box.x1, box.x2),
    y2: Math.max(box.y1, box.y2),
    source: box.source || "manual",
  }
}

const handleBoxClick = (index, label) => {
  emit('set-selected-index', index)
  emit('handle-selected-class-change', label)
}

const handlePointerDown = (event) => {
  emit('handle-pointer-down', { event, frameElement: mediaRef.value || frameRef.value })
}

const handlePointerMove = (event) => {
  emit('handle-pointer-move', { event, frameElement: mediaRef.value || frameRef.value })
}
</script>

<style scoped>
@import "../styles/annotation-boxes.css";

.annotate-board {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  --annotation-box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.76),
    0 10px 24px rgba(11, 33, 23, 0.14),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  --annotation-box-hover-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.9),
    0 14px 30px rgba(11, 33, 23, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.24);
  --annotation-box-active-shadow:
    0 0 0 2px rgba(255, 250, 235, 0.95),
    0 16px 34px rgba(73, 45, 8, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.32);
  --annotation-box-draft-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.88),
    0 0 0 4px rgba(15, 118, 110, 0.2),
    0 16px 28px rgba(8, 52, 49, 0.16);
  --annotation-box-anchor-shadow:
    0 0 0 2px rgba(15, 118, 110, 0.24),
    0 6px 14px rgba(8, 52, 49, 0.22);
  --annotation-box-label-max-width: min(70%, 220px);
  --annotation-box-label-bg: rgba(10, 25, 18, 0.9);
  --annotation-box-label-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
  --annotation-box-label-active-bg: rgba(103, 62, 7, 0.92);
  --annotation-box-label-assist-bg: rgba(120, 53, 15, 0.92);
}

.annotation-ops-banner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.annotation-ops-banner__card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1rem;
}

.annotation-ops-banner__card span {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-bottom: 0.25rem;
}

.annotation-ops-banner__card strong {
  font-size: 1rem;
  font-weight: 600;
  display: block;
  margin-bottom: 0.5rem;
}

.annotation-ops-banner__card p {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.annotation-board__main {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1.5rem;
}

.annotation-stage-wrap {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.annotation-stage__frame {
  position: relative;
  display: grid;
  place-items: center;
  background: var(--bg-tertiary);
  border-radius: 12px;
  overflow: hidden;
  cursor: crosshair;
  user-select: none;
  touch-action: none;
}

.annotation-stage__media {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
}

.annotation-stage__frame img {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 72vh;
}

.annotation-stage__caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-muted);
  padding: 0.5rem;
}

.annotation-context {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.annotation-context-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1rem;
}

.annotation-context-card h4 {
  margin: 0.5rem 0 1rem 0;
  font-size: 1rem;
}

.annotation-context-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.annotation-context-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.annotation-context-item span {
  color: var(--text-muted);
}

.annotation-context-item strong {
  font-weight: 600;
}

.annotation-context-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.asset-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.asset-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
  transition: all 0.2s;
}

.asset-row.is-active {
  background: rgba(var(--primary-rgb), 0.1);
  border-left: 3px solid var(--primary-color);
}

.asset-row--compact {
  padding: 0.5rem;
}

.asset-row__main {
  flex: 1;
  overflow: hidden;
}

.asset-row__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.asset-row__title strong {
  font-size: 0.875rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-row__badges {
  display: flex;
  gap: 0.25rem;
}

.asset-row p {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.asset-row__actions {
  display: flex;
  gap: 0.5rem;
}

.native-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.native-list--stacked {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.native-list__item {
  background: var(--bg-tertiary);
  border-radius: 8px;
  transition: all 0.2s;
}

.native-list__item.is-active {
  background: rgba(var(--primary-rgb), 0.1);
  border-left: 3px solid var(--primary-color);
}

.native-list__button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
}

.native-list__button strong {
  font-weight: 600;
}

.native-list__button span {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.annotation-focus-trigger {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .annotation-board__main {
    grid-template-columns: 1fr;
  }
  
  .annotation-ops-banner {
    grid-template-columns: 1fr;
  }
}

</style>
