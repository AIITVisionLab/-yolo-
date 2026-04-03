<template>
  <div class="annotate-controls">
    <!-- 信息卡片 -->
    <div class="annotation-intro-card annotation-intro-card--compact">
      <div>
        <span>当前数据集</span>
        <strong>{{ datasetState.selectedDataset || "尚未选择" }}</strong>
      </div>
      <div>
        <span>当前类别</span>
        <strong>{{ selectedClass || "未选择" }}</strong>
      </div>
      <div>
        <span>当前图片</span>
        <strong>{{ selectedSourceImageName || imageFile?.name || "未载入" }}</strong>
      </div>
    </div>

    <!-- 紧凑网格表单 -->
    <div class="annotation-compact-grid">
      <label class="native-field">
        <span>切换数据集</span>
        <select 
          :value="datasetState.selectedDataset" 
          @change="$emit('reload-annotation-data', $event.target.value)"
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

      <label class="native-field">
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

      <div class="native-inline-actions">
        <input 
          :value="customClass" 
          @input="$emit('update:custom-class', $event.target.value)"
          placeholder="快速新增类别" 
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
        <button 
          type="button" 
          class="secondary" 
          @click="$emit('handle-delete-class')"
          :disabled="!canOperate || !canWrite || !selectedClass || datasetState.classes.length <= 1"
        >
          删除类别
        </button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="annotation-toolbar annotation-toolbar--compact">
      <div class="annotation-toolbar__group">
        <button
          type="button"
          class="primary"
          @click="$emit('open-source-folder-picker')"
          :disabled="!canOperate || !canWrite || !datasetState.selectedDataset || uploadingSourceImages"
        >
          {{ uploadingSourceImages ? "导入中..." : "上传图片文件" }}
        </button>
        <button 
          type="button" 
          class="primary" 
          @click="$emit('handle-image-upload')"
          :disabled="!canOperate"
        >
          选择待标注图片
        </button>
        <button 
          type="button" 
          class="secondary" 
          @click="$emit('handle-use-recognition-image')"
          :disabled="!canOperate || !recognitionPayload?.file"
        >
          使用识别图片
        </button>
        <button
          type="button"
          class="secondary"
          @click="$emit('handle-load-next-pending')"
          :disabled="!canOperate || !nextPendingSourceImage || Boolean(loadingSourceImageName)"
        >
          {{ loadingSourceImageName ? "载入中..." : "下一张未标注" }}
        </button>
        <button
          type="button"
          class="secondary"
          @click="$emit('handle-import-detections')"
          :disabled="!canOperate || !recognitionPayload?.result?.detections?.length || !imageFile"
        >
          导入识别框
        </button>
      </div>

      <div class="annotation-toolbar__group">
        <button 
          type="button" 
          class="secondary" 
          @click="$emit('handle-clear-boxes')"
          :disabled="!canOperate || !boxes.length"
        >
          清空标注
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
      </div>
    </div>

    <!-- 类别建议卡片 -->
    <div v-if="selectedClassAdvice" class="annotation-advice-card">
      <div class="annotation-advice-card__head">
        <strong>{{ selectedClassAdvice.class_name }}</strong>
        <span>当前类别建议</span>
      </div>
      <p>{{ selectedClassAdvice.summary }}</p>
      <p v-if="selectedClassAdvice.detail" class="annotation-advice-card__meta">
        {{ selectedClassAdvice.detail }}
      </p>
    </div>

    <!-- 反馈信息 -->
    <div class="native-feedback">
      <p>{{ status }}</p>
      <strong v-if="error">{{ error }}</strong>
    </div>
  </div>
</template>

<script setup>
defineProps({
  canOperate: Boolean,
  canWrite: Boolean,
  datasetState: Object,
  selectedClass: String,
  customClass: String,
  selectedSourceImageName: String,
  imageFile: Object,
  boxes: Array,
  selectedIndex: Number,
  saving: Boolean,
  loadingSourceImageName: String,
  nextPendingSourceImage: Object,
  recognitionPayload: Object,
  selectedClassAdvice: Object,
  status: String,
  error: String,
  uploadingSourceImages: Boolean
})

defineEmits([
  'reload-annotation-data',
  'handle-selected-class-change',
  'handle-add-class',
  'handle-delete-class',
  'open-source-folder-picker',
  'handle-image-upload',
  'handle-use-recognition-image',
  'handle-load-next-pending',
  'handle-import-detections',
  'handle-clear-boxes',
  'handle-delete-selected-box',
  'handle-save-annotations',
  'update:custom-class'
])
</script>

<style scoped>
.annotate-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.annotation-intro-card--compact {
  padding: 0.75rem;
  gap: 0.5rem;
}

.annotation-intro-card--compact div {
  gap: 0.125rem;
}

.annotation-intro-card--compact span {
  font-size: 0.7rem;
}

.annotation-intro-card--compact strong {
  font-size: 0.8rem;
}

.annotation-compact-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.annotation-toolbar--compact {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 12px;
}

.annotation-toolbar__group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.annotation-toolbar__group button {
  flex: 1;
  min-width: 80px;
}

.native-feedback {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 0.875rem;
}

.native-feedback strong {
  display: block;
  margin-top: 0.5rem;
  color: var(--error-color);
}
</style>
