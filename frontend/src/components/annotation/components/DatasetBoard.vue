<template>
  <div class="dataset-board">
    <section class="dataset-board__surface">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">Setup</p>
        <h3>先把数据集边界理清</h3>
        <p>当前页面只处理数据集、类别和建议。确认完类别范围，再进入标注或训练，流程会更清晰。</p>
      </div>

      <div class="annotation-ops-banner annotation-ops-banner--setup">
        <article class="annotation-ops-banner__card">
          <span>当前数据集</span>
          <strong>{{ datasetState.selectedDataset || "尚未选择" }}</strong>
          <p>{{ datasetState.hint || "先切换或创建一个数据集。" }}</p>
        </article>
        <article class="annotation-ops-banner__card">
          <span>有效类别</span>
          <strong>{{ datasetState.classes.length }} 个</strong>
          <p>{{ selectedClass ? `当前选中 ${selectedClass}` : "先确认类别集合，再进入标注。" }}</p>
        </article>
        <article class="annotation-ops-banner__card">
          <span>下一步</span>
          <strong>{{ datasetState.classes.length ? "进入标注" : "先准备类别" }}</strong>
          <p>{{ datasetState.classes.length ? "类别已经就绪，建议先导入图片文件夹，再逐张标注。" : "没有类别时，不建议直接开始标注。" }}</p>
        </article>
      </div>

      <div class="annotation-workflow-grid annotation-workflow-grid--setup">
        <section class="asset-collection">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Classes</p>
              <h3>当前类别</h3>
            </div>
            <span class="native-pill native-pill--neutral">{{ datasetState.classes.length }} 类</span>
          </div>

          <div class="annotation-class-cloud">
            <template v-if="datasetState.classes.length">
              <button
                v-for="item in datasetState.classes"
                :key="item"
                type="button"
                :class="['annotation-class-cloud__item', { 'is-active': selectedClass === item }]"
                @click="$emit('handle-selected-class-change', item)"
              >
                {{ item }}
              </button>
            </template>
            <span v-else class="annotation-class-cloud__empty">
              当前还没有可用类别，先从模板建库或手动补充类别。
            </span>
          </div>
        </section>

        <section class="asset-collection">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Advice</p>
              <h3>当前类别建议</h3>
            </div>
            <span class="native-pill native-pill--neutral">{{ selectedClass || "未选择" }}</span>
          </div>

          <div v-if="selectedClassAdvice" class="annotation-advice-card">
            <div class="annotation-advice-card__head">
              <strong>{{ selectedClassAdvice.class_name }}</strong>
              <span>知识库建议</span>
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
          <div v-else class="native-empty native-empty--compact">
            <p>选择一个类别后，这里会显示知识库建议，方便你决定标注边界。</p>
          </div>
        </section>
      </div>

      <div class="annotation-toolbar annotation-toolbar--setup">
        <div class="annotation-toolbar__group">
          <button
            type="button"
            class="primary"
            @click="$emit('open-source-folder-picker')"
            :disabled="!canOperate || !canWrite || !datasetState.selectedDataset || uploadingSourceImages"
          >
            {{ uploadingSourceImages ? "导入中..." : "上传图片文件夹" }}
          </button>
          <button
            type="button"
            class="secondary"
            @click="$emit('handle-image-upload')"
            :disabled="!canOperate"
          >
            选择待标注图片
          </button>
          <button
            type="button"
            class="primary"
            @click="$emit('set-annotation-view', 'annotate')"
            :disabled="!datasetState.selectedDataset || !datasetState.classes.length"
          >
            进入标注
          </button>
          <button
            type="button"
            class="secondary"
            @click="$emit('set-annotation-view', 'train')"
            :disabled="!datasetState.selectedDataset || !datasetState.classes.length"
          >
            进入训练
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({
  datasetState: Object,
  selectedClass: String,
  selectedClassAdvice: Object,
  canOperate: Boolean,
  canWrite: Boolean,
  uploadingSourceImages: Boolean
})

defineEmits([
  'handle-selected-class-change',
  'open-source-folder-picker',
  'handle-image-upload',
  'set-annotation-view'
])
</script>

<style scoped>
.dataset-board {
  display: grid;
}

.dataset-board__surface {
  display: grid;
  gap: 1.5rem;
  padding: 18px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 100% 0%, rgba(184, 125, 72, 0.06), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(247, 241, 233, 0.82));
  border: 1px solid rgba(31, 36, 32, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.annotation-ops-banner--setup {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.annotation-ops-banner__card {
  padding: 1rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(31, 36, 32, 0.07);
}

.annotation-ops-banner__card span {
  font-size: 0.75rem;
  color: var(--muted);
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
  color: var(--muted);
  margin: 0;
}

.annotation-workflow-grid--setup {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.annotation-class-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 700px;
  overflow-y: auto;
  padding: 0.5rem;
}

.annotation-class-cloud__item {
  padding: 0.375rem 0.875rem;
  background: rgba(255, 255, 255, 0.74);
  border-radius: 20px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(31, 36, 32, 0.08);
}

.annotation-class-cloud__item:hover {
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
}

.annotation-class-cloud__item.is-active {
  color: #f8fbf7;
  border-color: rgba(42, 105, 74, 0.22);
  background: linear-gradient(135deg, #2f6f4f 0%, #173d2d 100%);
}

.annotation-class-cloud__empty {
  color: var(--muted);
  font-size: 0.875rem;
  padding: 1rem;
  text-align: center;
}

.annotation-advice-card {
  padding: 1rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(31, 36, 32, 0.07);
}

.annotation-advice-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(31, 36, 32, 0.08);
}

.annotation-advice-card__head strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.annotation-advice-card__head span {
  font-size: 0.75rem;
  color: var(--muted);
}

.annotation-advice-card__meta {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed rgba(31, 36, 32, 0.12);
}

.native-list--stacked {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.native-list__item--stacked {
  padding: 0.5rem;
  background: rgba(247, 242, 235, 0.82);
  border: 1px solid rgba(31, 36, 32, 0.05);
  border-radius: 14px;
  font-size: 0.813rem;
}

.annotation-toolbar--setup {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(31, 36, 32, 0.08);
}

.annotation-toolbar__group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

@media (max-width: 768px) {
  .dataset-board__surface {
    padding: 14px;
    border-radius: 24px;
  }

  .annotation-ops-banner--setup {
    grid-template-columns: 1fr;
  }

  .annotation-workflow-grid--setup {
    grid-template-columns: 1fr;
  }
}

</style>
