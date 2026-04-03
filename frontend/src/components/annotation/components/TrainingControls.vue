<template>
  <div class="training-controls">
    <!-- 信息卡片 -->
    <div class="annotation-intro-card annotation-intro-card--compact">
      <div>
        <span>当前数据集</span>
        <strong>{{ datasetState.selectedDataset || "尚未选择" }}</strong>
      </div>
      <div>
        <span>类别数量</span>
        <strong>{{ datasetState.classes.length }} 类</strong>
      </div>
      <div>
        <span>训练状态</span>
        <strong>{{ trainTask?.status || (training ? "训练中" : "待启动") }}</strong>
      </div>
    </div>

    <!-- 数据集切换 -->
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

    <!-- 训练配置表单 -->
    <div class="annotation-training-grid annotation-training-grid--panel">
      <label class="native-field">
        <span>增强份数</span>
        <input 
          type="number" 
          min="1" 
          :value="augmentCopies" 
          @input="$emit('update:augment-copies', $event.target.value)"
          :disabled="!canOperate || !canWrite" 
        />
      </label>

      <label class="native-field">
        <span>Train 比例</span>
        <input
          type="number"
          min="0.1"
          max="0.95"
          step="0.05"
          :value="augmentTrainRatio"
          @input="$emit('update:augment-train-ratio', $event.target.value)"
          :disabled="!canOperate || !canWrite"
        />
      </label>

      <label class="native-field">
        <span>随机种子</span>
        <input
          type="number"
          min="0"
          :value="augmentSeed"
          @input="$emit('update:augment-seed', $event.target.value)"
          :disabled="!canOperate || !canWrite"
        />
      </label>

      <label class="native-field">
        <span>基础模型</span>
        <input
          list="annotation-base-models"
          :value="trainForm.baseModel"
          @input="$emit('update:train-form', { ...trainForm, baseModel: $event.target.value })"
          placeholder="例如 yolov8n.pt"
          :disabled="!canOperate"
        />
        <datalist id="annotation-base-models">
          <option v-for="item in models" :key="item" :value="item" />
        </datalist>
      </label>

      <label class="native-field">
        <span>输出模型名</span>
        <input
          :value="trainForm.modelName"
          @input="$emit('update:train-form', { ...trainForm, modelName: $event.target.value })"
          placeholder="可选"
          :disabled="!canOperate"
        />
      </label>

      <label class="native-field">
        <span>Epochs</span>
        <input 
          type="number" 
          min="1" 
          :value="trainForm.epochs" 
          @input="$emit('update:train-form', { ...trainForm, epochs: $event.target.value })"
          :disabled="!canOperate" 
        />
      </label>

      <label class="native-field">
        <span>Imgsz</span>
        <input 
          type="number" 
          min="32" 
          :value="trainForm.imgsz" 
          @input="$emit('update:train-form', { ...trainForm, imgsz: $event.target.value })"
          :disabled="!canOperate" 
        />
      </label>
    </div>

    <!-- 操作按钮 -->
    <div class="native-inline-actions">
      <button
        type="button"
        class="secondary"
        @click="$emit('handle-augment')"
        :disabled="!canOperate || !canWrite || !datasetState.selectedDataset || augmenting"
      >
        {{ augmenting ? "增强中..." : "执行增强并划分 train/val" }}
      </button>
      <button 
        type="button" 
        class="primary" 
        @click="$emit('handle-train')"
        :disabled="!canOperate || !datasetState.selectedDataset || !datasetState.classes.length || training"
      >
        {{ training ? "训练中..." : "启动训练" }}
      </button>
    </div>

    <!-- 训练进度摘要 -->
    <div v-if="trainTask" class="train-summary">
      <div class="train-summary__header">
        <span>训练任务</span>
        <strong>{{ trainTask.task_id?.slice(0, 8) }}...</strong>
      </div>
      <div class="train-summary__progress">
        <div class="train-progress-bar">
          <div class="train-progress-fill" :style="{ width: formatPercent(trainTask.progress) }" />
        </div>
        <span class="train-progress-percent">{{ formatPercent(trainTask.progress) }}</span>
      </div>
      <p class="train-summary__message">{{ trainTask.message || trainTask.stage || "处理中..." }}</p>
    </div>

    <!-- 反馈信息 -->
    <div class="native-feedback">
      <p>{{ status }}</p>
      <strong v-if="error">{{ error }}</strong>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  canOperate: Boolean,
  canWrite: Boolean,
  datasetState: Object,
  augmentCopies: Number,
  augmentTrainRatio: Number,
  augmentSeed: Number,
  trainForm: Object,
  models: Array,
  augmenting: Boolean,
  training: Boolean,
  trainTask: Object,
  status: String,
  error: String
})

defineEmits([
  'reload-annotation-data',
  'handle-augment',
  'handle-train',
  'update:augment-copies',
  'update:augment-train-ratio',
  'update:augment-seed',
  'update:train-form'
])

const formatPercent = (progress) => {
  const numeric = Number(progress)
  if (!Number.isFinite(numeric)) return "0%"
  return `${Math.max(0, Math.min(100, Math.round(numeric * 100)))}%`
}
</script>

<style scoped>
.training-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.annotation-training-grid--panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  background: var(--bg-tertiary);
  padding: 0.75rem;
  border-radius: 12px;
}

.train-summary {
  background: var(--bg-tertiary);
  border-radius: 12px;
  padding: 0.75rem;
  border-left: 3px solid var(--primary-color);
}

.train-summary__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.train-summary__header strong {
  font-family: monospace;
  color: var(--text-primary);
}

.train-summary__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.train-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  overflow: hidden;
}

.train-progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.train-progress-percent {
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.train-summary__message {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
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
