<template>
  <div class="admin-page">
    <section class="panel">
      <div class="head-row">
        <div>
          <h3>平台管理控制台</h3>
        </div>
        <button class="soft-btn" type="button" @click="loadAll" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新列表' }}
        </button>
      </div>

      <p v-if="message" class="message success">{{ message }}</p>
      <p v-if="error" class="message error">{{ error }}</p>

      <div class="tab-row">
        <button
          v-for="item in tabs"
          :key="item"
          class="tab-btn"
          :class="{ active: activeTab === item }"
          type="button"
          @click="activeTab = item"
        >
          {{ item }}
        </button>
      </div>

      <div v-if="activeTab === '用户管理'" class="tab-panel">
        <input v-model.trim="userSearch" type="text" placeholder="搜索用户名" class="search-input" />
        <p v-if="!filteredUsers.length" class="empty-line">暂无用户数据，或当前筛选没有匹配结果。</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>数据集</th>
              <th>模型</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.username }}</td>
              <td>{{ user.role }}</td>
              <td>{{ user.dataset_count }}</td>
              <td>{{ user.model_count }}</td>
              <td>{{ user.disabled ? '已停用' : '正常' }}</td>
              <td>
                <div class="inline-actions">
                  <button class="soft-btn" type="button" @click="toggleDisabled(user)" :disabled="busy">
                    {{ user.disabled ? '恢复' : '停用' }}
                  </button>
                  <button class="danger-btn" type="button" @click="deleteUser(user)" :disabled="busy">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="activeTab === '平台模型'" class="tab-panel">
        <form class="upload-row" @submit.prevent="uploadPlatformModel">
          <input v-model.trim="platformModelName" type="text" placeholder="平台模型名称，可留空使用文件名" />
          <input type="file" accept=".onnx" @change="platformModelFile = $event.target.files?.[0] || null" />
          <button class="primary-btn" type="submit" :disabled="uploadingModel">
            {{ uploadingModel ? '上传中...' : '上传平台模型' }}
          </button>
        </form>
        <p v-if="modelMessage" class="message success">{{ modelMessage }}</p>
        <p v-if="modelError" class="message error">{{ modelError }}</p>

        <p v-if="!models.length" class="empty-line">暂无模型数据。上传成功后会显示在这里。</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>模型名称</th>
              <th>归属</th>
              <th>在线状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="model in models" :key="model.name">
              <td>{{ model.name }}</td>
              <td>{{ model.scope === 'official' ? '平台模型' : model.owner }}</td>
              <td>{{ model.is_online ? '当前在线' : '待命中' }}</td>
              <td>
                <div class="inline-actions">
                  <button class="soft-btn" type="button" @click="selectModel(model.name)" :disabled="busy || model.is_online">
                    切换当前模型
                  </button>
                  <button class="danger-btn" type="button" @click="deleteModel(model.name)" :disabled="busy || !model.can_manage">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="activeTab === '平台数据集'" class="tab-panel">
        <form class="upload-row" @submit.prevent="uploadPlatformDataset">
          <input v-model.trim="platformDatasetName" type="text" placeholder="平台数据集名称" />
          <input type="file" accept=".zip" @change="platformDatasetFile = $event.target.files?.[0] || null" />
          <label class="check-line">
            <input v-model="platformDatasetPublic" type="checkbox" />
            <span>设为公开</span>
          </label>
          <button class="primary-btn" type="submit" :disabled="uploadingDataset">
            {{ uploadingDataset ? '上传中...' : '上传 ZIP 数据集' }}
          </button>
        </form>
        <p v-if="datasetMessage" class="message success">{{ datasetMessage }}</p>
        <p v-if="datasetError" class="message error">{{ datasetError }}</p>

        <p v-if="!datasets.length" class="empty-line">暂无平台数据集。上传成功后会显示在这里。</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>数据集名称</th>
              <th>公开状态</th>
              <th>归属</th>
              <th>图片数量</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dataset in datasets" :key="dataset.name">
              <td>{{ dataset.name }}</td>
              <td>{{ dataset.is_public ? '公开' : '私有' }}</td>
              <td>{{ dataset.is_official ? '平台数据集' : dataset.owner }}</td>
              <td>{{ dataset.image_count ?? '-' }}</td>
              <td>
                <div class="inline-actions">
                  <button class="soft-btn" type="button" @click="downloadDataset(dataset.name)" :disabled="busy">下载</button>
                  <button class="danger-btn" type="button" @click="deleteDataset(dataset.name)" :disabled="busy || !dataset.can_manage">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="tab-panel">
        <article class="current-box">
          <strong>当前启用增强脚本</strong>
          <span>{{ currentAugmentation?.display_name || currentAugmentation?.name || '未设置' }}</span>
          <small v-if="currentAugmentation">
            {{ currentAugmentation.version || '未标注版本' }} / {{ currentAugmentation.author || '未知作者' }}
          </small>
        </article>

        <form class="script-form" @submit.prevent="uploadAugmentation">
          <input v-model.trim="scriptForm.displayName" type="text" placeholder="展示名称" />
          <input v-model.trim="scriptForm.version" type="text" placeholder="版本号" />
          <input v-model.trim="scriptForm.author" type="text" placeholder="作者" />
          <input v-model.trim="scriptForm.datasetType" type="text" placeholder="适用数据集类型" />
          <textarea v-model.trim="scriptForm.description" rows="3" placeholder="脚本描述"></textarea>
          <input type="file" accept=".py" @change="scriptForm.file = $event.target.files?.[0] || null" />
          <button class="primary-btn" type="submit" :disabled="uploadingAugmentation">
            {{ uploadingAugmentation ? '上传中...' : '上传并启用增强脚本' }}
          </button>
        </form>
        <p v-if="augmentationMessage" class="message success">{{ augmentationMessage }}</p>
        <p v-if="augmentationError" class="message error">{{ augmentationError }}</p>

        <p v-if="!augmentations.length" class="empty-line">暂无增强脚本。</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>脚本名称</th>
              <th>展示名称</th>
              <th>版本</th>
              <th>作者</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in augmentations" :key="item.name">
              <td>{{ item.name }}</td>
              <td>{{ item.display_name || '-' }}</td>
              <td>{{ item.version || '-' }}</td>
              <td>{{ item.author || '-' }}</td>
              <td>
                <div class="inline-actions">
                  <button class="soft-btn" type="button" @click="selectAugmentation(item.name)" :disabled="busy">
                    启用
                  </button>
                  <button class="danger-btn" type="button" @click="deleteAugmentation(item.name)" :disabled="busy || item.is_builtin">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { adminApi, annotationApi, modelApi } from '@/api'

