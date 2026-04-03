<template>
  <section class="native-workspace native-workspace--annotation">
    <!-- 隐藏的文件输入 -->
    <input ref="imageInputRef" class="native-file-input" type="file" accept="image/*" @change="handleImageChange" :disabled="!canOperate" />
    <input
      ref="sourceFolderInputRef"
      class="native-file-input"
      type="file"
      accept="image/*"
      multiple
      webkitdirectory=""
      @change="handleSourceFolderUpload"
      :disabled="!canOperate || !canWrite"
    />
    <input
      ref="datasetFolderImportInputRef"
      class="native-file-input"
      type="file"
      multiple
      webkitdirectory=""
      @change="handleDatasetFolderImportSelection"
      :disabled="!canOperate"
    />

    <!-- 左侧控制面板 -->
    <div class="native-workspace__panel native-workspace__panel--controls annotation-sidebar">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">Annotation</p>
        <h3>{{ currentAnnotationTab.label }}</h3>
      </div>

      <div class="annotation-workspace-switch" role="tablist" aria-label="标注工作流阶段">
        <button
          v-for="item in annotationViewTabs"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="annotationView === item.id"
          :class="['annotation-workspace-switch__item', { 'is-active': annotationView === item.id }]"
          @click="annotationView = item.id"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.summary }}</strong>
        </button>
      </div>

      <!-- 数据集准备视图 -->
      <template v-if="annotationView === 'dataset'">
        <DatasetControls
          :can-operate="canOperate"
          :can-write="canWrite"
          :dataset-state="datasetState"
          :selected-class="selectedClass"
          :custom-class="customClass"
          :dataset-create-name="datasetCreateName"
          :dataset-public="datasetPublic"
          :dataset-create-mode="datasetCreateMode"
          :dataset-template-key="datasetTemplateKey"
          :dataset-import-name="datasetImportName"
          :dataset-import-public="datasetImportPublic"
          :dataset-import-folder-label="datasetImportFolderLabel"
          :dataset-import-files="datasetImportFiles"
          :importing-dataset-folder="importingDatasetFolder"
          :uploading-source-images="uploadingSourceImages"
          :selected-class-advice="selectedClassAdvice"
          :visible-template-cards="visibleTemplateCards"
          :selected-dataset-template-label="selectedDatasetTemplateLabel"
          :create-template="createTemplate"
          :status="status"
          :error="error"
          :active-panel="datasetSetupPanel"
          :flow-panels="datasetSetupPanels"
          @reload-annotation-data="reloadAnnotationData"
          @handle-dataset-create="handleDatasetCreate"
          @handle-dataset-delete="handleDatasetDelete"
          @handle-dataset-download="handleDatasetDownload"
          @handle-add-class="handleAddClass"
          @handle-delete-class="handleDeleteClass"
          @handle-selected-class-change="handleSelectedClassChange"
          @open-source-folder-picker="openSourceFolderPicker"
          @open-dataset-folder-import-picker="openDatasetFolderImportPicker"
          @handle-dataset-folder-import="handleDatasetFolderImport"
          @update:custom-class="customClass = $event"
          @update:dataset-create-name="datasetCreateName = $event"
          @update:dataset-public="datasetPublic = $event"
          @update:dataset-create-mode="datasetCreateMode = $event"
          @update:dataset-template-key="datasetTemplateKey = $event"
          @update:dataset-import-name="datasetImportName = $event"
          @update:dataset-import-public="datasetImportPublic = $event"
        />
      </template>

      <!-- 标注视图 -->
      <template v-if="annotationView === 'annotate'">
        <AnnotateControls
          :can-operate="canOperate"
          :can-write="canWrite"
          :dataset-state="datasetState"
          :selected-class="selectedClass"
          :custom-class="customClass"
          :selected-source-image-name="selectedSourceImageName"
          :image-file="imageFile"
          :boxes="boxes"
          :selected-index="selectedIndex"
          :saving="saving"
          :loading-source-image-name="loadingSourceImageName"
          :next-pending-source-image="nextPendingSourceImage"
          :recognition-payload="recognitionPayload"
          :selected-class-advice="selectedClassAdvice"
          :status="status"
          :error="error"
          @reload-annotation-data="reloadAnnotationData"
          @handle-selected-class-change="handleSelectedClassChange"
          @handle-add-class="handleAddClass"
          @handle-delete-class="handleDeleteClass"
          @open-source-folder-picker="openSourceFolderPicker"
          @handle-image-upload="() => imageInputRef?.click()"
          @handle-use-recognition-image="handleUseRecognitionImage"
          @handle-load-next-pending="handleLoadNextPendingSourceImage"
          @handle-import-detections="handleImportDetections"
          @handle-clear-boxes="handleClearBoxes"
          @handle-delete-selected-box="handleDeleteSelectedBox"
          @handle-save-annotations="handleSaveAnnotations"
          @update:custom-class="customClass = $event"
        />
      </template>

      <!-- 训练视图 -->
      <template v-if="annotationView === 'train'">
        <TrainingControls
          :can-operate="canOperate"
          :can-write="canWrite"
          :dataset-state="datasetState"
          :augment-copies="augmentCopies"
          :augment-train-ratio="augmentTrainRatio"
          :augment-seed="augmentSeed"
          :train-form="trainForm"
          :models="models"
          :augmenting="augmenting"
          :training="training"
          :train-task="trainTask"
          :status="status"
          :error="error"
          @reload-annotation-data="reloadAnnotationData"
          @handle-augment="handleAugment"
          @handle-train="handleTrain"
          @update:augment-copies="augmentCopies = $event"
          @update:augment-train-ratio="augmentTrainRatio = $event"
          @update:augment-seed="augmentSeed = $event"
          @update:train-form="trainForm = $event"
        />
      </template>
    </div>

    <!-- 右侧内容面板 -->
    <div class="native-workspace__panel native-workspace__panel--canvas annotation-board">
      <!-- 数据集准备主视图 -->
      <div v-if="annotationView === 'dataset'" class="annotation-dataset-stage">
        <DatasetSetupFlow
          :active-panel="datasetSetupPanel"
          :panels="datasetSetupPanels"
          @update:active-panel="datasetSetupPanel = $event"
        />

        <DatasetBoard
          :dataset-state="datasetState"
          :selected-class="selectedClass"
          :selected-class-advice="selectedClassAdvice"
          :can-operate="canOperate"
          :can-write="canWrite"
          :uploading-source-images="uploadingSourceImages"
          @handle-selected-class-change="handleSelectedClassChange"
          @open-source-folder-picker="openSourceFolderPicker"
          @handle-image-upload="() => imageInputRef?.click()"
          @set-annotation-view="(view) => annotationView = view"
        />
      </div>

      <!-- 标注主视图 -->
      <AnnotateBoard
        v-if="annotationView === 'annotate'"
        :dataset-state="datasetState"
        :selected-dataset-template-label="selectedDatasetTemplateLabel"
        :selected-source-image-name="selectedSourceImageName"
        :image-file="imageFile"
        :image-url="imageUrl"
        :image-meta="imageMeta"
        :boxes="boxes"
        :draft-box="draftBox"
        :selected-index="selectedIndex"
        :selected-box="selectedBox"
        :loading-source-image-name="loadingSourceImageName"
        :can-operate="canOperate"
        @load-dataset-source-image="loadDatasetSourceImage"
        @handle-pointer-down="handlePointerDown"
        @handle-pointer-move="handlePointerMove"
        @set-selected-index="setSelectedIndex"
        @handle-selected-class-change="handleSelectedClassChange"
        @set-focus-mode="setFocusMode"
      />

      <!-- 训练主视图 -->
      <TrainingBoard
        v-if="annotationView === 'train'"
        :dataset-state="datasetState"
        :train-task="trainTask"
        :training="training"
        :can-write="canWrite"
        :boxes="boxes"
        @set-annotation-view="(view) => annotationView = view"
      />
    </div>
  </section>

  <!-- 专注模式弹窗 -->
  <FocusOverlay
    v-if="focusMode && imageUrl"
    :dataset-state="datasetState"
    :selected-class="selectedClass"
    :custom-class="customClass"
    :boxes="boxes"
    :selected-index="selectedIndex"
    :selected-box="selectedBox"
    :image-url="imageUrl"
    :image-meta="imageMeta"
    :draft-box="draftBox"
    :saving="saving"
    :can-operate="canOperate"
    :can-write="canWrite"
    :recognition-payload="recognitionPayload"
    :image-file="imageFile"
    :selected-class-advice="selectedClassAdvice"
    @handle-selected-class-change="handleSelectedClassChange"
    @handle-add-class="handleAddClass"
    @handle-import-detections="handleImportDetections"
    @handle-delete-selected-box="handleDeleteSelectedBox"
    @handle-save-annotations="handleSaveAnnotations"
    @handle-pointer-down="handlePointerDown"
    @handle-pointer-move="handlePointerMove"
    @set-selected-index="setSelectedIndex"
    @set-focus-mode="setFocusMode"
    @update:custom-class="customClass = $event"
    @handle-image-upload="() => imageInputRef?.click()"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  addAnnotationClass,
  augmentAnnotationDataset,
  createAnnotationDataset,
  deleteAnnotationClass,
  deleteAnnotationDataset,
  downloadAnnotationSourceImage,
  downloadAnnotationDataset,
  fetchAnnotationClasses,
  fetchModels,
  fetchAnnotationSourceImageDetail,
  importAnnotationDatasetFolder,
  fetchTrainingTask,
  saveAnnotationFile,
  startTrainingTask,
  uploadAnnotationSourceImages,
} from '@/lib/plantApi'
import { saveBlobAsFile } from '@/lib/download'
import { validateImageFile } from '@/lib/imageFiles'
import { getDiseaseInfo } from '@/lib/plantPresentation'

