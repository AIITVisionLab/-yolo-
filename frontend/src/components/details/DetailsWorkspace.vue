<template>
  <section class="native-workspace native-workspace--details">
    <!-- 左侧控制面板 -->
    <div class="native-workspace__panel native-workspace__panel--controls">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">Assets</p>
        <h3>{{ isAdmin ? "模型资产与部署" : "模型资产" }}</h3>
      </div>

      <!-- 视图切换 -->
      <div class="workspace-mode-switch" role="tablist" aria-label="资产工作区视图">
        <button
          v-for="item in detailViews"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="activeDetailsView === item.id"
          :class="['workspace-mode-switch__item', { 'is-active': activeDetailsView === item.id }]"
          @click="detailsView = item.id"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.summary }}</strong>
        </button>
      </div>

      <!-- 状态信息 -->
      <div class="native-inline-actions native-inline-actions--triple">
        <span class="native-pill native-pill--accent">{{ modelsState.currentModelDisplay || describeModel(health) }}</span>
        <span class="native-pill native-pill--neutral">{{ describeHealth(health) }}</span>
      </div>

      <!-- 反馈信息 -->
      <div class="native-feedback">
        <p>{{ status }}</p>
        <strong v-if="error">{{ error }}</strong>
        <span v-if="modelsState.loading">正在刷新模型资产...</span>
      </div>
    </div>

    <!-- 右侧内容面板 -->
    <div class="native-workspace__panel native-workspace__panel--canvas">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">
          {{ activeDetailsView === "models" ? "Model Assets" : activeDetailsView === "upload" ? "Upload" : "Deploy" }}
        </p>
        <h3>
          {{ activeDetailsView === "models"
            ? (isAdmin ? "模型资产中心" : "个人模型中心")
            : activeDetailsView === "upload"
              ? (isAdmin ? "上传与替换模型" : "上传个人模型")
              : "部署入口" }}
        </h3>
      </div>

      <!-- 未登录状态 -->
      <div v-if="!isAuthenticated" class="native-lock-panel">
        <strong>登录后管理模型资产</strong>
        <p>登录后会解锁模型上传、下载、删除和切换能力。</p>
      </div>

      <!-- 已登录状态 -->
      <template v-else>
        <!-- 上传模型视图 -->
        <section v-if="activeDetailsView === 'upload'" class="asset-collection">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Upload</p>
              <h3>{{ isAdmin ? "上传平台模型" : "上传个人模型" }}</h3>
            </div>
            <span class="native-pill native-pill--neutral">
              {{ uploadForm.activate ? "上传后启用" : "仅上传" }}
            </span>
          </div>

          <form class="native-form" @submit.prevent="handleModelUpload">
            <FileField
              label="模型文件"
              accept=".onnx"
              :file="uploadForm.modelFile"
              @change="(file) => uploadForm.modelFile = file"
              button-label="选择 ONNX"
            />
            <FileField
              label="标签文件"
              accept=".json"
              :file="uploadForm.labelsFile"
              @change="(file) => uploadForm.labelsFile = file"
              button-label="选择标签"
            />
            <FileField
              label="说明文件"
              accept=".json"
              :file="uploadForm.metadataFile"
              @change="(file) => uploadForm.metadataFile = file"
              button-label="选择说明"
            />
            <label class="native-checkbox">
              <input type="checkbox" v-model="uploadForm.isPublic" />
              <span>上传为公开模型</span>
            </label>
            <label class="native-checkbox">
              <input type="checkbox" v-model="uploadForm.activate" />
              <span>上传后立即使用</span>
            </label>
            <button type="submit" class="primary" :disabled="busyKey === 'upload-user-model'">
              {{ busyKey === "upload-user-model" ? "上传中..." : "上传模型" }}
            </button>
          </form>
        </section>

        <!-- 模型列表视图 -->
        <section v-if="activeDetailsView === 'models'" class="asset-collection asset-collection--wide">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Models</p>
              <h3>可访问模型</h3>
            </div>
            <span class="native-pill native-pill--accent">{{ modelsState.currentModelDisplay || "未启用" }}</span>
          </div>

          <div v-if="!modelsState.items.length" class="native-empty native-empty--compact">
            <p>当前账号还没有可访问模型。</p>
          </div>

          <div v-else class="asset-list asset-list--models">
            <article
              v-for="model in modelsState.items"
              :key="model.name"
              :class="['asset-row', 'asset-row--model', { 'is-active': model.is_active }]"
            >
              <div class="asset-row__main">
                <div class="asset-row__title">
                  <strong>{{ getModelDisplayName(model) }}</strong>
                  <div class="asset-row__badges">
                    <span v-if="model.is_active" class="native-pill native-pill--accent">当前模型</span>
                    <span class="native-pill native-pill--neutral">{{ model.is_public ? "公开" : "私有" }}</span>
                    <span v-if="model.is_official" class="native-pill native-pill--warm">官方</span>
                  </div>
                </div>
                <p>{{ describeOwner(model) }}</p>
              </div>

              <div class="asset-row__actions">
                <button
                  type="button"
                  class="secondary native-utility-button"
                  :disabled="busyKey === `download-user-model-${model.name}`"
                  @click="runAssetAction(`download-user-model-${model.name}`, () => downloadModel(model))"
                >
                  下载
                </button>

                <button
                  v-if="isAdmin"
                  type="button"
                  class="secondary native-utility-button"
                  :disabled="busyKey === `activate-user-model-${model.name}` || model.is_active"
                  @click="runAssetAction(`activate-user-model-${model.name}`, () => activateModel(model))"
                >
                  {{ model.is_active ? "正在使用" : "设为当前" }}
                </button>

                <button
                  v-if="model.can_manage"
                  type="button"
                  class="secondary native-utility-button"
                  :disabled="busyKey === `delete-user-model-${model.name}`"
                  @click="handleDeleteModel(model)"
                >
                  删除
                </button>
              </div>
            </article>
          </div>
        </section>

        <!-- 部署入口视图（仅管理员） -->
        <section v-if="activeDetailsView === 'deploy' && isAdmin" class="asset-collection asset-collection--wide">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Deploy</p>
              <h3>部署与联调入口</h3>
            </div>
          </div>

          <div class="guide-grid">
            <article class="guide-card">
              <span>接口文档</span>
              <strong>FastAPI Docs</strong>
              <p>部署后可直接用它验证接口是否在线。</p>
              <a class="native-link" :href="buildApiUrl('/docs')" target="_blank" rel="noreferrer">
                打开接口文档
              </a>
            </article>

            <article class="guide-card">
              <span>OpenAPI</span>
              <strong>Schema JSON</strong>
              <p>前后端联调时可直接下载最新 schema。</p>
              <a class="native-link" :href="buildApiUrl('/openapi.json')" target="_blank" rel="noreferrer">
                打开 Schema
              </a>
            </article>

            <article class="guide-card">
              <span>当前发布</span>
              <strong>{{ modelsState.currentModelDisplay || describeModel(health) }}</strong>
              <p>发布前确认当前在线模型名称和接口基址，避免切错版本。</p>
            </article>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import FileField from '@/components/shared/FileField.vue'