const tabs = ['用户管理', '平台模型', '平台数据集', '增强脚本']
const activeTab = ref('用户管理')

const users = ref([])
const models = ref([])
const datasets = ref([])
const augmentations = ref([])
const currentAugmentation = ref(null)

const userSearch = ref('')
const platformModelName = ref('')
const platformModelFile = ref(null)
const platformDatasetName = ref('')
const platformDatasetFile = ref(null)
const platformDatasetPublic = ref(true)

const scriptForm = reactive({
  displayName: '',
  version: '1.0',
  author: '',
  datasetType: '',
  description: '',
  file: null
})

const loading = ref(false)
const busy = ref(false)
const uploadingModel = ref(false)
const uploadingDataset = ref(false)
const uploadingAugmentation = ref(false)

const message = ref('')
const error = ref('')
const modelMessage = ref('')
const modelError = ref('')
const datasetMessage = ref('')
const datasetError = ref('')
const augmentationMessage = ref('')
const augmentationError = ref('')

const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value
  return users.value.filter((item) => item.username.includes(userSearch.value))
})

const clearGlobalStatus = () => {
  message.value = ''
  error.value = ''
}

const setSuccess = (text) => {
  message.value = text
  error.value = ''
}

const loadUsers = async () => {
  try {
    const result = await adminApi.getUsers()
    users.value = result.users || []
  } catch (err) {
    error.value = err.message || '加载用户列表失败。'
  }
}

const loadModels = async () => {
  try {
    const result = await modelApi.getList()
    models.value = result.models || []
  } catch (err) {
    modelError.value = err.message || '加载模型列表失败。'
  }
}