// 导入子组件（需要单独创建）
import DatasetControls from './components/DatasetControls.vue'
import DatasetSetupFlow from './components/DatasetSetupFlow.vue'
import AnnotateControls from './components/AnnotateControls.vue'
import TrainingControls from './components/TrainingControls.vue'
import DatasetBoard from './components/DatasetBoard.vue'
import AnnotateBoard from './components/AnnotateBoard.vue'
import TrainingBoard from './components/TrainingBoard.vue'
import FocusOverlay from './components/FocusOverlay.vue'

const props = defineProps({
  token: {
    type: String,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  },
  recognitionPayload: {
    type: Object,
    default: null
  }
})

// 工具函数
const revokeUrl = (url) => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

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

const toFixedBox = (box) => {
  return {
    label: box.label,
    x1: Number(box.x1.toFixed(2)),
    y1: Number(box.y1.toFixed(2)),
    x2: Number(box.x2.toFixed(2)),
    y2: Number(box.y2.toFixed(2)),
    source: box.source || "manual",
  }
}

const getDatasetMeta = (datasetItems, datasetName, fallback = {}) => {
  return datasetItems.find((item) => item.name === datasetName) || {
    name: datasetName || "",
    is_public: Boolean(fallback.selected_dataset_is_public),
    is_official: Boolean(fallback.selected_dataset_is_official),
    can_write: Boolean(fallback.selected_dataset_can_write),
    owner_username: String(fallback.selected_dataset_owner_username || ""),
    owner_display_name: String(fallback.selected_dataset_owner_display_name || ""),
  }
}

const boxContainsPoint = (box, x, y) => {
  return x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2
}

