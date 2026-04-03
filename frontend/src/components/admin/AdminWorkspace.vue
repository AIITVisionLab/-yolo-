<template>
  <section class="native-workspace native-workspace--admin">
    <input
      ref="datasetFolderInputRef"
      class="native-file-input"
      type="file"
      multiple
      webkitdirectory=""
      @change="handleDatasetFolderSelection"
    />
    <div class="native-workspace__panel native-workspace__panel--controls">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">Admin</p>
        <h3>平台总控台</h3>
      </div>

      <div v-if="!isAuthenticated || !isAdmin" class="native-empty native-empty--compact">
        <p>登录管理员账号后可查看平台总控。</p>
      </div>

      <template v-else>
        <div class="workspace-mode-switch" role="tablist" aria-label="平台操作入口">
          <button
            v-for="item in adminActionViews"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="adminActionView === item.id"
            :class="['workspace-mode-switch__item', { 'is-active': adminActionView === item.id }]"
            @click="adminActionView = item.id"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.summary }}</strong>
          </button>
        </div>

        <div class="native-inline-actions native-inline-actions--triple">
          <span class="native-pill native-pill--accent">{{ currentModelDisplayName || '未启用模型' }}</span>
          <span class="native-pill native-pill--warm">{{ getAugmentationDisplayName(highlightedAugmentation) }}</span>
          <span class="native-pill native-pill--neutral">{{ users.length }} 个用户</span>
        </div>

        <div v-if="adminActionView === 'model'" class="native-workspace__group">
          <div class="native-workspace__section-head native-workspace__section-head--tight">
            <h3>上传模型</h3>
          </div>
          <form class="native-form" @submit.prevent="handleAdminModelUpload">
            <FileField
              label="模型文件"
              accept=".onnx"
              :file="modelForm.modelFile"
              @change="(file) => modelForm.modelFile = file"
              button-label="选择 ONNX"
            />
            <FileField
              label="标签文件"
              accept=".json"
              :file="modelForm.labelsFile"
              @change="(file) => modelForm.labelsFile = file"
              button-label="选择标签"
            />
            <FileField
              label="说明文件"
              accept=".json"
              :file="modelForm.metadataFile"
              @change="(file) => modelForm.metadataFile = file"
              button-label="选择说明"
            />
            <label class="native-checkbox">
              <input type="checkbox" v-model="modelForm.isPublic" />
              <span>上传为公开模型</span>
            </label>
            <label class="native-checkbox">
              <input type="checkbox" v-model="modelForm.activate" />
              <span>上传后立即启用</span>
            </label>
            <button type="submit" class="primary admin-upload-submit" :disabled="busyKey === 'upload-model'">
              {{ busyKey === 'upload-model' ? '上传中...' : '上传模型' }}
            </button>
          </form>
        </div>

        <div v-else-if="adminActionView === 'dataset'" class="native-workspace__group">
          <div class="native-workspace__section-head native-workspace__section-head--tight">
            <h3>导入数据集</h3>
          </div>
          <form class="native-form" @submit.prevent="handleDatasetUpload">
            <FileField
              label="数据集压缩包"
              accept=".zip"
              :file="datasetForm.datasetFile"
              @change="(file) => datasetForm.datasetFile = file"
              button-label="选择 ZIP"
            />
            <div class="native-form__subsection">
              <div class="native-workspace__section-head native-workspace__section-head--tight">
                <h3>或直接导入数据集文件夹</h3>
              </div>
              <div class="annotation-clone-card">
                <strong>{{ datasetFolderLabel || '尚未选择目录' }}</strong>
                <p>
                  {{ datasetFolderFiles.length
                    ? `已选 ${datasetFolderFiles.length} 个文件，可直接导入这个 YOLO 数据集目录。`
                    : '支持直接选择整个本地数据集目录，不需要先手动打 ZIP。' }}
                </p>
              </div>
              <div class="native-inline-actions">
                <button type="button" class="secondary" @click="openDatasetFolderPicker">
                  选择数据集文件夹
                </button>
                <button
                  type="button"
                  class="primary admin-upload-submit"
                  :disabled="busyKey === 'upload-dataset-folder' || !datasetFolderFiles.length"
                  @click="handleDatasetFolderUpload"
                >
                  {{ busyKey === 'upload-dataset-folder' ? '导入中...' : '导入文件夹' }}
                </button>
              </div>
            </div>
            <label class="native-field">
              <span>数据集名称</span>
              <input v-model="datasetForm.datasetName" placeholder="留空则使用压缩包文件名" />
            </label>
            <label class="native-checkbox">
              <input type="checkbox" v-model="datasetForm.isPublic" />
              <span>上传为公开数据集</span>
            </label>
            <button type="submit" class="secondary" :disabled="busyKey === 'upload-dataset'">
              {{ busyKey === 'upload-dataset' ? '导入中...' : '导入数据集' }}
            </button>
          </form>
        </div>

        <div v-else class="native-workspace__group">
          <div class="native-workspace__section-head native-workspace__section-head--tight">
            <h3>上线增强算法</h3>
          </div>
          <form class="native-form" @submit.prevent="handleAugmentationUpload">
            <FileField
              label="增强脚本"
              accept=".py"
              :file="augmentationForm.scriptFile"
              @change="(file) => augmentationForm.scriptFile = file"
              button-label="选择脚本"
            />
            <label class="native-field">
              <span>算法展示名</span>
              <input v-model="augmentationForm.displayName" placeholder="例如 玉米叶片增强链路" />
            </label>
            <div class="admin-two-column-grid">
              <label class="native-field">
                <span>版本号</span>
                <input v-model="augmentationForm.version" placeholder="例如 v1.2" />
              </label>
              <label class="native-field">
                <span>作者</span>
                <input v-model="augmentationForm.author" placeholder="留空则使用当前管理员" />
              </label>
            </div>
            <label class="native-field">
              <span>适用数据集类型</span>
              <input v-model="augmentationForm.datasetTypes" placeholder="例如 玉米, 番茄, 目标检测" />
            </label>
            <label class="native-field">
              <span>算法说明</span>
              <textarea class="native-textarea" v-model="augmentationForm.description" placeholder="说明算法适用作物、增强策略和上线目的"></textarea>
            </label>
            <label class="native-checkbox">
              <input type="checkbox" v-model="augmentationForm.activate" />
              <span>上传后立即启用</span>
            </label>
            <div class="native-inline-actions">
              <button type="submit" class="secondary" :disabled="busyKey === 'upload-augmentation'">
                {{ busyKey === 'upload-augmentation' ? '上传中...' : '上传脚本' }}
              </button>
              <button
                type="button"
                class="secondary"
                :disabled="busyKey === 'select-builtin'"
                @click="runAdminAction('select-builtin', switchToBuiltin)"
              >
                切回内置增强
              </button>
            </div>
          </form>
        </div>

        <div class="native-feedback">
          <p>{{ status }}</p>
          <strong v-if="error">{{ error }}</strong>
          <span v-if="loading">正在刷新管理员数据...</span>
        </div>
      </template>
    </div>

    <div class="native-workspace__panel native-workspace__panel--canvas">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">
          {{ adminBoardView === 'models' ? 'Models' : adminBoardView === 'datasets' ? 'Datasets' : adminBoardView === 'users' ? 'Users' : 'Augmentation' }}
        </p>
        <h3>
          {{ adminBoardView === 'models' ? '模型资源' : adminBoardView === 'datasets' ? '数据集资源' : adminBoardView === 'users' ? '平台用户' : '增强算法上架台' }}
        </h3>
      </div>

      <div v-if="!isAuthenticated || !isAdmin" class="native-empty native-empty--compact">
        <p>当前账号没有管理员权限。</p>
      </div>

      <template v-else>
        <div class="workspace-mode-switch" role="tablist" aria-label="平台资源视图">
          <button
            v-for="item in adminBoardViews"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="adminBoardView === item.id"
            :class="['workspace-mode-switch__item', { 'is-active': adminBoardView === item.id }]"
            @click="adminBoardView = item.id"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.summary }}</strong>
          </button>
        </div>

        <div v-if="adminBoardView === 'models'" class="asset-collection asset-collection--wide">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Models</p>
              <h3>模型资源</h3>
            </div>
            <span class="native-pill native-pill--accent">{{ currentModelDisplayName || '未启用' }}</span>
          </div>
          <div v-if="!consoleData?.managed_models?.length" class="native-empty native-empty--compact">
            <p>还没有模型资源。</p>
          </div>
          <div v-else class="asset-list asset-list--models">
            <article v-for="model in consoleData.managed_models" :key="model.name" :class="['asset-row', 'asset-row--model', { 'is-active': model.is_active }]">
              <div class="asset-row__main">
                <div class="asset-row__title">
                  <strong>{{ getModelDisplayName(model) }}</strong>
                  <div class="asset-row__badges">
                    <span v-if="model.is_active" class="native-pill native-pill--accent">当前模型</span>
                    <span class="native-pill native-pill--neutral">{{ model.is_public ? '公开' : '私有' }}</span>
                    <span v-if="model.is_official" class="native-pill native-pill--warm">官方</span>
                  </div>
                </div>
                <p>{{ describeOwner(model) }} · {{ formatBytes(model.size_bytes) }} · {{ formatDate(model.uploaded_at) }}</p>
              </div>
              <div class="asset-row__actions">
                <button type="button" class="secondary native-utility-button" :disabled="busyKey === `download-model-${model.name}`" @click="runAdminAction(`download-model-${model.name}`, () => downloadModel(model))">下载</button>
                <button type="button" class="secondary native-utility-button" :disabled="busyKey === `select-model-${model.name}` || model.is_active" @click="runAdminAction(`select-model-${model.name}`, () => selectModel(model))">{{ model.is_active ? '正在使用' : '设为当前' }}</button>
                <button v-if="model.can_manage" type="button" class="secondary native-utility-button" :disabled="busyKey === `delete-model-${model.name}`" @click="handleDeleteModel(model)">删除</button>
              </div>
            </article>
          </div>
        </div>

        <div v-else-if="adminBoardView === 'datasets'" class="asset-collection asset-collection--wide">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Datasets</p>
              <h3>数据集资源</h3>
            </div>
          </div>
          <div v-if="!consoleData?.managed_datasets?.length" class="native-empty native-empty--compact">
            <p>还没有可管理的数据集。</p>
          </div>
          <div v-else class="asset-list asset-list--compact">
            <article v-for="dataset in consoleData.managed_datasets" :key="dataset.name" class="asset-row asset-row--compact">
              <div class="asset-row__main">
                <div class="asset-row__title">
                  <strong>{{ dataset.name }}</strong>
                  <div class="asset-row__badges">
                    <span class="native-pill native-pill--neutral">{{ dataset.is_public ? '公开' : '私有' }}</span>
                    <span v-if="dataset.is_official" class="native-pill native-pill--warm">官方</span>
                  </div>
                </div>
                <p>{{ describeOwner(dataset) }} · {{ formatDate(dataset.uploaded_at) }}</p>
              </div>
              <div class="asset-row__actions">
                <button type="button" class="secondary native-utility-button" :disabled="busyKey === `download-dataset-${dataset.name}`" @click="runAdminAction(`download-dataset-${dataset.name}`, () => downloadDataset(dataset))">下载</button>
                <button v-if="dataset.can_manage" type="button" class="secondary native-utility-button" :disabled="busyKey === `delete-dataset-${dataset.name}`" @click="handleDeleteDataset(dataset)">删除</button>
              </div>
            </article>
          </div>
        </div>

        <div v-else-if="adminBoardView === 'users'" class="asset-collection asset-collection--wide">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Users</p>
              <h3>平台用户</h3>
            </div>
            <span class="native-pill native-pill--neutral">{{ users.length }} 个账号</span>
          </div>
          <div v-if="!users.length" class="native-empty native-empty--compact">
            <p>当前还没有可展示的用户。</p>
          </div>
          <div v-else class="admin-user-grid">
            <article v-for="userItem in users" :key="userItem.id" class="admin-user-card">
              <div class="admin-user-card__head">
                <div>
                  <strong>{{ userItem.display_name || userItem.username }}</strong>
                  <span>@{{ userItem.username }}</span>
                </div>
                <span :class="['native-pill', `native-pill--${getUserPillType(userItem)}`]">{{ buildUserTone(userItem) }}</span>
              </div>
              <div class="admin-user-card__stats">
                <span>{{ userItem.dataset_count }} 个数据集</span>
                <span>{{ userItem.model_count }} 个模型</span>
              </div>
              <div v-if="userItem.role !== 'admin'" class="asset-row__actions">
                <button type="button" class="secondary native-utility-button" :disabled="busyKey === `flag-${userItem.id}`" @click="runAdminAction(`flag-${userItem.id}`, () => toggleUserFlag(userItem))">{{ userItem.is_flagged ? '取消关注' : '重点关注' }}</button>
                <button type="button" class="secondary native-utility-button" :disabled="busyKey === `disable-${userItem.id}`" @click="runAdminAction(`disable-${userItem.id}`, () => toggleUserDisable(userItem))">{{ userItem.is_disabled ? '解除封禁' : '封禁用户' }}</button>
                <button type="button" class="secondary native-utility-button" :disabled="busyKey === `delete-user-${userItem.id}`" @click="handleDeleteUser(userItem)">删除</button>
              </div>
            </article>
          </div>
        </div>

        <div v-else class="asset-collection asset-collection--wide">
          <div class="asset-collection__head">
            <div>
              <p class="workspace__section-label">Augmentation</p>
              <h3>增强算法上架台</h3>
            </div>
            <button type="button" class="secondary native-utility-button" :disabled="busyKey === 'refresh-admin'" @click="runAdminAction('refresh-admin', () => reloadAdminState('管理员数据已刷新。'))">刷新</button>
          </div>
          <div class="augmentation-studio">
            <div class="augmentation-studio__hero">
              <span>当前聚焦算法</span>
              <strong>{{ getAugmentationDisplayName(highlightedAugmentation) }}</strong>
              <p>{{ highlightedAugmentation?.description || '上传后的增强算法会展示适用数据集类型、版本和说明。' }}</p>
              <div class="augmentation-studio__meta">
                <span>{{ highlightedAugmentation?.version || '未标注版本' }}</span>
                <span>{{ highlightedAugmentation?.author || '未标注作者' }}</span>
                <span>{{ formatBytes(highlightedAugmentation?.size_bytes || 0) }}</span>
              </div>
              <div class="augmentation-studio__tags">
                <span v-for="type in getAugmentationDatasetTypes(highlightedAugmentation)" :key="type">{{ type }}</span>
              </div>
            </div>
            <div class="augmentation-studio__controls">
              <label class="native-field">
                <span>快速切换当前增强</span>
                <select v-model="selectedAugmentation">
                  <option value="">{{ getAugmentationDisplayName(consoleData?.builtin_augmentation_item) }}</option>
                  <option v-for="item in consoleData?.managed_augmentation_scripts" :key="item.name" :value="item.name">{{ getAugmentationDisplayName(item) }}</option>
                </select>
              </label>
              <div class="native-inline-actions">
                <button type="button" class="primary" :disabled="busyKey === 'apply-augmentation'" @click="runAdminAction('apply-augmentation', applyAugmentation)">应用当前选择</button>
                <button type="button" class="secondary" :disabled="busyKey === 'select-builtin'" @click="runAdminAction('select-builtin', switchToBuiltin)">切回内置增强</button>
              </div>
            </div>
          </div>
          <div class="augmentation-card-grid">
            <article
              v-for="script in augmentationCards"
              :key="script.name"
              :class="['augmentation-card', { 'is-active': script.is_active }, { 'is-selected': (script.is_builtin ? '' : script.name) === selectedAugmentation }]"
              role="button"
              tabindex="0"
              @click="selectedAugmentation = script.is_builtin ? '' : script.name"
              @keydown.enter.prevent="selectedAugmentation = script.is_builtin ? '' : script.name"
              @keydown.space.prevent="selectedAugmentation = script.is_builtin ? '' : script.name"
            >
              <div class="augmentation-card__head">
                <div>
                  <strong>{{ getAugmentationDisplayName(script) }}</strong>
                  <span>{{ script.name }}</span>
                </div>
                <div class="asset-row__badges">
                  <span v-if="script.is_builtin" class="native-pill native-pill--warm">内置</span>
                  <span v-if="script.is_active" class="native-pill native-pill--accent">当前生效</span>
                </div>
              </div>
              <p>{{ script.description || '未填写算法说明。建议补齐适用数据集、增强策略和上线目的。' }}</p>
              <div class="augmentation-card__meta">
                <span>{{ script.version || '未标注版本' }}</span>
                <span>{{ script.author || '未标注作者' }}</span>
                <span>{{ formatDate(script.uploaded_at) }}</span>
              </div>
              <div class="augmentation-card__tags">
                <span v-for="type in getAugmentationDatasetTypes(script)" :key="`${script.name}-${type}`">{{ type }}</span>
              </div>
              <div class="augmentation-card__actions">
                <span>{{ script.is_builtin ? '内置基础增强' : (((script.is_builtin ? '' : script.name) === selectedAugmentation) ? '当前选择' : '点击卡片可选中') }}</span>
                <button
                  v-if="!script.is_builtin"
                  type="button"
                  class="secondary native-utility-button"
                  :disabled="busyKey === `delete-augmentation-${script.name}`"
                  @click.stop="handleDeleteAugmentation(script)"
                >
                  删除
                </button>
              </div>
            </article>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import FileField from '@/components/shared/FileField.vue'