const loadDatasets = async () => {
  try {
    const result = await adminApi.getConsole()
    datasets.value = result.managed_datasets || []
  } catch (err) {
    datasetError.value = err.message || '加载数据集列表失败。'
  }
}

const loadAugmentations = async () => {
  try {
    const result = await adminApi.getConsole()
    augmentations.value = result.augmentations || []
    currentAugmentation.value = result.current_augmentation || null
  } catch (err) {
    augmentationError.value = err.message || '加载增强脚本失败。'
  }
}

const loadAll = async () => {
  loading.value = true
  clearGlobalStatus()
  try {
    await Promise.all([
      loadUsers(),
      loadModels(),
      loadDatasets(),
      loadAugmentations()
    ])
  } catch (err) {
    error.value = err.message || '刷新列表失败。'
  } finally {
    loading.value = false
  }
}

const toggleDisabled = async (user) => {
  busy.value = true
  clearGlobalStatus()
  try {
    await adminApi.setUserDisabled(user.id, !user.disabled)
    setSuccess(`用户 ${user.username} 已${user.disabled ? '恢复' : '停用'}。`)
    await loadUsers()
  } catch (err) {
    error.value = err.message || '操作失败。'
  } finally {
    busy.value = false
  }
}

const deleteUser = async (user) => {
  if (!confirm(`确认删除用户 ${user.username}？此操作不可恢复。`)) return
  busy.value = true
  clearGlobalStatus()
  try {
    await adminApi.deleteUser(user.id)
    setSuccess(`用户 ${user.username} 已删除。`)
    await loadUsers()
  } catch (err) {
    error.value = err.message || '删除失败。'
  } finally {
    busy.value = false
  }
}

const uploadPlatformModel = async () => {
  if (!platformModelFile.value) {
    modelError.value = '请选择模型文件。'
    return
  }
  uploadingModel.value = true
  modelMessage.value = ''
  modelError.value = ''
  try {
    await adminApi.uploadPlatformModel(platformModelName.value, platformModelFile.value)
    modelMessage.value = '平台模型上传成功。'
    platformModelName.value = ''
    platformModelFile.value = null
    await loadModels()
  } catch (err) {
    modelError.value = err.message || '上传失败。'
  } finally {
    uploadingModel.value = false
  }
}

const selectModel = async (modelName) => {
  busy.value = true
  clearGlobalStatus()
  try {
    await modelApi.select(modelName)
    setSuccess(`模型 ${modelName} 已切换为当前模型。`)
    await loadModels()
  } catch (err) {
    error.value = err.message || '切换失败。'
  } finally {
    busy.value = false
  }
}

const deleteModel = async (modelName) => {
  if (!confirm(`确认删除模型 ${modelName}？`)) return
  busy.value = true
  clearGlobalStatus()
  try {
    await modelApi.delete(modelName)
    setSuccess(`模型 ${modelName} 已删除。`)
    await loadModels()
  } catch (err) {
    error.value = err.message || '删除失败。'
  } finally {
    busy.value = false
  }
}

const uploadPlatformDataset = async () => {
  if (!platformDatasetName.value || !platformDatasetFile.value) {
    datasetError.value = '请填写数据集名称并选择 ZIP 文件。'
    return
  }
  uploadingDataset.value = true
  datasetMessage.value = ''
  datasetError.value = ''
  try {
    await adminApi.uploadPlatformDataset(platformDatasetName.value, platformDatasetFile.value, platformDatasetPublic.value)
    datasetMessage.value = '平台数据集上传成功。'
    platformDatasetName.value = ''
    platformDatasetFile.value = null
    platformDatasetPublic.value = true
    await loadDatasets()
  } catch (err) {
    datasetError.value = err.message || '上传失败。'
  } finally {
    uploadingDataset.value = false
  }
}

const downloadDataset = (datasetName) => {
  const url = `${API_BASE_URL}/annotation/datasets/${encodeURIComponent(datasetName)}/download`
  const link = document.createElement('a')
  link.href = url
  link.download = `${datasetName}_dataset.zip`
  link.click()
}

