<template>
  <Teleport to="body">
    <div class="annotation-focus" role="dialog" aria-modal="true" aria-label="专注标注模式">
      <div class="annotation-focus__shell">
        <!-- 顶部工具栏 -->
        <header class="annotation-focus__toolbar">
          <div class="annotation-focus__toolbar-group">
            <div class="annotation-focus__meta">
              <span>数据集</span>
              <strong>{{ datasetState.selectedDataset || "--" }}</strong>
            </div>
            
            <label class="native-field annotation-focus__field">
              <span>当前类别</span>
              <select 
                :value="selectedClass" 
                @change="$emit('handle-selected-class-change', $event.target.value)"
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
            
            <input
              class="annotation-focus__quick-input"
              :value="customClass"
              @input="$emit('update:custom-class', $event.target.value)"
              placeholder="新增类别"
              :disabled="!canOperate || !canWrite"
            />
            <button 
              type="button" 
              class="secondary" 
              @click="$emit('handle-add-class')"
              :disabled="!canOperate || !canWrite || !customClass.trim()"
            >
              添加类别
            </button>
          </div>
          
          <div class="annotation-focus__toolbar-group annotation-focus__toolbar-group--actions">
            <button 
              type="button" 
              class="secondary" 
              @click="$emit('handle-image-upload')"
              :disabled="!canOperate"
            >
              更换图片
            </button>
            <button
              type="button"
              class="secondary"
              @click="$emit('handle-import-detections')"
              :disabled="!canOperate || !recognitionPayload?.result?.detections?.length || !imageFile"
            >
              导入识别框
            </button>
            <button 
              type="button" 
              class="secondary" 
              @click="$emit('handle-delete-selected-box')"
              :disabled="!canOperate || selectedIndex < 0"
            >
              删除选中框
            </button>
            <button
              type="button"
              class="primary"
              @click="$emit('handle-save-annotations')"
              :disabled="!canOperate || !canWrite || !imageFile || !boxes.length || saving"
            >
              {{ saving ? "保存中..." : "保存标注" }}
            </button>
            <button 
              type="button" 
              class="secondary" 
              @click="$emit('set-focus-mode', false)"
            >
              退出全屏
            </button>
          </div>
        </header>

        <!-- 标注画布区域 -->
        <div class="annotation-focus__stage-wrap">
          <div
            ref="frameRef"
            class="annotation-stage annotation-stage--focus"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
          >
            <div ref="mediaRef" class="annotation-stage__media annotation-stage__media--focus">
              <img
                :src="imageUrl"
                alt="标注图片"
              />
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
          </div>
        </div>

        <!-- 底部信息栏 -->
        <footer class="annotation-focus__dock">
          <div class="annotation-focus__summary">
            <span>当前状态</span>
            <strong>{{ selectedBox ? `已选中 ${selectedBox.label}` : "拖拽画布开始标注" }}</strong>
            <p v-if="selectedBox">
              坐标 {{ Math.round(selectedBox.x1) }}, {{ Math.round(selectedBox.y1) }} · 
              {{ Math.round(selectedBox.x2) }}, {{ Math.round(selectedBox.y2) }}
            </p>
            <p v-else>
              按 Esc 或右上角按钮退出全屏，普通页保留数据集管理和训练功能。
            </p>
          </div>
          <div class="annotation-focus__summary">
            <span>标注进度</span>
            <strong>{{ boxes.length }} 个框</strong>
            <p>{{ selectedClassAdvice?.summary || "当前类别建议已收起到普通页左侧，专注模式只保留标注必需信息。" }}</p>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  datasetState: Object,
  selectedClass: String,
  customClass: String,
  boxes: Array,
  selectedIndex: Number,
  selectedBox: Object,
  imageUrl: String,
  imageMeta: Object,
  draftBox: Object,
  saving: Boolean,
  canOperate: Boolean,
  canWrite: Boolean,
  recognitionPayload: Object,
  imageFile: Object,
  selectedClassAdvice: Object
})

const emit = defineEmits([
  'handle-selected-class-change',
  'handle-add-class',
  'handle-import-detections',
  'handle-delete-selected-box',
  'handle-save-annotations',
  'handle-pointer-down',
  'handle-pointer-move',
  'set-focus-mode',
  'handle-image-upload',
  'update:custom-class'
])

const frameRef = ref(null)
const mediaRef = ref(null)

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

const handlePointerDown = (event) => {
  emit('handle-pointer-down', { event, frameElement: mediaRef.value || frameRef.value })
}

const handlePointerMove = (event) => {
  emit('handle-pointer-move', { event, frameElement: mediaRef.value || frameRef.value })
}
</script>

<style scoped>
@import "../styles/annotation-boxes.css";

.annotation-focus {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  --annotation-box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.78),
    0 10px 24px rgba(0, 0, 0, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  --annotation-box-hover-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.92),
    0 14px 30px rgba(0, 0, 0, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.24);
  --annotation-box-active-shadow:
    0 0 0 2px rgba(255, 250, 235, 0.95),
    0 16px 34px rgba(73, 45, 8, 0.24),
    inset 0 0 0 1px rgba(255, 255, 255, 0.32);
  --annotation-box-draft-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.92),
    0 0 0 4px rgba(15, 118, 110, 0.22),
    0 18px 30px rgba(0, 0, 0, 0.22);
  --annotation-box-anchor-shadow:
    0 0 0 2px rgba(15, 118, 110, 0.26),
    0 6px 14px rgba(0, 0, 0, 0.24);
  --annotation-box-label-max-width: min(70%, 260px);
  --annotation-box-label-bg: rgba(10, 25, 18, 0.92);
  --annotation-box-label-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
  --annotation-box-label-active-bg: rgba(103, 62, 7, 0.94);
  --annotation-box-label-assist-bg: rgba(120, 53, 15, 0.94);
}

.annotation-focus__shell {
  width: 95vw;
  height: 95vh;
  background: var(--bg-primary);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.annotation-focus__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 1rem;
}

.annotation-focus__toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.annotation-focus__meta {
  display: flex;
  flex-direction: column;
  padding-right: 1rem;
  border-right: 1px solid var(--border-color);
}

.annotation-focus__meta span {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.annotation-focus__meta strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.annotation-focus__field {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.annotation-focus__field span {
  font-size: 0.7rem;
  margin-bottom: 0.125rem;
}

.annotation-focus__field select {
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
}

.annotation-focus__quick-input {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  font-size: 0.875rem;
}

.annotation-focus__stage-wrap {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-tertiary);
}

.annotation-stage--focus {
  max-width: 100%;
  max-height: 100%;
  position: relative;
  display: grid;
  place-items: center;
  cursor: crosshair;
  user-select: none;
  touch-action: none;
}

.annotation-stage__media--focus {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
}

.annotation-stage--focus img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.annotation-focus__dock {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.annotation-focus__summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.annotation-focus__summary span {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.annotation-focus__summary strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.annotation-focus__summary p {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

@media (max-width: 768px) {
  .annotation-focus__toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .annotation-focus__toolbar-group {
    justify-content: center;
  }
  
  .annotation-focus__dock {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
}

</style>