import {
  deleteAdminAugmentation,
  deleteUserAccount,
  fetchAdminConsole,
  fetchUsers,
  selectAdminAugmentation,
  setUserDisabled,
  setUserFlagged,
  uploadAdminAugmentation,
  uploadAdminDataset,
  uploadAdminDatasetFolder,
  uploadAdminModel,
} from '@/lib/adminApi'
import { saveBlobAsFile } from '@/lib/download'
import {
  deleteAnnotationDataset,
  deleteModelAsset,
  downloadAnnotationDataset,
  downloadModelArchive,
  selectActiveModel,
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
  }
})

// 状态
const isAdmin = computed(() => props.user?.role === "admin")
const consoleData = ref(null)
const users = ref([])
const loading = ref(false)
const status = ref("管理员登录后可以在这里统一维护用户、模型、数据集和增强脚本。")
const error = ref("")
const busyKey = ref("")
const selectedAugmentation = ref("")
const adminActionView = ref("model")
const adminBoardView = ref("models")
const datasetFolderInputRef = ref(null)
const datasetFolderFiles = ref([])
const datasetFolderRelativePaths = ref([])
const datasetFolderLabel = ref("")

// 表单状态
const modelForm = ref({
  modelFile: null,
  labelsFile: null,
  metadataFile: null,
  isPublic: true,
  activate: true,
})