const readPoint = (event, frameElement, imageMeta) => {
  if (!frameElement || !imageMeta.width || !imageMeta.height) {
    return null
  }
  const rect = frameElement.getBoundingClientRect()
  const xRatio = (event.clientX - rect.left) / rect.width
  const yRatio = (event.clientY - rect.top) / rect.height
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
    return null
  }
  return {
    x: xRatio * imageMeta.width,
    y: yRatio * imageMeta.height,
  }
}

const getTemplateLabel = (templates, key) => {
  if (!key) return "未匹配"
  if (key === "custom") return "自定义类别库"
  return templates.find((item) => item.key === key)?.label || key
}

const getDatasetOwnerLabel = (datasetMeta) => {
  if (!datasetMeta) return "未分配"
  return datasetMeta.owner_display_name || datasetMeta.owner_username || (datasetMeta.is_official ? "官方资源" : "当前用户")
}

const createInitialDatasetState = () => ({
  loading: false,
  datasetItems: [],
  selectedDataset: "",
  classes: [],
  classTemplates: [],
  selectedTemplateKey: "",
  classAdvices: [],
  datasetMeta: null,
  sourceImages: [],
  counts: { source: 0, annotated: 0, train: 0, val: 0 },
  hint: "",
})

// Refs
const imageInputRef = ref(null)
const sourceFolderInputRef = ref(null)
const datasetFolderImportInputRef = ref(null)
const activeTaskRef = ref("")
const pendingBoxSelectionRef = ref("")
const pendingAdviceClassNames = ref([])
const pendingAdvicePollAttempt = ref(0)
let bootstrapCancelled = false
let pendingAdvicePollTimer = 0

const PENDING_ADVICE_POLL_INTERVAL_MS = 2500
const PENDING_ADVICE_POLL_MAX_ATTEMPTS = 24

// 状态
const datasetState = ref(createInitialDatasetState())
const models = ref([])
const selectedClass = ref("")
const imageFile = ref(null)
const imageUrl = ref("")
const imageMeta = ref({ width: 0, height: 0 })
const boxes = ref([])
const draftBox = ref(null)
const selectedIndex = ref(-1)
const selectedSourceImageName = ref("")
const status = ref("登录后即可在这里管理数据集、框选标注并发起训练任务。")
const error = ref("")
const saving = ref(false)
const uploadingSourceImages = ref(false)
const loadingSourceImageName = ref("")
const importingDatasetFolder = ref(false)
const augmenting = ref(false)
const training = ref(false)
const datasetCreateName = ref("")
const datasetPublic = ref(false)
const datasetCreateMode = ref("template")
const datasetTemplateKey = ref("blank")
const datasetImportName = ref("")
const datasetImportPublic = ref(false)
const datasetImportFiles = ref([])
const datasetImportRelativePaths = ref([])
const datasetImportFolderLabel = ref("")
const customClass = ref("")
const augmentCopies = ref(2)
const augmentTrainRatio = ref(0.8)
const augmentSeed = ref(42)
const focusMode = ref(false)
const annotationView = ref( props.recognitionPayload?.file ? "annotate" : "dataset")
const datasetSetupPanel = ref("dataset")
const trainForm = ref({
  baseModel: "yolov8n.pt",
  modelName: "",
  epochs: 50,
  imgsz: 640,
})
const trainTask = ref(null)

// 计算属性
const canOperate = computed(() => Boolean(props.isAuthenticated && props.token))
const canWrite = computed(() => Boolean(datasetState.value.datasetMeta?.can_write))

const boxStyle = (box, imageMeta) => {
  if (!imageMeta.width || !imageMeta.height) return null
  return {
    left: `${(box.x1 / imageMeta.width) * 100}%`,
    top: `${(box.y1 / imageMeta.height) * 100}%`,
    width: `${((box.x2 - box.x1) / imageMeta.width) * 100}%`,
    height: `${((box.y2 - box.y1) / imageMeta.height) * 100}%`,
  }
}

const nextPendingSourceImage = computed(() => {
  if (!datasetState.value.sourceImages.length) return null
  const ordered = datasetState.value.sourceImages
  const currentIndex = ordered.findIndex((item) => item.name === selectedSourceImageName.value)
  if (currentIndex >= 0) {
    for (let index = currentIndex + 1; index < ordered.length; index += 1) {
      if (!ordered[index].has_annotation) return ordered[index]
    }
  }
  return ordered.find((item) => !item.has_annotation) || null
})

const selectedClassAdvice = computed(() => {
  const currentClass = selectedClass.value
  if (!currentClass) return null

  const matchedAdvice = datasetState.value.classAdvices.find((item) => item.class_name === currentClass)
  if (matchedAdvice) return matchedAdvice

  if (datasetState.value.classes.includes(currentClass)) {
    return {
      class_name: currentClass,
      summary: `正在为 ${currentClass} 生成防治建议，你可以继续新增类别或进行标注，不需要停在这里等待。`,
      advice: [
        "当前类别已经写入数据集。",
        "后台正在调用大模型生成针对这个类别的防治建议。",
        "建议生成完成后，这里会自动刷新为正式内容。",
      ],
      source: 'generating',
      detail: '知识库建议生成中',
      generated_at: null,
    }
  }

  const fallbackInfo = getDiseaseInfo(currentClass)
  return {
    class_name: currentClass,
    summary: fallbackInfo.summary,
    advice: Array.isArray(fallbackInfo.advice) ? fallbackInfo.advice : [],
    source: 'builtin',
    detail: null,
    generated_at: null,
  }
})

const selectedBox = computed(() => 
  selectedIndex.value >= 0 ? boxes.value[selectedIndex.value] || null : null
)

const selectedDatasetTemplateLabel = computed(() => 
  getTemplateLabel(datasetState.value.classTemplates, datasetState.value.selectedTemplateKey)
)

const createTemplate = computed(() => 
  datasetState.value.classTemplates.find((item) => item.key === datasetTemplateKey.value) || null
)