import { buildApiUrl } from '@/lib/api'
import { saveBlobAsFile } from '@/lib/download'
import {
  deleteModelAsset,
  downloadModelArchive,
  fetchModels,
  selectActiveModel,
  uploadUserModel,
} from '@/lib/plantApi'

const props = defineProps({
  token: {
    type: String,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  },
  user: {
    type: Object,
    default: null
  },
  health: {
    type: Object,
    default: () => ({ state: 'offline', data: null })
  }
})

// 计算属性
const isAdmin = computed(() => props.user?.role === "admin")

// 状态
const detailsView = ref("models")
const modelsState = ref({
  loading: false,
  items: [],
  currentModel: "",
  currentModelDisplay: "",
})
const status = ref("模型资产已集中到这里。")
const error = ref("")
const busyKey = ref("")
const uploadForm = ref({
  modelFile: null,
  labelsFile: null,
  metadataFile: null,
  isPublic: false,
  activate: true,
})

// 计算属性
const activeDetailsView = computed(() => {
  return detailsView.value === "deploy" && !isAdmin.value ? "models" : detailsView.value
})

const detailViews = computed(() => {
  const items = [
    {
      id: "models",
      label: "模型列表",
      summary: modelsState.value.currentModelDisplay || `${modelsState.value.items.length} 个可访问模型`,
    },
    {
      id: "upload",
      label: "上传模型",
      summary: isAdmin.value ? "上线或替换可用模型" : "上传个人模型",
    },
  ]
  if (isAdmin.value) {
    items.push({
      id: "deploy",
      label: "部署入口",
      summary: "接口文档与联调入口",
    })
  }
  return items
})

