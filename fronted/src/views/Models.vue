<!--模型资产-->
<template>
  <div class="models-page">
    <section class="panel upload-panel">
      <div class="head-row">
        <div>
          <h3>模型资产中心</h3>
        </div>
        <button class="primary-btn" type="button" @click="showUpload = !showUpload">{{ showUpload ? '收起上传' : '上传新模型' }}</button>
      </div>

      <form v-if="showUpload" class="upload-form" @submit.prevent="uploadModel">
        <label>
          <span>模型名称</span>
          <input v-model.trim="form.name" type="text" placeholder="例如 rice-edge-onnx" />
        </label>
        <label>
          <span>ONNX 文件</span>
          <input type="file" accept=".onnx" @change="form.modelFile = $event.target.files?.[0] || null" />
        </label>
        <label>
          <span>标签文件</span>
          <input type="file" accept=".txt,.json" @change="form.labelsFile = $event.target.files?.[0] || null" />
        </label>
        <label class="check-line">
          <input v-model="form.isPublic" type="checkbox" />
          <span>上传为公开模型</span>
        </label>
        <label class="check-line">
          <input v-model="form.enableNow" type="checkbox" />
          <span>上传后立即启用</span>
        </label>
        <button class="primary-btn" type="submit" :disabled="uploading">{{ uploading ? '上传中...' : '确认上传' }}</button>
      </form>

      <p v-if="message" class="message">{{ message }}</p>
      <p v-if="error" class="message error">{{ error }}</p>
    </section>

    <section class="model-grid">
      <article v-for="model in models" :key="model.name" class="panel model-card">
        <div class="card-top">
          <div>
            <h4>{{ model.name }}</h4>
            <p>{{ model.type }} · {{ model.owner }}</p>
          </div>
          <span class="badge" :class="{ active: model.is_online }">{{ model.is_online ? '当前在线' : model.is_public ? '公开模型' : '私有模型' }}</span>
        </div>

        <dl class="meta-list">
          <div>
            <dt>归属类型</dt>
            <dd>{{ model.scope === 'official' ? '官方或平台级' : '个人模型' }}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{{ formatDate(model.created_at) }}</dd>
          </div>
        </dl>

        <div class="actions">
          <button class="soft-btn" type="button" @click="selectModel(model.name)" :disabled="model.is_online">切换使用</button>
          <button class="soft-btn" type="button" @click="downloadModel(model.name)">下载模型</button>
          <button class="danger-btn" type="button" @click="deleteModel(model.name)">删除模型</button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { modelApi } from '@/api'

const models = ref([])
const uploading = ref(false)
const showUpload = ref(false)
const message = ref('')
const error = ref('')

const form = reactive({
  name: '',
  modelFile: null,
  labelsFile: null,
  isPublic: false,
  enableNow: true
})

const loadModels = async () => {
  const result = await modelApi.getList()
  models.value = result.models || []
}

const uploadModel = async () => {
  uploading.value = true
  error.value = ''
  try {
    await modelApi.upload(form.name, form.modelFile, form.labelsFile, null, form.isPublic, form.enableNow)
    message.value = '模型上传成功，资产中心已刷新。'
    Object.assign(form, { name: '', modelFile: null, labelsFile: null, isPublic: false, enableNow: true })
    showUpload.value = false
    await loadModels()
  } catch (err) {
    error.value = err.message || '上传失败。'
  } finally {
    uploading.value = false
  }
}

const selectModel = async (name) => {
  await modelApi.select(name)
  message.value = `已切换到模型：${name}`
  await loadModels()
}

const downloadModel = (name) => {
  modelApi.download(name)
}

const deleteModel = async (name) => {
  try {
    await modelApi.delete(name)
    message.value = `已删除模型：${name}`
    await loadModels()
  } catch (err) {
    error.value = err.message || '删除失败。'
  }
}

const formatDate = (value) => new Date(value).toLocaleString('zh-CN', { hour12: false })

onMounted(loadModels)
</script>

<style scoped>
.models-page {
  display: grid;
  gap: 24px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 22px;
  box-shadow: var(--shadow-soft);
}

.head-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.head-row h3,
.card-top h4 {
  margin: 0;
}

.head-row p,
.card-top p,
.message,
.meta-list dt,
.meta-list dd {
  margin: 0;
}

.head-row p,
.card-top p,
.meta-list dt {
  color: var(--text-muted);
}

.upload-form {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.upload-form label span {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.upload-form input[type='text'],
.upload-form input[type='file'] {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.78);
}

.check-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.primary-btn,
.soft-btn,
.danger-btn {
  border-radius: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
}

.primary-btn {
  background: rgba(var(--brand-green-rgb), 0.84);
  color: var(--cream-white);
  font-weight: 700;
}

.soft-btn {
  background: rgba(255, 255, 255, 0.72);
}

.danger-btn {
  background: rgba(180, 95, 77, 0.1);
  color: rgba(160, 80, 60, 0.88);
}

.message {
  margin-top: 14px;
  color: var(--text-muted);
}

.message.error {
  color: var(--warn);
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.model-card {
  display: grid;
  gap: 18px;
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.badge {
  align-self: flex-start;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-muted);
  font-size: 13px;
}

.badge.active {
  background: rgba(var(--brand-green-rgb), 0.14);
  color: var(--accent-strong);
}

.meta-list {
  display: grid;
  gap: 12px;
}

.meta-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 900px) {
  .upload-form,
  .actions {
    grid-template-columns: 1fr;
  }

  .head-row,
  .card-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