const visibleTemplateCards = computed(() => 
  datasetState.value.classTemplates.filter((item) => item.key !== "universal" || item.class_count > 0)
)

const datasetSetupPanels = computed(() => [
  {
    id: "dataset",
    eyebrow: "01 Dataset",
    label: "数据集准备",
  },
  {
    id: "classes",
    eyebrow: "02 Classes",
    label: "类别库与建议",
  },
  {
    id: "create",
    eyebrow: "03 Create",
    label: "新建数据集",
  },
  {
    id: "import",
    eyebrow: "04 Import",
    label: "导入现成数据集",
  },
])

const annotationViewTabs = computed(() => [
  { id: "dataset", label: "数据集准备", summary: datasetState.value.selectedDataset || "先选数据集" },
  { id: "annotate", label: "标注", summary: imageFile.value?.name || (boxes.value.length ? `${boxes.value.length} 个框` : "导入图片开始框选") },
  { id: "train", label: "训练", summary: trainTask.value?.status || (training.value ? "训练中" : "增强并启动训练") },
])

const currentAnnotationTab = computed(() => 
  annotationViewTabs.value.find((item) => item.id === annotationView.value) || annotationViewTabs.value[0]
)

const chooseWritableDatasetName = (data) => {
  const datasetItems = Array.isArray(data?.available_dataset_items) ? data.available_dataset_items : []
  return datasetItems.find((item) => item?.can_write)?.name || ""
}

const buildAutoDatasetName = () => `workspace_${Date.now()}`

// 应用标注数据
const applyAnnotationPayload = (data) => {
  const datasetItems = Array.isArray(data.available_dataset_items) && data.available_dataset_items.length
    ? data.available_dataset_items
    : (data.available_datasets || []).map((name) => ({ name }))
  const selectedDataset = data.selected_dataset || datasetItems[0]?.name || ""
  const classes = Array.isArray(data.classes) ? data.classes : []
  const classTemplates = Array.isArray(data.class_templates) ? data.class_templates : []
  const classAdvices = Array.isArray(data.class_advices) ? data.class_advices : []
  const sourceImages = Array.isArray(data.source_images) ? data.source_images : []
  const datasetMeta = selectedDataset ? getDatasetMeta(datasetItems, selectedDataset, data) : null
  const selectedTemplateKey = data.selected_dataset_template_key || ""
  
  datasetState.value = {
    loading: false,
    datasetItems,
    selectedDataset,
    classes,
    classTemplates,
    selectedTemplateKey,
    classAdvices,
    datasetMeta,
    sourceImages,
    counts: {
      source: Number(data.source_image_count) || 0,
      annotated: Number(data.annotated_source_count ?? data.source_pair_count) || 0,
      train: Number(data.train_pair_count) || 0,
      val: Number(data.val_pair_count) || 0,
    },
    hint: selectedDataset
      ? `数据集 ${selectedDataset} ｜ 原始图片 ${Number(data.source_image_count) || 0} ｜ 已标注 ${Number(data.annotated_source_count ?? data.source_pair_count) || 0} ｜ train ${Number(data.train_pair_count) || 0} ｜ val ${Number(data.val_pair_count) || 0}`
      : "当前没有可访问数据集。",
  }
  
  // 更新模板key
  if (datasetTemplateKey.value && classTemplates.some((item) => item.key === datasetTemplateKey.value)) {
    // 保持当前选择
  } else if (selectedTemplateKey && classTemplates.some((item) => item.key === selectedTemplateKey)) {
    datasetTemplateKey.value = selectedTemplateKey
  } else {
    datasetTemplateKey.value = classTemplates.find((item) => item.key === "corn")?.key
      || classTemplates.find((item) => item.key === "blank")?.key
      || classTemplates[0]?.key
      || ""
  }
  
  // 更新选中类别
  if (!classes.includes(selectedClass.value) && classes[0]) {
    selectedClass.value = classes[0]
  }
}

// 重新加载标注数据
const reloadAnnotationData = async (datasetName = datasetState.value.selectedDataset) => {
  if (!props.token) return
  datasetState.value.loading = true
  try {
    error.value = ""
    let payload = await fetchAnnotationClasses(props.token, datasetName)
    let payloadData = payload?.data || {}

    if (!datasetName && payloadData && !payloadData.selected_dataset_can_write) {
      const writableDatasetName = chooseWritableDatasetName(payloadData)
      if (writableDatasetName && writableDatasetName !== payloadData.selected_dataset) {
        payload = await fetchAnnotationClasses(props.token, writableDatasetName)
        payloadData = payload?.data || {}
        status.value = `已自动切换到可写数据集：${writableDatasetName}`
      }
    }

    applyAnnotationPayload(payloadData)
  } catch (err) {
    error.value = err.message || "标注数据加载失败。"
  } finally {
    datasetState.value.loading = false
  }
}

const stopPendingAdvicePolling = () => {
  if (pendingAdvicePollTimer) {
    clearTimeout(pendingAdvicePollTimer)
    pendingAdvicePollTimer = 0
  }
}

const hasAdviceForClass = (payloadData, className) => {
  const advices = Array.isArray(payloadData?.class_advices) ? payloadData.class_advices : []
  return advices.some((item) => item?.class_name === className)
}