// 工具函数
const describeHealth = (health) => {
  if (health?.state === "online") return "系统就绪"
  if (health?.state === "offline") return "服务异常"
  return "正在连接"
}

const describeModel = (health) => {
  if (health?.state !== "online") return "等待服务响应"
  return getModelDisplayNameByName(health?.data?.current_model, modelsState.value.items) || health?.data?.current_model || "尚未启用模型"
}

const describeOwner = (item) => {
  return item.owner_display_name || item.owner_username || (item.is_official ? "官方资源" : "当前用户")
}

const getModelDisplayName = (item) => {
  return item?.display_name || item?.name || "未命名模型"
}

const getModelDisplayNameByName = (modelName, items = []) => {
  const normalized = String(modelName || "").trim()
  if (!normalized) return ""
  return items.find((item) => item.name === normalized)?.display_name || normalized
}

// 重新加载模型列表
const reloadModels = async (message = "") => {
  if (!props.token) return
  
  const payload = await fetchModels(props.token)
  const items = payload?.data?.available_model_items || []
  const currentModel = payload?.data?.current_model || ""
  modelsState.value = {
    loading: false,
    items,
    currentModel,
    currentModelDisplay: getModelDisplayNameByName(currentModel, items),
  }
  if (message) {
    status.value = message
  }
}

// 执行资产操作
const runAssetAction = async (key, action) => {
  busyKey.value = key
  error.value = ""
  try {
    await action()
  } catch (err) {
    error.value = err.message || "模型资产操作失败。"
  } finally {
    busyKey.value = ""
  }
}

// 下载模型
const downloadModel = async (model) => {
  const blob = await downloadModelArchive(props.token, model.name)
  const modelDisplayName = getModelDisplayName(model)
  saveBlobAsFile(blob, `${modelDisplayName.replace(/\.onnx$/i, "")}_model.zip`)
  status.value = `模型 ${modelDisplayName} 已开始下载。`
}

// 激活模型（管理员）
const activateModel = async (model) => {
  const payload = await selectActiveModel(props.token, model.name)
  await reloadModels(payload?.message || `已切换模型 ${getModelDisplayName(model)}。`)
}

// 删除模型
const handleDeleteModel = (model) => {
  if (!confirm(`确定删除模型 ${getModelDisplayName(model)} 吗？`)) {
    return
  }
  runAssetAction(`delete-user-model-${model.name}`, async () => {
    const payload = await deleteModelAsset(props.token, model.name)
    await reloadModels(payload?.message || `模型 ${getModelDisplayName(model)} 已删除。`)
  })
}

// 上传模型
const handleModelUpload = async (event) => {
  event.preventDefault()
  
  if (!uploadForm.value.modelFile) {
    error.value = "请先选择要上传的 ONNX 模型。"
    return
  }
  
  await runAssetAction("upload-user-model", async () => {
    const payload = await uploadUserModel(props.token, uploadForm.value)
    status.value = payload?.message || "个人模型已上传。"
    uploadForm.value = {
      modelFile: null,
      labelsFile: null,
      metadataFile: null,
      isPublic: false,
      activate: true,
    }
    await reloadModels(payload?.message || "模型资产已刷新。")
  })
}

// 生命周期
let cancelled = false