const deleteDataset = async (datasetName) => {
  if (!confirm(`确认删除数据集 ${datasetName}？`)) return
  busy.value = true
  clearGlobalStatus()
  try {
    await annotationApi.deleteDataset(datasetName)
    setSuccess(`数据集 ${datasetName} 已删除。`)
    await loadDatasets()
  } catch (err) {
    error.value = err.message || '删除失败。'
  } finally {
    busy.value = false
  }
}

const uploadAugmentation = async () => {
  if (!scriptForm.file) {
    augmentationError.value = '请选择增强脚本文件。'
    return
  }
  uploadingAugmentation.value = true
  augmentationMessage.value = ''
  augmentationError.value = ''
  try {
    await adminApi.uploadAugmentation(
      scriptForm.file,
      scriptForm.displayName,
      scriptForm.version,
      scriptForm.author,
      scriptForm.description,
      scriptForm.datasetType
    )
    augmentationMessage.value = '增强脚本上传并启用成功。'
    scriptForm.displayName = ''
    scriptForm.version = '1.0'
    scriptForm.author = ''
    scriptForm.datasetType = ''
    scriptForm.description = ''
    scriptForm.file = null
    await loadAugmentations()
  } catch (err) {
    augmentationError.value = err.message || '上传失败。'
  } finally {
    uploadingAugmentation.value = false
  }
}

const selectAugmentation = async (scriptName) => {
  busy.value = true
  clearGlobalStatus()
  try {
    await adminApi.selectAugmentation(scriptName)
    setSuccess(`增强脚本 ${scriptName} 已启用。`)
    await loadAugmentations()
  } catch (err) {
    error.value = err.message || '启用失败。'
  } finally {
    busy.value = false
  }
}

const deleteAugmentation = async (scriptName) => {
  if (!confirm(`确认删除增强脚本 ${scriptName}？`)) return
  busy.value = true
  clearGlobalStatus()
  try {
    await adminApi.deleteAugmentation(scriptName)
    setSuccess(`增强脚本 ${scriptName} 已删除。`)
    await loadAugmentations()
  } catch (err) {
    error.value = err.message || '删除失败。'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.admin-page {
  display: grid;
  min-width: 0;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 22px;
  box-shadow: var(--shadow-soft);
  display: grid;
  gap: 18px;
  min-width: 0;
}

.head-row h3,
.current-box strong {
  margin: 0;
}

.head-row,
.inline-actions,
.upload-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.head-row {
  justify-content: space-between;
}

.tab-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tab-btn,
.primary-btn,
.soft-btn,
.danger-btn {
  border-radius: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
}

.tab-btn,
.soft-btn {
  background: rgba(255, 255, 255, 0.72);
}

.tab-btn.active,
.primary-btn {
  background: rgba(var(--brand-green-rgb), 0.84);
  color: var(--cream-white);
  font-weight: 700;
}

.danger-btn {
  background: rgba(180, 95, 77, 0.1);
  color: rgba(160, 80, 60, 0.88);
}

button:disabled {
  cursor: not-allowed;
  color: rgba(56, 56, 56, 0.9);
  opacity: 1;
}

.search-input,
.upload-row input[type='text'],
.upload-row input[type='file'],
.script-form input,
.script-form textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.76);
}

.upload-row input[type='file'] {
  flex: 2 1 320px;
}

.upload-row input[type='text'] {
  flex: 3 1 360px;
}

.tab-panel,
.script-form {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.check-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.check-line input {
  width: auto;
}

.current-box {
  display: grid;
  gap: 6px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.56);
}

.current-box span,
.current-box small,
.message,
.empty-line {
  margin: 0;
  color: var(--text-muted);
}

.message {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.54);
}

.message.success {
  color: var(--accent-strong);
}

.message.error {
  color: var(--warn);
}

.empty-line {
  padding: 14px 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  overflow-wrap: anywhere;
}

.data-table th,
.data-table td {
  padding: 14px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

@media (max-width: 900px) {
  .data-table,
  .data-table thead,
  .data-table tbody,
  .data-table th,
  .data-table td,
  .data-table tr {
    display: block;
  }

  .data-table tr {
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
  }

  .data-table th {
    display: none;
  }

  .data-table td {
    border: 0;
    padding: 8px 0;
  }
}
</style>