const schedulePendingAdvicePolling = () => {
  stopPendingAdvicePolling()
  if (!props.token || !datasetState.value.selectedDataset || !pendingAdviceClassNames.value.length) {
    return
  }
  if (pendingAdvicePollAttempt.value >= PENDING_ADVICE_POLL_MAX_ATTEMPTS) {
    return
  }

  pendingAdvicePollTimer = window.setTimeout(async () => {
    const datasetName = datasetState.value.selectedDataset
    if (!props.token || !datasetName || !pendingAdviceClassNames.value.length) {
      stopPendingAdvicePolling()
      return
    }

    try {
      const payload = await fetchAnnotationClasses(props.token, datasetName)
      const payloadData = payload?.data || {}
      applyAnnotationPayload(payloadData)

      const resolvedNames = pendingAdviceClassNames.value.filter((className) => hasAdviceForClass(payloadData, className))
      pendingAdviceClassNames.value = pendingAdviceClassNames.value.filter((className) => !resolvedNames.includes(className))
      pendingAdvicePollAttempt.value += 1

      if (resolvedNames.length) {
        status.value = `类别 ${resolvedNames.join("、")} 的建议已生成。`
      }
    } catch {
      pendingAdvicePollAttempt.value += 1
    }

    if (pendingAdviceClassNames.value.length && pendingAdvicePollAttempt.value < PENDING_ADVICE_POLL_MAX_ATTEMPTS) {
      schedulePendingAdvicePolling()
    } else {
      stopPendingAdvicePolling()
    }
  }, PENDING_ADVICE_POLL_INTERVAL_MS)
}

const queuePendingAdviceGeneration = (classNames) => {
  const nextNames = Array.isArray(classNames)
    ? classNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [String(classNames || "").trim()].filter(Boolean)
  if (!nextNames.length) return

  pendingAdviceClassNames.value = Array.from(new Set([
    ...pendingAdviceClassNames.value,
    ...nextNames,
  ]))
  pendingAdvicePollAttempt.value = 0
  schedulePendingAdvicePolling()
}

const resetAnnotationCanvas = () => {
  if (imageUrl.value) {
    revokeUrl(imageUrl.value)
  }
  imageFile.value = null
  imageUrl.value = ""
  imageMeta.value = { width: 0, height: 0 }
  boxes.value = []
  draftBox.value = null
  selectedIndex.value = -1
  selectedSourceImageName.value = ""
  focusMode.value = false
}

const loadImageMeta = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  image.onload = () => {
    const meta = {
      width: image.naturalWidth || image.width || 0,
      height: image.naturalHeight || image.height || 0,
    }
    URL.revokeObjectURL(objectUrl)
    resolve(meta)
  }

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    reject(new Error("图片尺寸读取失败。"))
  }

  image.src = objectUrl
})

watch(() => imageUrl.value, (nextUrl, previousUrl) => {
  if (previousUrl) {
    revokeUrl(previousUrl)
  }
  if (!nextUrl) {
    focusMode.value = false
  }
})

watch(() => datasetState.value.selectedDataset, (current, previous) => {
  if (previous && previous !== current) {
    stopPendingAdvicePolling()
    pendingAdviceClassNames.value = []
    pendingAdvicePollAttempt.value = 0
    resetAnnotationCanvas()
  }
  if (!current) {
    stopPendingAdvicePolling()
    pendingAdviceClassNames.value = []
    pendingAdvicePollAttempt.value = 0
    resetAnnotationCanvas()
  }
})

watch(() => boxes.value.length, () => {
  if (pendingBoxSelectionRef.value === "last") {
    pendingBoxSelectionRef.value = ""
    selectedIndex.value = boxes.value.length ? boxes.value.length - 1 : -1
  }
  if (selectedIndex.value >= boxes.value.length) {
    selectedIndex.value = boxes.value.length ? boxes.value.length - 1 : -1
  }
})

watch(() => focusMode.value, (nextFocus, _previousFocus, onCleanup) => {
  if (!nextFocus) return

  const previousOverflow = document.body.style.overflow
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      focusMode.value = false
    }
  }

  document.body.style.overflow = "hidden"
  window.addEventListener("keydown", handleKeyDown)

  onCleanup(() => {
    document.body.style.overflow = previousOverflow
    window.removeEventListener("keydown", handleKeyDown)
  })
})

onMounted(() => {
  if (!props.isAuthenticated || !props.token) return

  bootstrapCancelled = false
  datasetState.value.loading = true

  const bootstrap = async () => {
    try {
      const [classesPayload, modelsPayload] = await Promise.all([
        fetchAnnotationClasses(props.token),
        fetchModels(props.token),
      ])
      if (bootstrapCancelled) return

      let annotationData = classesPayload?.data || {}
      const writableDatasetName = chooseWritableDatasetName(annotationData)

      if (!writableDatasetName) {
        const createdPayload = await createAnnotationDataset(props.token, {
          dataset_name: buildAutoDatasetName(),
          is_public: false,
          class_template_key: "blank",
        })
        if (bootstrapCancelled) return
        annotationData = createdPayload?.data || {}
        status.value = createdPayload?.message || `已自动创建可写数据集：${annotationData.selected_dataset || ""}`
      } else if (!annotationData.selected_dataset_can_write && writableDatasetName !== annotationData.selected_dataset) {
        const writablePayload = await fetchAnnotationClasses(props.token, writableDatasetName)
        if (bootstrapCancelled) return
        annotationData = writablePayload?.data || {}
        status.value = `已自动切换到可写数据集：${writableDatasetName}`
      }

      applyAnnotationPayload(annotationData)

      const availableModels = Array.isArray(modelsPayload?.data?.available_models) ? modelsPayload.data.available_models : []
      models.value = availableModels
      if (availableModels.length && !trainForm.value.baseModel) {
        trainForm.value.baseModel = availableModels[0]
      }
    } catch (err) {
      if (!bootstrapCancelled) {
        error.value = err.message || "标注数据初始化失败。"
      }
    } finally {
      if (!bootstrapCancelled) {
        datasetState.value.loading = false
      }
    }
  }

  bootstrap()
})

onUnmounted(() => {
  bootstrapCancelled = true
  stopPendingAdvicePolling()
  if (imageUrl.value) {
    revokeUrl(imageUrl.value)
  }
})