onMounted(() => {
  if (!props.isAuthenticated || !props.token) {
    modelsState.value = {
      loading: false,
      items: [],
      currentModel: "",
      currentModelDisplay: "",
    }
    return
  }

  const bootstrap = async () => {
    modelsState.value.loading = true
    error.value = ""
    
    try {
      const payload = await fetchModels(props.token)
      const items = payload?.data?.available_model_items || []
      const currentModel = payload?.data?.current_model || ""
      if (cancelled) return
      
      modelsState.value = {
        loading: false,
        items,
        currentModel,
        currentModelDisplay: getModelDisplayNameByName(currentModel, items),
      }
      status.value = payload?.message || "模型资产已加载。"
    } catch (err) {
      if (!cancelled) {
        modelsState.value = {
          loading: false,
          items: [],
          currentModel: "",
          currentModelDisplay: "",
        }
        error.value = err.message || "模型资产加载失败。"
      }
    }
  }
  
  bootstrap()
})

onUnmounted(() => {
  cancelled = true
})

</script>

<style scoped>
.native-workspace--details {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
  height: 100%;
}

.native-workspace__panel {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 1.5rem;
  overflow-y: auto;
}

.native-workspace__section-head {
  margin-bottom: 1.5rem;
}

.workspace__section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.native-workspace__section-head h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.native-workspace__section-head p {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.workspace-mode-switch {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.workspace-mode-switch__item {
  display: grid;
  gap: 0.3rem;
  align-items: start;
  padding: 0.75rem 1rem;
  min-height: 72px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.workspace-mode-switch__item:hover {
  background: var(--bg-hover);
  transform: translateX(2px);
}

.workspace-mode-switch__item.is-active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color:rgb(8, 42, 8)
}

.workspace-mode-switch__item span {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.workspace-mode-switch__item strong {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 400;
  opacity: 0.8;
}

.native-inline-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.native-inline-actions--triple {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.native-pill {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.native-pill--accent {
  background: var(--primary-color);
  color: white;
}

.native-pill--neutral {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.native-pill--warm {
  background: var(--warning-color);
  color: white;
}

.native-feedback {
  margin-top: 1rem;
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

.native-lock-panel {
  text-align: center;
  padding: 3rem;
  background: var(--bg-tertiary);
  border-radius: 12px;
}

.native-lock-panel strong {
  display: block;
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
}

.native-lock-panel p {
  color: var(--text-muted);
  margin: 0;
}

.asset-collection {
  background: var(--bg-tertiary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.asset-collection--wide {
  width: 100%;
}

.asset-collection__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.asset-collection__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.native-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.native-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.native-field span {
  font-size: 0.875rem;
  font-weight: 500;
}

.native-field input,
.native-field select,
.native-field textarea {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  font-size: 0.875rem;
}

.native-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.native-checkbox input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.native-checkbox span {
  font-size: 0.875rem;
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.asset-list--models {
  gap: 0.85rem;
}

.asset-list--models .asset-row--model {
  width: 100%;
  min-height: 0;
  height: auto;
}

.asset-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.asset-row.is-active {
  border-left-color: var(--primary-color);
  background: rgba(var(--primary-rgb), 0.05);
}

.asset-row__main {
  flex: 1;
}

.asset-row__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
}

.asset-row__title strong {
  font-size: 0.875rem;
  font-weight: 600;
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

.native-utility-button {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.native-empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.native-empty--compact {
  padding: 1rem;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.guide-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.25rem;
  transition: transform 0.2s;
}

.guide-card:hover {
  transform: translateY(-2px);
}

.guide-card span {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.guide-card strong {
  display: block;
  font-size: 1rem;
  margin: 0.5rem 0;
}

.guide-card p {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.native-link {
  color: var(--primary-color);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.native-link:hover {
  text-decoration: underline;
}

button.primary {
  background: rgb(3, 51, 28);
  color: rgb(254, 255, 240);
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: opacity 0.2s;
}

button.primary:hover:not(:disabled) {
  opacity: 0.9;
}

button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

button.secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

button.secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .native-workspace--details {
    grid-template-columns: 1fr;
  }

  .asset-carousel__head,
  .asset-carousel__controls {
    width: 100%;
  }

  .asset-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .asset-row__actions {
    justify-content: flex-end;
  }
}

</style>