const datasetForm = ref({
  datasetFile: null,
  datasetName: "",
  isPublic: true,
})

const augmentationForm = ref({
  scriptFile: null,
  activate: true,
  displayName: "",
  version: "",
  datasetTypes: "",
  description: "",
  author: "",
})

// 工具函数
const formatBytes = (sizeBytes) => {
  const value = Number(sizeBytes)
  if (!Number.isFinite(value) || value < 0) {
    return "--"
  }
  const units = ["B", "KB", "MB", "GB"]
  let current = value
  let unitIndex = 0
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }
  return `${current.toFixed(current >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const formatDate = (value) => {
  if (!value) {
    return "时间未知"
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

const describeOwner = (item) => {
  return item.owner_display_name || item.owner_username || (item.is_official ? "官方资源" : "当前用户")
}

const getModelDisplayName = (item) => {
  return item?.display_name || item?.name || "未命名模型"
}

const getModelDisplayNameByName = (modelName, items = consoleData.value?.managed_models || []) => {
  const normalized = String(modelName || "").trim()
  if (!normalized) return ""
  return items.find((item) => item.name === normalized)?.display_name || normalized
}

const currentModelDisplayName = computed(() => getModelDisplayNameByName(consoleData.value?.current_model))

const buildUserTone = (user) => {
  if (user.role === "admin") return "管理员"
  if (user.is_disabled) return "已封禁"
  if (user.is_flagged) return "重点关注"
  return "普通用户"
}

const getUserPillType = (user) => {
  if (user.role === "admin") return "accent"
  if (user.is_disabled) return "critical"
  if (user.is_flagged) return "warm"
  return "neutral"
}

const getAugmentationDisplayName = (item) => {
  return item?.display_name || item?.name || "未命名算法"
}

const getAugmentationDatasetTypes = (item) => {
  return Array.isArray(item?.dataset_types) && item.dataset_types.length ? item.dataset_types : ["通用数据集"]
}

// 计算属性
const augmentationCards = computed(() => {
  const cards = []
  if (consoleData.value?.builtin_augmentation_item) {
    cards.push(consoleData.value.builtin_augmentation_item)
  }
  cards.push(...(consoleData.value?.managed_augmentation_scripts || []))
  return cards
})

const highlightedAugmentation = computed(() => {
  if (!augmentationCards.value.length) {
    return null
  }
  const selected = augmentationCards.value.find((item) => (item.is_builtin ? "" : item.name) === selectedAugmentation.value)
  return selected || augmentationCards.value.find((item) => item.is_active) || augmentationCards.value[0]
})

const adminActionViews = computed(() => [
  {
    id: "model",
    label: "上传模型",
    summary: currentModelDisplayName.value || "切换在线模型",
  },
  {
    id: "dataset",
    label: "导入数据集",
    summary: `${consoleData.value?.managed_datasets?.length || 0} 个数据集`,
  },
  {
    id: "augmentation",
    label: "上线脚本",
    summary: getAugmentationDisplayName(highlightedAugmentation.value),
  },
])

const adminBoardViews = computed(() => [
  {
    id: "models",
    label: "模型资源",
    summary: currentModelDisplayName.value || `${consoleData.value?.managed_models?.length || 0} 个模型`,
  },
  {
    id: "datasets",
    label: "数据集",
    summary: `${consoleData.value?.managed_datasets?.length || 0} 个可管理数据集`,
  },
  {
    id: "users",
    label: "平台用户",
    summary: `${users.value.length} 个账号`,
  },
  {
    id: "augmentations",
    label: "增强脚本",
    summary: getAugmentationDisplayName(highlightedAugmentation.value),
  },
])

// 方法
const reloadAdminState = async (message = "") => {
  if (!props.token) return

  const [consolePayload, usersPayload] = await Promise.all([
    fetchAdminConsole(props.token),
    fetchUsers(props.token),
  ])

  consoleData.value = consolePayload?.data || null
  users.value = usersPayload?.data?.users || []
  selectedAugmentation.value = consolePayload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || ""
  if (message) {
    status.value = message
  }
}

const runAdminAction = async (key, action) => {
  busyKey.value = key
  error.value = ""
  try {
    await action()
  } catch (err) {
    error.value = err.message || "管理员操作失败。"
  } finally {
    busyKey.value = ""
  }
}

const handleAdminModelUpload = async () => {
  if (!modelForm.value.modelFile) {
    error.value = "请先选择要上传的 ONNX 模型。"
    return
  }

  await runAdminAction("upload-model", async () => {
    const payload = await uploadAdminModel(props.token, modelForm.value)
    consoleData.value = payload?.data || null
    selectedAugmentation.value = payload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || selectedAugmentation.value
    status.value = payload?.message || "模型已上传。"
    modelForm.value = {
      modelFile: null,
      labelsFile: null,
      metadataFile: null,
      isPublic: true,
      activate: true,
    }
    const usersPayload = await fetchUsers(props.token)
    users.value = usersPayload?.data?.users || []
  })
}

const handleDatasetUpload = async () => {
  if (!datasetForm.value.datasetFile) {
    error.value = "请先选择数据集压缩包。"
    return
  }

  await runAdminAction("upload-dataset", async () => {
    const payload = await uploadAdminDataset(props.token, datasetForm.value)
    await reloadAdminState(payload?.message || "数据集已导入。")
    datasetForm.value = {
      datasetFile: null,
      datasetName: "",
      isPublic: true,
    }
  })
}

const openDatasetFolderPicker = () => {
  datasetFolderInputRef.value?.click()
}

const handleDatasetFolderSelection = (event) => {
  const files = Array.from(event.target.files || [])
  datasetFolderFiles.value = files
  datasetFolderRelativePaths.value = files.map((file) => file.webkitRelativePath || file.name || "")
  const firstRelativePath = datasetFolderRelativePaths.value[0] || ""
  const folderName = firstRelativePath.split(/[\\/]/)[0] || ""
  datasetFolderLabel.value = folderName || files[0]?.name || ""
  if (!datasetForm.value.datasetName.trim() && folderName) {
    datasetForm.value.datasetName = folderName
  }
}

const handleDatasetFolderUpload = async () => {
  if (!datasetFolderFiles.value.length) {
    error.value = "请先选择一个本地数据集文件夹。"
    return
  }

  await runAdminAction("upload-dataset-folder", async () => {
    const payload = await uploadAdminDatasetFolder(props.token, {
      datasetName: datasetForm.value.datasetName,
      isPublic: datasetForm.value.isPublic,
      files: datasetFolderFiles.value,
      relativePaths: datasetFolderRelativePaths.value,
    })
    await reloadAdminState(payload?.message || "数据集目录已导入。")
    datasetForm.value = {
      datasetFile: null,
      datasetName: "",
      isPublic: true,
    }
    datasetFolderFiles.value = []
    datasetFolderRelativePaths.value = []
    datasetFolderLabel.value = ""
    if (datasetFolderInputRef.value) {
      datasetFolderInputRef.value.value = ""
    }
  })
}

const handleAugmentationUpload = async () => {
  if (!augmentationForm.value.scriptFile) {
    error.value = "请先选择增强脚本。"
    return
  }

  await runAdminAction("upload-augmentation", async () => {
    const payload = await uploadAdminAugmentation(props.token, augmentationForm.value)
    consoleData.value = payload?.data || null
    selectedAugmentation.value = payload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || ""
    status.value = payload?.message || "增强脚本已上传。"
    augmentationForm.value = {
      scriptFile: null,
      activate: true,
      displayName: "",
      version: "",
      datasetTypes: "",
      description: "",
      author: "",
    }
  })
}

const applyAugmentation = async () => {
  const payload = await selectAdminAugmentation(props.token, selectedAugmentation.value)
  consoleData.value = payload?.data || null
  status.value = payload?.message || "增强脚本已切换。"
}

const switchToBuiltin = async () => {
  const payload = await selectAdminAugmentation(props.token)
  consoleData.value = payload?.data || null
  selectedAugmentation.value = ""
  status.value = payload?.message || "已切回内置增强算法。"
}

const toggleUserFlag = async (user) => {
  const payload = await setUserFlagged(props.token, user.id, !user.is_flagged)
  users.value = payload?.data?.users || []
  status.value = payload?.message || "用户关注状态已更新。"
}

const toggleUserDisable = async (user) => {
  const payload = await setUserDisabled(props.token, user.id, !user.is_disabled)
  users.value = payload?.data?.users || []
  status.value = payload?.message || "用户封禁状态已更新。"
}

const handleDeleteUser = (user) => {
  if (!confirm(`确定删除用户 ${user.username} 吗？这会同时清理其模型和数据集。`)) {
    return
  }
  runAdminAction(`delete-user-${user.id}`, async () => {
    const payload = await deleteUserAccount(props.token, user.id)
    users.value = payload?.data?.users || []
    await reloadAdminState(payload?.message || "用户已删除。")
  })
}

const downloadModel = async (model) => {
  const blob = await downloadModelArchive(props.token, model.name)
  const modelDisplayName = getModelDisplayName(model)
  saveBlobAsFile(blob, `${modelDisplayName.replace(/\.onnx$/i, "")}_model.zip`)
  status.value = `模型 ${modelDisplayName} 已开始下载。`
}

const selectModel = async (model) => {
  const payload = await selectActiveModel(props.token, model.name)
  await reloadAdminState(payload?.message || `已切换模型 ${getModelDisplayName(model)}。`)
}

const handleDeleteModel = (model) => {
  if (!confirm(`确定删除模型 ${getModelDisplayName(model)} 吗？`)) {
    return
  }
  runAdminAction(`delete-model-${model.name}`, async () => {
    const payload = await deleteModelAsset(props.token, model.name)
    await reloadAdminState(payload?.message || `模型 ${getModelDisplayName(model)} 已删除。`)
  })
}

const downloadDataset = async (dataset) => {
  const blob = await downloadAnnotationDataset(props.token, dataset.name)
  saveBlobAsFile(blob, `${dataset.name}_dataset.zip`)
  status.value = `数据集 ${dataset.name} 已开始下载。`
}

const handleDeleteDataset = (dataset) => {
  if (!confirm(`确定删除数据集 ${dataset.name} 吗？`)) {
    return
  }
  runAdminAction(`delete-dataset-${dataset.name}`, async () => {
    const payload = await deleteAnnotationDataset(props.token, dataset.name)
    await reloadAdminState(payload?.message || `数据集 ${dataset.name} 已删除。`)
  })
}

const handleDeleteAugmentation = (script) => {
  if (script.is_builtin) {
    return
  }
  if (!confirm(`确定删除增强算法 ${script.name} 吗？`)) {
    return
  }
  runAdminAction(`delete-augmentation-${script.name}`, async () => {
    const payload = await deleteAdminAugmentation(props.token, script.name)
    consoleData.value = payload?.data || null
    selectedAugmentation.value = payload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || ""
    status.value = payload?.message || `增强算法 ${script.name} 已删除。`
  })
}

// 生命周期
onMounted(async () => {
  if (!props.isAuthenticated || !props.token || !isAdmin.value) {
    consoleData.value = null
    users.value = []
    selectedAugmentation.value = ""
    loading.value = false
    return
  }

  let cancelled = false
  loading.value = true
  error.value = ""

  try {
    const [consolePayload, usersPayload] = await Promise.all([
      fetchAdminConsole(props.token),
      fetchUsers(props.token),
    ])
    if (cancelled) return

    consoleData.value = consolePayload?.data || null
    users.value = usersPayload?.data?.users || []
    selectedAugmentation.value = consolePayload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || ""
    status.value = consolePayload?.message || "管理员总控已加载。"
  } catch (err) {
    if (!cancelled) {
      error.value = err.message || "管理员总控加载失败。"
    }
  } finally {
    if (!cancelled) {
      loading.value = false
    }
  }

  return () => {
    cancelled = true
  }
})

// 监听权限变化
watch([() => props.isAuthenticated, () => props.token, isAdmin], async ([isAuth, token, admin]) => {
  if (!isAuth || !token || !admin) {
    consoleData.value = null
    users.value = []
    selectedAugmentation.value = ""
    loading.value = false
  } else {
    await reloadAdminState()
  }
})

</script>

<style scoped>

.native-workspace--admin {
  gap: 1.5rem;
}

.native-workspace--admin > .native-workspace__panel {
  gap: 1.25rem;
  padding: 1.6rem;
}

.native-workspace--admin .native-workspace__section-head {
  gap: 0.55rem;
}

.native-workspace--admin .native-workspace__group {
  gap: 1rem;
  padding-top: 1.1rem;
}

.native-workspace--admin .native-inline-actions {
  gap: 0.85rem;
}

.native-workspace--admin .native-feedback {
  margin-top: 0.35rem;
  padding: 1rem 1.1rem;
}

.admin-two-column-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.native-workspace--admin .native-form__subsection {
  display: grid;
  gap: 0.8rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 252, 247, 0.72);
  border: 1px solid rgba(46, 64, 52, 0.08);
}

.native-workspace--admin .annotation-clone-card {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border-radius: 0.95rem;
  background: rgba(248, 244, 238, 0.82);
  border: 1px solid rgba(46, 64, 52, 0.08);
}

.native-workspace--admin .annotation-clone-card p {
  margin: 0;
  line-height: 1.6;
}

.native-workspace--admin .asset-collection--wide {
  gap: 1rem;
  padding: 1.35rem;
}

.native-workspace--admin .asset-collection__head {
  gap: 1rem;
  margin-bottom: 0.35rem;
}

.native-workspace--admin .asset-collection__head h3 {
  margin-bottom: 0.5rem;
}

.native-workspace--admin .asset-list--models {
  gap: 1.1rem;
}

.augmentation-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.native-workspace--admin .asset-list--models .asset-row--model {
  width: 100%;
  height: auto;
  min-height: 7.5rem;
  align-items: flex-start;
  box-sizing: border-box;
  gap: 1.2rem;
  padding: 1.35rem 1.45rem;
}

.native-workspace--admin .asset-row__main {
  gap: 0.7rem;
}

.native-workspace--admin .asset-row__main p {
  line-height: 1.7;
}

.native-workspace--admin .asset-row__title {
  gap: 0.85rem;
}

.native-workspace--admin .asset-row__title strong {
  font-size: 1.08rem;
}

.native-workspace--admin .asset-row__badges,
.native-workspace--admin .asset-row__actions {
  gap: 0.7rem;
}

.native-workspace--admin .asset-row__actions {
  align-self: center;
}

.native-workspace--admin .native-utility-button {
  min-height: 2.75rem;
  padding-inline: 0.95rem;
}

.admin-user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.native-workspace--admin .primary:disabled,
.native-workspace--admin .secondary:disabled {
  opacity: 1;
  box-shadow: none;
}

.native-workspace--admin .primary:disabled {
  color: rgba(24, 41, 30, 0.6);
  background: linear-gradient(135deg, rgba(237, 241, 235, 0.98) 0%, rgba(226, 231, 222, 0.98) 100%);
  border: 1px solid rgba(32, 49, 38, 0.08);
}

.native-workspace--admin .secondary:disabled {
  color: rgba(27, 42, 34, 0.54);
  background: rgba(245, 242, 237, 0.94);
  border-color: rgba(32, 49, 38, 0.08);
}

.native-workspace--admin .admin-upload-submit {
  color: #f4efe6 !important;
  background: linear-gradient(135deg, #356c51 0%, #244636 100%) !important;
  border: 1px solid rgba(20, 49, 35, 0.16) !important;
  box-shadow: 0 12px 28px rgba(36, 70, 54, 0.18) !important;
}

.native-workspace--admin .admin-upload-submit:disabled {
  color: rgba(24, 41, 30, 0.62) !important;
  background: linear-gradient(135deg, rgba(237, 241, 235, 0.98) 0%, rgba(226, 231, 222, 0.98) 100%) !important;
  border: 1px solid rgba(32, 49, 38, 0.08) !important;
  box-shadow: none !important;
}
</style>