// 轮询训练任务
watch([() => trainTask.value?.task_id, training], ([taskId, isTraining], _previous, onCleanup) => {
  if (!taskId || !isTraining) return
  
  let cancelled = false
  const poll = async () => {
    try {
      const payload = await fetchTrainingTask(props.token, taskId)
      if (cancelled || activeTaskRef.value !== taskId) return
      
      const nextTask = payload?.data || null
      trainTask.value = nextTask
      
      if (nextTask?.status === "completed") {
        training.value = false
        status.value = `训练完成：${nextTask?.result?.model_name || "新模型"} 已生成。`
        const availableModels = Array.isArray(nextTask?.result?.available_models) ? nextTask.result.available_models : []
        if (availableModels.length) {
          models.value = availableModels
        }
        return
      }
      if (nextTask?.status === "failed") {
        training.value = false
        error.value = nextTask?.error || nextTask?.message || "训练失败。"
        return
      }
      setTimeout(poll, 2000)
    } catch (err) {
      if (!cancelled) {
        error.value = err.message || "训练进度获取失败。"
        training.value = false
      }
    }
  }
  
  const timer = setTimeout(poll, 2000)
  onCleanup(() => {
    cancelled = true
    clearTimeout(timer)
  })
})

// 方法实现（与React版本逻辑相同，但使用Vue的响应式）
const setImageFromFile = async (file, nextStatus, { nextBoxes = [], sourceImageName = "" } = {}) => {
  const nextMeta = await loadImageMeta(file)
  const nextUrl = URL.createObjectURL(file)
  imageFile.value = file
  imageMeta.value = nextMeta
  imageUrl.value = nextUrl
  boxes.value = nextBoxes.map((item) => toFixedBox(normalizeBox(item)))
  draftBox.value = null
  selectedIndex.value = -1
  selectedSourceImageName.value = sourceImageName
  annotationView.value = "annotate"
  status.value = nextStatus
  error.value = ""
}

const handleImageChange = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  
  const validationError = validateImageFile(file)
  if (validationError) {
    error.value = validationError
    event.target.value = ""
    return
  }
  
  try {
    await setImageFromFile(file, `已载入图片 ${file.name}，现在可以开始框选标注。`)
  } catch (err) {
    error.value = err.message || "图片载入失败。"
  }
  event.target.value = ""
}

const handleSourceFolderUpload = async (event) => {
  const files = Array.from(event.target.files || [])
  if (!files.length || !datasetState.value.selectedDataset) {
    event.target.value = ""
    return
  }
  
  for (const file of files) {
    const validationError = validateImageFile(file)
    if (validationError) {
      error.value = `${file.name}：${validationError}`
      event.target.value = ""
      return
    }
  }
  
  try {
    uploadingSourceImages.value = true
    error.value = ""
    const payload = await uploadAnnotationSourceImages(props.token, {
      datasetName: datasetState.value.selectedDataset,
      files,
    })
    applyAnnotationPayload(payload?.data || {})
    status.value = payload?.message || `已导入 ${files.length} 张图片。`
    annotationView.value = "annotate"
  } catch (err) {
    error.value = err.message || "批量导入原始图片失败。"
  } finally {
    uploadingSourceImages.value = false
    event.target.value = ""
  }
}

const openSourceFolderPicker = () => {
  sourceFolderInputRef.value?.click()
}

const openDatasetFolderImportPicker = () => {
  datasetFolderImportInputRef.value?.click()
}

const handleDatasetFolderImportSelection = (event) => {
  const files = Array.from(event.target.files || [])
  datasetImportFiles.value = files
  datasetImportRelativePaths.value = files.map((file) => file.webkitRelativePath || file.name || "")

  const firstRelativePath = datasetImportRelativePaths.value[0] || ""
  const folderName = firstRelativePath.split(/[\\/]/)[0] || ""
  datasetImportFolderLabel.value = folderName || (files[0]?.name || "")

  if (!datasetImportName.value.trim() && folderName) {
    datasetImportName.value = folderName
  }
}

const handleDatasetCreate = async () => {
  const datasetName = datasetCreateName.value.trim()
  if (!datasetName) {
    error.value = "请先填写数据集名称。"
    return
  }

  if (datasetCreateMode.value === "clone" && !datasetState.value.selectedDataset) {
    error.value = "复制模式需要先选择一个现有数据集。"
    return
  }

  try {
    error.value = ""
    const payload = await createAnnotationDataset(props.token, {
      dataset_name: datasetName,
      is_public: Boolean(datasetPublic.value),
      source_dataset: datasetCreateMode.value === "clone" ? datasetState.value.selectedDataset : undefined,
      class_template_key: datasetCreateMode.value === "template" ? (datasetTemplateKey.value || "blank") : undefined,
    })
    applyAnnotationPayload(payload?.data || {})
    datasetCreateName.value = ""
    datasetPublic.value = false
    datasetSetupPanel.value = "dataset"
    annotationView.value = "dataset"
    status.value = payload?.message || `数据集 ${datasetName} 已创建并切换。`
  } catch (err) {
    error.value = err.message || "数据集创建失败。"
  }
}

const handleDatasetDelete = async () => {
  const datasetName = datasetState.value.selectedDataset
  if (!datasetName) {
    error.value = "请先选择一个数据集。"
    return
  }

  try {
    error.value = ""
    const payload = await deleteAnnotationDataset(props.token, datasetName)
    resetAnnotationCanvas()
    applyAnnotationPayload(payload?.data || {})
    annotationView.value = "dataset"
    status.value = payload?.message || `数据集 ${datasetName} 已删除。`
  } catch (err) {
    error.value = err.message || "删除数据集失败。"
  }
}

const handleDatasetDownload = async () => {
  const datasetName = datasetState.value.selectedDataset
  if (!datasetName) {
    error.value = "请先选择一个数据集。"
    return
  }

  try {
    error.value = ""
    const blob = await downloadAnnotationDataset(props.token, datasetName)
    saveBlobAsFile(blob, `${datasetName}_dataset.zip`)
    status.value = `数据集 ${datasetName} 已开始下载。`
  } catch (err) {
    error.value = err.message || "下载数据集失败。"
  }
}

