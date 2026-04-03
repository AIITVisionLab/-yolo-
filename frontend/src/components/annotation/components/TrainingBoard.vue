<template>
  <div class="training-board">
    <div class="native-workspace__section-head">
      <p class="workspace__section-label">Train</p>
      <h3>增强与训练</h3>
    </div>

    <!-- 数据统计卡片 -->
    <div class="annotation-ops-banner annotation-ops-banner--train">
      <article class="annotation-ops-banner__card">
        <span>原始图片</span>
        <strong>{{ datasetState.counts.source }}</strong>
        <p>当前数据集原图总量，适合用来跟踪待标注池规模。</p>
      </article>
      <article class="annotation-ops-banner__card">
        <span>已标注</span>
        <strong>{{ datasetState.counts.annotated }}</strong>
        <p>真正可以参与增强和训练切分的原图数量。</p>
      </article>
      <article class="annotation-ops-banner__card">
        <span>训练集</span>
        <strong>{{ datasetState.counts.train }}</strong>
        <p>执行增强后，训练集数量会在这里同步更新。</p>
      </article>
      <article class="annotation-ops-banner__card">
        <span>验证集</span>
        <strong>{{ datasetState.counts.val }}</strong>
        <p>当前验证集规模，便于快速判断数据切分是否生效。</p>
      </article>
    </div>

    <div class="annotation-workflow-grid annotation-workflow-grid--train">
      <!-- 训练进度 -->
      <section class="asset-collection">
        <div class="asset-collection__head">
          <div>
            <p class="workspace__section-label">Progress</p>
            <h3>训练进度</h3>
          </div>
          <span :class="['native-pill', training ? 'native-pill--warm' : 'native-pill--neutral']">
            {{ trainTask?.status || "待启动" }}
          </span>
        </div>

        <div class="recognition-advice">
          <div v-if="trainTask" class="train-progress">
            <div class="train-progress__bar">
              <span :style="{ width: formatPercent(trainTask.progress) }" />
            </div>
            <div class="train-progress__meta">
              <strong>{{ formatPercent(trainTask.progress) }}</strong>
              <span>{{ trainTask.message || trainTask.stage || trainTask.status }}</span>
            </div>
            <ul class="native-list native-list--stacked">
              <li class="native-list__item native-list__item--stacked">
                <span>状态：{{ trainTask.status }}</span>
              </li>
              <li class="native-list__item native-list__item--stacked">
                <span>轮次：{{ trainTask.current_epoch || 0 }} / {{ trainTask.total_epochs || "--" }}</span>
              </li>
              <li v-if="trainTask.result?.model_name" class="native-list__item native-list__item--stacked">
                <span>输出模型：{{ trainTask.result.model_name }}</span>
              </li>
            </ul>
          </div>
          <div v-else class="native-empty native-empty--compact">
            <p>启动训练任务后，这里会显示进度、阶段和结果模型。</p>
          </div>
        </div>
      </section>

      <!-- 训练前检查 -->
      <section class="asset-collection">
        <div class="asset-collection__head">
          <div>
            <p class="workspace__section-label">Dataset</p>
            <h3>训练前检查</h3>
          </div>
          <span class="native-pill native-pill--neutral">{{ datasetState.selectedDataset || "未选择" }}</span>
        </div>

        <div class="annotation-context-card">
          <p class="workspace__section-label">Ready Check</p>
          <h4>当前数据准备度</h4>
          <div class="annotation-context-pills">
            <span class="native-pill native-pill--neutral">{{ datasetState.classes.length }} 个类别</span>
            <span class="native-pill native-pill--neutral">{{ boxes.length }} 个当前框</span>
            <span :class="['native-pill', canWrite ? 'native-pill--accent' : 'native-pill--neutral']">
              {{ canWrite ? "可写入" : "只读" }}
            </span>
          </div>
          <p>
            {{ datasetState.classes.length
              ? "类别集合已经准备好，可以执行增强并启动训练。"
              : "当前数据集还没有类别，请先回到数据集准备。" }}
          </p>
        </div>

        <!-- 操作按钮 -->
        <div class="training-actions">
          <div class="native-inline-actions">
            <button
              type="button"
              class="secondary"
              @click="$emit('set-annotation-view', 'annotate')"
              :disabled="!datasetState.selectedDataset"
            >
              回到标注
            </button>
            <button
              type="button"
              class="primary"
              @click="$emit('set-annotation-view', 'dataset')"
            >
              数据集准备
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  datasetState: Object,
  trainTask: Object,
  training: Boolean,
  canWrite: Boolean,
  boxes: Array
})

const emit = defineEmits(['set-annotation-view'])

const formatPercent = (progress) => {
  const numeric = Number(progress)
  if (!Number.isFinite(numeric)) return "0%"
  return `${Math.max(0, Math.min(100, Math.round(numeric * 100)))}%`
}
</script>

<style scoped>
.training-board {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.annotation-ops-banner {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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
  font-size: 1.5rem;
  font-weight: 600;
  display: block;
  margin-bottom: 0.5rem;
}

.annotation-ops-banner__card p {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.annotation-workflow-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.train-progress {
  padding: 1rem;
}

.train-progress__bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.train-progress__bar span {
  display: block;
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.train-progress__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.train-progress__meta strong {
  font-size: 1rem;
  font-weight: 600;
}

.train-progress__meta span {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.annotation-context-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.annotation-context-card h4 {
  margin: 0.5rem 0 1rem 0;
  font-size: 1rem;
}

.annotation-context-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}

.training-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .annotation-ops-banner {
    grid-template-columns: 1fr;
  }
  
  .annotation-workflow-grid {
    grid-template-columns: 1fr;
  }
}

</style>