const handleAddClass = async () => {
  const className = customClass.value.trim()
  if (!datasetState.value.selectedDataset) {
    error.value = "请先选择数据集。"
    return
  }
  if (!className) {
    error.value = "请先输入要新增的类别名称。"
    return
  }

  try {
    error.value = ""
    const payload = await addAnnotationClass(props.token, datasetState.value.selectedDataset, className)
    applyAnnotationPayload(payload?.data || {})
    selectedClass.value = className
    queuePendingAdviceGeneration(className)
    customClass.value = ""
    status.value = payload?.message || `类别 ${className} 已添加，建议正在后台生成。`
  } catch (err) {
    error.value = err.message || "添加类别失败。"
  }
}

const handleDeleteClass = async () => {
  const datasetName = datasetState.value.selectedDataset
  const className = selectedClass.value
  if (!datasetName || !className) {
    error.value = "请先选择要删除的类别。"
    return
  }

  try {
    error.value = ""
    const payload = await deleteAnnotationClass(props.token, datasetName, className)
    applyAnnotationPayload(payload?.data || {})
    pendingAdviceClassNames.value = pendingAdviceClassNames.value.filter((item) => item !== className)
    status.value = payload?.message || `类别 ${className} 已删除。`
  } catch (err) {
    error.value = err.message || "删除类别失败。"
  }
}

const handleDatasetFolderImport = async () => {
  if (!datasetImportFiles.value.length) {
    error.value = "请先选择一个本地数据集目录。"
    return
  }

  try {
    importingDatasetFolder.value = true
    error.value = ""
    const payload = await importAnnotationDatasetFolder(props.token, {
      datasetName: datasetImportName.value.trim(),
      isPublic: datasetImportPublic.value,
      files: datasetImportFiles.value,
      relativePaths: datasetImportRelativePaths.value,
    })
    applyAnnotationPayload(payload?.data || {})
    datasetImportFiles.value = []
    datasetImportRelativePaths.value = []
    datasetImportFolderLabel.value = ""
    datasetImportName.value = ""
    datasetImportPublic.value = false
    datasetSetupPanel.value = "dataset"
    annotationView.value = "dataset"
    status.value = payload?.message || "本地数据集导入完成。"
  } catch (err) {
    error.value = err.message || "导入本地数据集失败。"
  } finally {
    importingDatasetFolder.value = false
    if (datasetFolderImportInputRef.value) {
      datasetFolderImportInputRef.value.value = ""
    }
  }
}

const loadDatasetSourceImage = async (imageName) => {
  if (!props.token || !datasetState.value.selectedDataset || !imageName) return

  try {
    loadingSourceImageName.value = imageName
    error.value = ""
    const [detailPayload, blob] = await Promise.all([
      fetchAnnotationSourceImageDetail(props.token, datasetState.value.selectedDataset, imageName),
      downloadAnnotationSourceImage(props.token, datasetState.value.selectedDataset, imageName),
    ])
    const file = new File([blob], imageName, { type: blob.type || "image/jpeg" })
    const annotations = Array.isArray(detailPayload?.data?.annotations) ? detailPayload.data.annotations : []
    await setImageFromFile(
      file,
      `已载入数据集原图 ${imageName}，可继续补充或修正标注。`,
      { nextBoxes: annotations, sourceImageName: imageName },
    )
  } catch (err) {
    error.value = err.message || `载入原始图片 ${imageName} 失败。`
  } finally {
    loadingSourceImageName.value = ""
  }
}

const handleUseRecognitionImage = async () => {
  const file = props.recognitionPayload?.file
  if (!file) {
    error.value = "当前没有可接力的识别图片。"
    return
  }

  try {
    await setImageFromFile(file, `已接收识别工作台图片 ${file.name}，可直接开始标注。`)
  } catch (err) {
    error.value = err.message || "识别图片载入失败。"
  }
}

const handleLoadNextPendingSourceImage = async () => {
  if (!nextPendingSourceImage.value?.name) {
    error.value = "当前没有未标注的原始图片。"
    return
  }
  await loadDatasetSourceImage(nextPendingSourceImage.value.name)
}

const handleImportDetections = () => {
  const detections = Array.isArray(props.recognitionPayload?.result?.detections)
    ? props.recognitionPayload.result.detections
    : []

  if (!detections.length || !datasetState.value.classes.length) {
    error.value = "当前没有可导入的识别框。"
    return
  }

  const importedBoxes = detections
    .filter((item) => Array.isArray(item?.bbox) && item.bbox.length === 4 && datasetState.value.classes.includes(item.label))
    .map((item) => normalizeBox({
      label: item.label,
      x1: Number(item.bbox[0]),
      y1: Number(item.bbox[1]),
      x2: Number(item.bbox[2]),
      y2: Number(item.bbox[3]),
      source: "assist",
    }))
    .filter(Boolean)

  if (!importedBoxes.length) {
    error.value = "识别结果中的类别与当前数据集不匹配，请先补充类别后再导入。"
    return
  }

  pendingBoxSelectionRef.value = "last"
  boxes.value = boxes.value.concat(importedBoxes)
  draftBox.value = null
  status.value = `已导入 ${importedBoxes.length} 个识别框，请复核后保存。`
  error.value = ""
}

const handleClearBoxes = () => {
  pendingBoxSelectionRef.value = ""
  boxes.value = []
  draftBox.value = null
  selectedIndex.value = -1
  status.value = "当前图片上的标注框已清空。"
  error.value = ""
}

const handleDeleteSelectedBox = () => {
  if (selectedIndex.value < 0) return
  boxes.value = boxes.value.filter((_, index) => index !== selectedIndex.value)
  selectedIndex.value = -1
  status.value = "已删除当前选中的标注框。"
}

const handleSaveAnnotations = async () => {
  if (!datasetState.value.selectedDataset) {
    error.value = "请先选择数据集。"
    return
  }
  if (!canWrite.value) {
    error.value = "当前数据集是只读的，无法保存图片和标注。请切换到可写数据集。"
    return
  }
  if (!imageFile.value) {
    error.value = "请先载入一张待标注图片。"
    return
  }
  if (!boxes.value.length) {
    error.value = "当前没有可保存的标注框。"
    return
  }

  try {
    saving.value = true
    error.value = ""
    const annotations = boxes.value.map((item) => toFixedBox(normalizeBox(item)))
    const payload = await saveAnnotationFile(props.token, {
      file: selectedSourceImageName.value ? null : imageFile.value,
      datasetName: datasetState.value.selectedDataset,
      annotations,
      sourceFilename: selectedSourceImageName.value || "",
    })
    await reloadAnnotationData(datasetState.value.selectedDataset)
    if (!selectedSourceImageName.value && payload?.data?.filename) {
      selectedSourceImageName.value = payload.data.filename
    }
    status.value = payload?.message || `标注已保存：${payload?.data?.filename || imageFile.value.name}`
  } catch (err) {
    error.value = err.message || "保存标注失败。"
  } finally {
    saving.value = false
  }
}

const handleAugment = async () => {
  if (!datasetState.value.selectedDataset) {
    error.value = "请先选择一个数据集。"
    return
  }

  const copies = Math.max(1, Number.parseInt(augmentCopies.value, 10) || 1)
  const trainRatio = Number.parseFloat(augmentTrainRatio.value)
  const seed = Number.parseInt(augmentSeed.value, 10)

  try {
    augmenting.value = true
    error.value = ""
    const payload = await augmentAnnotationDataset(props.token, {
      dataset_name: datasetState.value.selectedDataset,
      copies,
      train_ratio: Number.isFinite(trainRatio) ? Math.min(0.95, Math.max(0.1, trainRatio)) : 0.8,
      seed: Number.isFinite(seed) ? seed : 42,
    })
    await reloadAnnotationData(datasetState.value.selectedDataset)
    annotationView.value = "train"
    status.value = payload?.message || `增强完成：新增 ${payload?.data?.augmented_count || 0} 张样本。`
  } catch (err) {
    error.value = err.message || "数据增强失败。"
  } finally {
    augmenting.value = false
  }
}

const handleTrain = async () => {
  if (!datasetState.value.selectedDataset) {
    error.value = "请先选择一个数据集。"
    return
  }
  if (!datasetState.value.classes.length) {
    error.value = "当前数据集没有类别，无法启动训练。"
    return
  }

  try {
    training.value = true
    error.value = ""
    annotationView.value = "train"
    const payload = await startTrainingTask(props.token, {
      dataset_name: datasetState.value.selectedDataset,
      base_model: String(trainForm.value.baseModel || "").trim(),
      model_name: String(trainForm.value.modelName || "").trim() || undefined,
      epochs: Math.max(1, Number.parseInt(trainForm.value.epochs, 10) || 1),
      imgsz: Math.max(32, Number.parseInt(trainForm.value.imgsz, 10) || 640),
    })
    trainTask.value = payload?.data || null
    activeTaskRef.value = payload?.data?.task_id || ""
    status.value = payload?.message || "训练任务已启动。"
  } catch (err) {
    training.value = false
    error.value = err.message || "启动训练失败。"
  }
}

// 暴露给子组件的方法
const handleSelectedClassChange = (nextClass) => {
  selectedClass.value = nextClass
  if (selectedIndex.value >= 0) {
    boxes.value = boxes.value.map((item, index) => 
      index === selectedIndex.value ? { ...item, label: nextClass } : item
    )
  }
}

const resolvePointerContext = (payload) => {
  if (payload?.event) {
    return {
      event: payload.event,
      frameElement: payload.frameElement || null,
    }
  }
  return {
    event: payload,
    frameElement: null,
  }
}

const handlePointerDown = (payload) => {
  if (!imageMeta.value.width || !imageMeta.value.height || !selectedClass.value) return

  const { event, frameElement } = resolvePointerContext(payload)
  const point = readPoint(event, frameElement || frameRef.value, imageMeta.value)
  if (!point) return

  if (draftBox.value) {
    const normalized = normalizeBox({
      ...draftBox.value,
      x2: point.x,
      y2: point.y,
    })
    draftBox.value = null

    if (normalized.x2 - normalized.x1 < 4 || normalized.y2 - normalized.y1 < 4) return

    pendingBoxSelectionRef.value = "last"
    boxes.value = [...boxes.value, normalized]
    return
  }
  
  for (let i = boxes.value.length - 1; i >= 0; i--) {
    if (boxContainsPoint(boxes.value[i], point.x, point.y)) {
      selectedIndex.value = i
      selectedClass.value = boxes.value[i].label
      return
    }
  }
  
  selectedIndex.value = -1
  draftBox.value = {
    label: selectedClass.value,
    x1: point.x,
    y1: point.y,
    x2: point.x,
    y2: point.y,
    source: "manual",
  }
}

const handlePointerMove = (payload) => {
  if (!draftBox.value) return

  const { event, frameElement } = resolvePointerContext(payload)
  const point = readPoint(event, frameElement || frameRef.value, imageMeta.value)
  if (!point) return
  
  draftBox.value = { ...draftBox.value, x2: point.x, y2: point.y }
}

const setSelectedIndex = (index) => {
  selectedIndex.value = index
  if (index >= 0 && boxes.value[index]?.label) {
    selectedClass.value = boxes.value[index].label
  }
}

const setFocusMode = (mode) => {
  focusMode.value = Boolean(mode && imageUrl.value)
}


</script>

<style scoped>
.annotation-dataset-stage {
  display: grid;
  gap: 16px;
  align-content: start;
}
</style>
