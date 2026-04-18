<!--训练与标注-->
<template>
  <div class="annotation-page">
    <section class="panel right-column">
      <div class="head-row annotation-head">
        <div>
          <h3>图片标注</h3>
          <p>支持画框、保存 YOLO 标注、清空当前图像、导入识别框、加载下一张未标注图。</p>
        </div>
        <div class="inline-actions">
          <button class="soft-btn" type="button" @click="triggerUpload" :disabled="!selectedDataset || uploadingImages">
            {{ uploadingImages ? '上传中...' : '上传图片' }}
          </button>
          <button class="soft-btn" type="button" @click="loadNextUnannotated" :disabled="!selectedDataset || !images.length">下一张未标注</button>
        </div>
      </div>

      <div class="toolbar">
        <select v-model="currentImageName" @change="loadImageDetail">
          <option value="">请选择图片</option>
          <option v-for="image in selectableImages" :key="image.name" :value="image.name">{{ image.name }}</option>
        </select>
        <select v-model="currentClass">
          <option value="">请选择类别</option>
          <option v-for="item in classes" :key="item.name" :value="item.name">{{ item.name }}</option>
        </select>
        <button class="soft-btn" type="button" @click="importFromRecognition" :disabled="!selectedDataset || !currentImageName || importRecognizing">
          {{ importRecognizing ? '识别中...' : '导入识别框' }}
        </button>
      </div>

      <input ref="imageUploadInput" class="hidden-input" type="file" accept="image/*" multiple @change="uploadImages" />
      <div class="canvas-shell" ref="canvasShell">
        <canvas ref="canvasRef" @mousedown="startDraw" @mousemove="onDrawing" @mouseup="endDraw"></canvas>
      </div>

      <div class="annotation-actions">
        <button class="primary-btn" type="button" @click="saveAnnotation" :disabled="!selectedDataset || !currentImageName || savingAnnotation">
          {{ savingAnnotation ? '保存中...' : '保存标注' }}
        </button>
        <button class="soft-btn" type="button" @click="clearBoxes" :disabled="!boxes.length">清空当前框</button>
        <button class="danger-btn" type="button" @click="deleteCurrentImage" :disabled="!selectedDataset || !currentImageName || deletingImage">
          {{ deletingImage ? '删除中...' : '删除图片' }}
        </button>
      </div>

      <article class="annotation-ai-card">
        <div class="mini-head">
          <h4>AI 识别建议</h4>
          <button class="soft-btn" type="button" @click="refreshCurrentImageAdvice" :disabled="!currentImageUrl || annotationAdviceLoading">
            {{ annotationAdviceLoading ? '识别中...' : '刷新建议' }}
          </button>
        </div>
        <p>{{ annotationAdviceText }}</p>
      </article>

      <p v-if="message" class="message">{{ message }}</p>
      <p v-if="error" class="message error">{{ error }}</p>
    </section>

    <div class="left-wrapper">
      <section class="panel">
        <div class="head-row">
          <div>
            <h3>增强与训练</h3>
            <p>支持增强配置、训练参数设置、异步训练任务轮询和结果刷新。</p>
          </div>
        </div>

        <label>
          <span>增强副本数量 {{ augmentCount }}</span>
          <input v-model.number="augmentCount" type="range" min="1" max="10" step="1" />
        </label>
        <label>
          <span>训练集比例 {{ (trainRatio * 100).toFixed(0) }}%</span>
          <input v-model.number="trainRatio" type="range" min="0.5" max="0.95" step="0.05" />
        </label>
        <button class="soft-btn" type="button" @click="runAugmentation" :disabled="!selectedDataset || augmenting || training">
          {{ augmenting ? '增强中...' : '执行数据增强' }}
        </button>

        <label>
          <span>基础模型</span>
          <select v-model="trainBaseModel">
            <option v-for="model in trainingBaseModels" :key="model.name" :value="model.name">{{ model.label }}</option>
          </select>
        </label>
        <label>
          <span>输出模型名称</span>
          <input v-model.trim="outputModelName" type="text" placeholder="例如 rice-finetune-v1" />
        </label>
        <div class="dual-row">
          <label>
            <span>Epochs</span>
            <input v-model.number="epochs" type="number" min="10" max="300" />
          </label>
          <label>
            <span>Imgsz</span>
            <input v-model.number="imgsz" type="number" min="320" max="1280" step="32" />
          </label>
        </div>
        <button class="primary-btn" type="button" @click="startTraining" :disabled="!selectedDataset || training || augmenting">
          {{ training ? '训练中...' : '启动异步训练' }}
        </button>

        <article class="training-box" v-if="trainingStatus">
          <strong>{{ trainingStatus.status === 'completed' ? '训练完成' : (trainingStatus.status === 'failed' ? '训练失败' : '训练进行中') }}</strong>
          <span>Epoch {{ trainingStatus.current_epoch }}/{{ trainingStatus.total_epochs || epochs }}</span>
          <span>Loss {{ trainingStatus.loss }}</span>
          <span>mAP {{ trainingStatus.map }}</span>
          <ul>
            <li v-for="line in trainingStatus.logs" :key="line">{{ line }}</li>
          </ul>
        </article>
      </section>

      <section v-if="showImageBrowser" class="panel image-browser-panel">
        <div class="head-row">
          <div>
            <h3>数据集图片</h3>
            <p>{{ selectedDataset || '未选择数据集' }} · 共 {{ images.length }} 张图片</p>
          </div>
          <button class="soft-btn" type="button" @click="closeImageBrowser">返回</button>
        </div>

        <div v-if="images.length" class="image-browser-list">
          <article v-for="image in images" :key="image.name" class="image-browser-item">
            <div>
              <strong>{{ image.name }}</strong>
              <span>{{ image.has_annotation ? `已有 ${image.annotation_count || 0} 个标注框` : '未标注' }}</span>
            </div>
            <div class="inline-actions">
              <button class="soft-btn" type="button" @click="continueAnnotating(image.name)">继续标注</button>
              <button class="danger-btn" type="button" @click="deleteImageFromBrowser(image.name)">删除图片</button>
            </div>
          </article>
        </div>
        <p v-else class="message">当前数据集还没有保存到后台的图片。</p>
      </section>

      <div v-else class="dataset-class-grid">
        <section class="panel dataset-panel">
          <div class="head-row">
            <div>
              <h3>数据集与类别</h3>
            </div>
            <button class="primary-btn" type="button" @click="toggleDatasetForm">{{ showDatasetForm ? '收起' : '新建数据集' }}</button>
          </div>

        <form v-if="showDatasetForm" class="dataset-form" @submit.prevent="createDataset">
          <input v-model.trim="datasetForm.name" type="text" placeholder="数据集名称" />
          <input v-model.trim="datasetForm.description" type="text" placeholder="数据集描述" />
          <select v-model="datasetForm.template">
            <option v-for="template in classTemplates" :key="template.key" :value="template.key">
              {{ template.label }}（{{ template.class_count }} 类）
            </option>
          </select>
          <label class="check-line">
            <input v-model="datasetForm.isPublic" type="checkbox" />
            <span>公开数据集</span>
          </label>
          <button class="primary-btn" type="submit" :disabled="creatingDataset">
            {{ creatingDataset ? '创建中...' : '确认创建' }}
          </button>
          <p v-if="datasetFormMessage" class="message">{{ datasetFormMessage }}</p>
          <p v-if="datasetFormError" class="message error">{{ datasetFormError }}</p>
        </form>

        <div v-if="!showDatasetForm" class="dataset-list">
          <article v-for="dataset in datasets" :key="dataset.name" class="dataset-card" :class="{ active: dataset.name === selectedDataset }">
            <button class="dataset-main" type="button" @click="selectDataset(dataset.name)">
              <strong>{{ dataset.name }}</strong>
              <span>{{ dataset.description }}</span>
              <small
                class="dataset-image-link"
                role="button"
                tabindex="0"
                @click.stop="openImageBrowser(dataset.name)"
                @keydown.enter.stop.prevent="openImageBrowser(dataset.name)"
              >
                {{ dataset.image_count }} 张图片 · {{ dataset.is_public ? '公开' : '私有' }}
              </small>
            </button>
            <div class="inline-actions">
              <button class="soft-btn" type="button" @click="downloadDataset(dataset.name)">下载</button>
              <button class="danger-btn" type="button" @click="deleteDataset(dataset.name)">删除</button>
            </div>
          </article>
        </div>

        </section>

        <section v-if="selectedDataset" class="panel class-panel">
          <div class="mini-head">
            <h4>类别管理</h4>
            <button class="soft-btn" type="button" @click="showClassForm = !showClassForm">{{ showClassForm ? '收起' : '新增类别' }}</button>
          </div>
          <form v-if="showClassForm" class="class-form" @submit.prevent="addClass">
            <input v-model.trim="classForm.name" type="text" placeholder="类别名称" />
            <textarea v-model.trim="classForm.suggestion" rows="3" placeholder="类别知识建议，可留空自动生成"></textarea>
            <button class="primary-btn" type="submit">确认新增</button>
          </form>
          <div class="class-carousel" v-if="!showClassForm">
            <div class="carousel-page" v-for="(page, pageIndex) in classPages" :key="pageIndex" v-show="currentPage === pageIndex">
              <div class="class-item" v-for="item in page" :key="item.name">
                <div>
                  <strong>{{ item.name }}</strong>
                </div>
                <button class="danger-btn" type="button" @click="deleteClass(item.name)">删除</button>
              </div>
            </div>
          </div>
          <div class="carousel-controls" v-if="!showClassForm && classPages.length > 1">
            <button class="soft-btn" type="button" @click="currentPage = Math.max(0, currentPage - 1)" :disabled="currentPage === 0">上一页</button>
            <span class="page-indicator">{{ currentPage + 1 }} / {{ classPages.length }}</span>
            <button class="soft-btn" type="button" @click="currentPage = Math.min(classPages.length - 1, currentPage + 1)" :disabled="currentPage === classPages.length - 1">下一页</button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { annotationApi, modelApi, predictApi } from '@/api'

const canvasRef = ref(null)
const canvasShell = ref(null)
const imageUploadInput = ref(null)

const datasets = ref([])
const classes = ref([])
const images = ref([])
const models = ref([])
const trainingBaseModels = ref([])
const classTemplates = ref([{ key: 'blank', label: '空白模板', class_count: 0, description: '', classes: [] }])

const selectedDataset = ref('')
const currentImageName = ref('')
const currentImageUrl = ref('')
const currentClass = ref('')
const boxes = ref([])
const selectedBoxIndex = ref(-1)
const annotationAdvice = ref('')
const annotationAdviceLoading = ref(false)
const pendingImageFile = ref(null)

const showDatasetForm = ref(false)
const showClassForm = ref(false)
const showImageBrowser = ref(false)
const message = ref('')
const error = ref('')
const datasetFormMessage = ref('')
const datasetFormError = ref('')
const creatingDataset = ref(false)
const augmenting = ref(false)
const uploadingImages = ref(false)
const importRecognizing = ref(false)
const savingAnnotation = ref(false)
const deletingImage = ref(false)

const datasetForm = reactive({ name: '', description: '', template: 'blank', isPublic: false })
const classForm = reactive({ name: '', suggestion: '' })

const augmentCount = ref(3)
const trainRatio = ref(0.8)
const trainBaseModel = ref('')
const outputModelName = ref('')
const epochs = ref(80)
const imgsz = ref(640)
const training = ref(false)
const trainingStatus = ref(null)

let drawing = null
let pollTimer = null
let annotationAdviceSeq = 0

const annotationAdviceText = computed(() => {
  if (annotationAdviceLoading.value) return 'AI 正在识别当前图片并生成建议...'
  if (annotationAdvice.value) return annotationAdvice.value
  if (selectedAnnotationBox.value) return '已选中标注框，点击“刷新建议”可生成该病害建议。'
  return currentImageUrl.value
    ? '点击“刷新建议”可根据当前图片生成防治建议。'
    : '选择或上传图片后，这里会显示 AI 识别建议。'
})

const selectedAnnotationBox = computed(() => {
  const box = boxes.value[selectedBoxIndex.value]
  return box && Array.isArray(box.bbox) ? box : null
})

const currentPage = ref(0)
const classPageSize = 2

const classPages = computed(() => {
  const pages = []
  for (let i = 0; i < classes.value.length; i += classPageSize) {
    pages.push(classes.value.slice(i, i + classPageSize))
  }
  return pages
})

const selectableImages = computed(() => {
  if (!pendingImageFile.value || !currentImageName.value || images.value.some((image) => image.name === currentImageName.value)) {
    return images.value
  }
  return [
    { name: currentImageName.value, has_annotation: boxes.value.length > 0, annotation_count: boxes.value.length },
    ...images.value
  ]
})

const toggleDatasetForm = () => {
  showDatasetForm.value = !showDatasetForm.value
  if (showDatasetForm.value) {
    selectedDataset.value = ''
    classes.value = []
    images.value = []
    currentPage.value = 0
  }
}

const loadBase = async () => {
  try {
    // 分离调用，避免一个失败影响其他
    const [datasetRes, modelRes] = await Promise.all([
      annotationApi.getDatasets(),
      modelApi.getList()
    ])
    
    console.log('Dataset response:', datasetRes)
    console.log('Datasets:', datasetRes.datasets)
    console.log('Class templates:', datasetRes.class_templates)
    
    datasets.value = datasetRes.datasets || []
    classTemplates.value = datasetRes.class_templates?.length ? datasetRes.class_templates : classTemplates.value
    if (!classTemplates.value.some((template) => template.key === datasetForm.template)) {
      datasetForm.template = classTemplates.value[0]?.key || 'blank'
    }
    models.value = modelRes.models || []
    
    // 单独加载训练模型列表，失败不影响其他数据
    try {
      const trainingModelsRes = await modelApi.getTrainingBaseModels()
      trainingBaseModels.value = trainingModelsRes.models || []
      trainBaseModel.value = trainingModelsRes.default_model || trainingBaseModels.value[0]?.name || 'yolov8n.pt'
    } catch (trainError) {
      console.warn('Failed to load training base models, using default:', trainError)
      // 使用默认值
      trainingBaseModels.value = [
        { name: 'yolov8n.pt', label: 'YOLOv8 Nano (默认)' },
        { name: 'yolov8s.pt', label: 'YOLOv8 Small' },
        { name: 'yolov8m.pt', label: 'YOLOv8 Medium' }
      ]
      trainBaseModel.value = 'yolov8n.pt'
    }
  } catch (error) {
    console.error('Failed to load base data:', error)
    error.value = error.message || '加载数据失败'
  }
}

const selectDataset = async (name) => {
  selectedDataset.value = name
  await Promise.all([loadClasses(), pendingImageFile.value ? loadImageList() : loadImages()])
}

const loadClasses = async () => {
  const result = await annotationApi.getClasses(selectedDataset.value)
  classes.value = result.classes || []
  currentClass.value = classes.value[0]?.name || ''
}

const resetCurrentImage = () => {
  currentImageName.value = ''
  currentImageUrl.value = ''
  boxes.value = []
  selectedBoxIndex.value = -1
  annotationAdvice.value = ''
  annotationAdviceLoading.value = false
  pendingImageFile.value = null
  clearCanvas()
}

const loadImageList = async () => {
  const result = await annotationApi.getImages(selectedDataset.value)
  images.value = result.images || []
}

const loadImages = async (preferredImageName = '') => {
  await loadImageList()
  currentImageName.value = images.value.find((image) => image.name === preferredImageName)?.name || images.value[0]?.name || ''
  pendingImageFile.value = null
  if (currentImageName.value) await loadImageDetail()
  else resetCurrentImage()
}

const clearCanvas = () => {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
}

const dataUrlToFile = (dataUrl, filename) => {
  const [header, payload] = dataUrl.split(',')
  const mime = header?.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
  const binary = atob(payload || '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], filename || 'captured-image.jpg', { type: mime })
}

const imageUrlToFile = async (imageUrl, filename) => {
  if (imageUrl.startsWith('data:')) return dataUrlToFile(imageUrl, filename)
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('图片读取失败。')
  const blob = await response.blob()
  return new File([blob], filename || 'annotation-image.jpg', { type: blob.type || 'image/jpeg' })
}

const refreshSelectedBoxAdvice = async () => {
  const selectedBox = selectedAnnotationBox.value
  if (!selectedBox) return
  const className = selectedBox.class_name || selectedBox.label || currentClass.value
  if (!className) {
    annotationAdvice.value = '当前标注框没有类别，暂时无法生成病害建议。'
    return
  }

  const requestId = ++annotationAdviceSeq
  annotationAdviceLoading.value = true
  annotationAdvice.value = ''
  try {
    const recommendation = await predictApi.getRecommendation([
      {
        class_name: className,
        confidence: Number.isFinite(Number(selectedBox.confidence)) ? Number(selectedBox.confidence) : 1,
        bbox: selectedBox.bbox || null
      }
    ], selectedDataset.value)
    if (requestId === annotationAdviceSeq) {
      annotationAdvice.value = recommendation.suggestion || '暂无该病害的防治建议。'
    }
  } catch (err) {
    if (requestId === annotationAdviceSeq) {
      annotationAdvice.value = err.message || 'AI 建议生成失败，请稍后重试。'
    }
  } finally {
    if (requestId === annotationAdviceSeq) {
      annotationAdviceLoading.value = false
    }
  }
}

const refreshCurrentImageAdvice = async () => {
  if (selectedAnnotationBox.value) {
    await refreshSelectedBoxAdvice()
    return
  }
  if (!currentImageUrl.value || annotationAdviceLoading.value) return
  const requestId = ++annotationAdviceSeq
  annotationAdviceLoading.value = true
  annotationAdvice.value = ''
  try {
    const file = pendingImageFile.value && currentImageName.value === pendingImageFile.value.name
      ? pendingImageFile.value
      : await imageUrlToFile(currentImageUrl.value, currentImageName.value)
    const result = await predictApi.recognize(file, null, 0.5, {
      mode: 'single',
      datasetContext: selectedDataset.value
    })
    let suggestion = result.suggestion
    const targets = (result.detections?.length ? result.detections : result.top_predictions) || []
    if (!suggestion && targets.length) {
      const recommendation = await predictApi.getRecommendation(targets, selectedDataset.value)
      suggestion = recommendation.suggestion
    }
    if (requestId === annotationAdviceSeq) {
      annotationAdvice.value = suggestion || '未检测到明确病害目标，暂无防治建议。'
    }
  } catch (err) {
    if (requestId === annotationAdviceSeq) {
      annotationAdvice.value = err.message || 'AI 建议生成失败，请稍后重试。'
    }
  } finally {
    if (requestId === annotationAdviceSeq) {
      annotationAdviceLoading.value = false
    }
  }
}

const applyPendingAnnotation = async (parsed) => {
  if (!parsed?.imageDataUrl) return false
  const importedBoxes = (parsed.detections || []).filter((item) => Array.isArray(item.bbox) && item.bbox.length >= 4)
  currentImageName.value = parsed.previewName || 'captured-image.jpg'
  currentImageUrl.value = parsed.imageDataUrl
  pendingImageFile.value = dataUrlToFile(parsed.imageDataUrl, currentImageName.value)
  selectedBoxIndex.value = -1
  boxes.value = importedBoxes.map((item) => ({
    bbox: item.bbox.map(Number),
    class_name: item.class_name || item.label,
    confidence: item.confidence,
    source: item.source || 'recognition'
  }))
  await redrawCanvas()
  refreshCurrentImageAdvice()
  message.value = boxes.value.length
    ? '已载入实时识别截图和识别框，请选择数据集后保存标注。'
    : '已载入实时识别截图，请选择类别后进行标注。'
  return true
}

const ensureBoxClasses = async () => {
  if (!selectedDataset.value || !boxes.value.length) return
  const missingClasses = [...new Set(boxes.value.map((item) => item.class_name).filter(Boolean))]
    .filter((name) => !classes.value.some((item) => item.name === name))
  for (const className of missingClasses) {
    await annotationApi.addClass(selectedDataset.value, className)
  }
  if (missingClasses.length) await loadClasses()
  currentClass.value = boxes.value.find((item) => item.class_name)?.class_name || classes.value[0]?.name || currentClass.value
}

const loadImageDetail = async () => {
  if (!selectedDataset.value || !currentImageName.value) return
  selectedBoxIndex.value = -1
  annotationAdvice.value = ''
  if (pendingImageFile.value && currentImageUrl.value && currentImageName.value === pendingImageFile.value.name) {
    await redrawCanvas()
    refreshCurrentImageAdvice()
    return
  }
  try {
    pendingImageFile.value = null
    currentImageUrl.value = ''
    const result = await annotationApi.getImageDetail(selectedDataset.value, currentImageName.value)
    currentImageUrl.value = result.image_url
    boxes.value = result.annotations || []
    selectedBoxIndex.value = -1
    await redrawCanvas()
    refreshCurrentImageAdvice()
  } catch (err) {
    resetCurrentImage()
    throw err
  }
}

const redrawCanvas = async () => {
  if (!canvasRef.value || !currentImageUrl.value) return
  const image = new Image()
  image.src = currentImageUrl.value
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('图片加载失败。'))
  })
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  canvas.width = image.width
  canvas.height = image.height
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  boxes.value.forEach((item, index) => {
    if (!Array.isArray(item.bbox) || item.bbox.length < 4) return
    const [x1, y1, x2, y2] = item.bbox.map(Number)
    if (![x1, y1, x2, y2].every(Number.isFinite)) return

    const boxWidth = x2 - x1
    const boxHeight = y2 - y1
    const radius = 12

    const isSelected = index === selectedBoxIndex.value

    ctx.strokeStyle = 'rgba(255, 252, 240, 0.96)'
    ctx.lineWidth = isSelected ? 18 : 14
    ctx.beginPath()
    ctx.roundRect(x1, y1, boxWidth, boxHeight, radius)
    ctx.stroke()

    ctx.strokeStyle = isSelected ? 'rgba(255, 238, 118, 0.98)' : 'rgba(206, 244, 126, 0.98)'
    ctx.lineWidth = isSelected ? 11 : 8
    ctx.beginPath()
    ctx.roundRect(x1, y1, boxWidth, boxHeight, radius)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 252, 240, 0.96)'
    ctx.font = 'bold 40px Trebuchet MS, sans-serif'
    const confidence = Number(item.confidence)
    const text = Number.isFinite(confidence)
      ? `${item.class_name} ${(confidence * 100).toFixed(1)}%`
      : item.class_name
    const textWidth = ctx.measureText(text).width
    const labelHeight = 66
    const labelY = Math.max(0, y1 - labelHeight)
    const labelRadius = 10

    ctx.beginPath()
    ctx.roundRect(x1, labelY, textWidth + 36, labelHeight, labelRadius)
    ctx.fill()

    ctx.strokeStyle = 'rgba(7, 36, 22, 0.9)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.roundRect(x1, labelY, textWidth + 36, labelHeight, labelRadius)
    ctx.stroke()

    ctx.fillStyle = '#072416'
    ctx.fillText(text, x1 + 18, labelY + 46)
  })
}

const pointOf = (event) => {
  if (!canvasRef.value || !canvasRef.value.width || !canvasRef.value.height) return null
  const rect = canvasRef.value.getBoundingClientRect()
  const scaleX = canvasRef.value.width / rect.width
  const scaleY = canvasRef.value.height / rect.height
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
}

const findBoxIndexAtPoint = (point) => {
  for (let index = boxes.value.length - 1; index >= 0; index -= 1) {
    const box = boxes.value[index]
    if (!Array.isArray(box.bbox) || box.bbox.length < 4) continue
    const [rawX1, rawY1, rawX2, rawY2] = box.bbox.map(Number)
    if (![rawX1, rawY1, rawX2, rawY2].every(Number.isFinite)) continue
    const x1 = Math.min(rawX1, rawX2)
    const y1 = Math.min(rawY1, rawY2)
    const x2 = Math.max(rawX1, rawX2)
    const y2 = Math.max(rawY1, rawY2)
    if (point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2) return index
  }
  return -1
}

const selectAnnotationBox = async (index) => {
  selectedBoxIndex.value = index
  annotationAdvice.value = ''
  await redrawCanvas()
  await refreshSelectedBoxAdvice()
}

const startDraw = (event) => {
  if (!currentImageName.value) {
    error.value = '请先选择图片。'
    return
  }
  const point = pointOf(event)
  if (!point) return

  const hitIndex = findBoxIndexAtPoint(point)
  if (hitIndex >= 0) {
    drawing = null
    selectAnnotationBox(hitIndex)
    return
  }

  if (!currentClass.value) {
    error.value = '请先选择类别。'
    return
  }
  selectedBoxIndex.value = -1
  annotationAdvice.value = ''
  const { x, y } = point
  drawing = { x1: x, y1: y, x2: x, y2: y }
}

const onDrawing = async (event) => {
  if (!drawing) return
  const point = pointOf(event)
  if (!point) return
  const { x, y } = point
  drawing.x2 = x
  drawing.y2 = y
  await redrawCanvas()
  const ctx = canvasRef.value.getContext('2d')
  ctx.setLineDash([8, 6])
  ctx.strokeStyle = '#072416'
  ctx.lineWidth = 2
  ctx.strokeRect(drawing.x1, drawing.y1, drawing.x2 - drawing.x1, drawing.y2 - drawing.y1)
  ctx.setLineDash([])
}

const endDraw = async () => {
  if (!drawing) return
  const x1 = Math.min(drawing.x1, drawing.x2)
  const y1 = Math.min(drawing.y1, drawing.y2)
  const x2 = Math.max(drawing.x1, drawing.x2)
  const y2 = Math.max(drawing.y1, drawing.y2)
  if (x2 - x1 > 8 && y2 - y1 > 8) boxes.value.push({ bbox: [x1, y1, x2, y2], class_name: currentClass.value })
  drawing = null
  await redrawCanvas()
}

const createDataset = async () => {
  datasetFormMessage.value = ''
  datasetFormError.value = ''
  error.value = ''

  if (!datasetForm.name) {
    datasetFormError.value = '请先填写数据集名称。'
    return
  }

  creatingDataset.value = true
  try {
    await annotationApi.createDataset(datasetForm.name, datasetForm.description, datasetForm.isPublic, datasetForm.template)
    message.value = '数据集创建成功。'
    datasetFormMessage.value = '数据集创建成功。'
    Object.assign(datasetForm, { name: '', description: '', template: 'blank', isPublic: false })
    showDatasetForm.value = false
    await loadBase()
    selectedDataset.value = ''
    classes.value = []
    currentPage.value = 0
  } catch (err) {
    error.value = err.message || '创建失败。'
    datasetFormError.value = error.value
  } finally {
    creatingDataset.value = false
  }
}

const addClass = async () => {
  try {
    await annotationApi.addClass(selectedDataset.value, classForm.name, classForm.suggestion)
    message.value = '类别新增成功。'
    Object.assign(classForm, { name: '', suggestion: '' })
    // Don't close the form, just reload classes and hide all items
    await loadClasses()
    showClassForm.value = true
    // Hide all class items when adding a new class
    classes.value = []
  } catch (err) {
    error.value = err.message || '新增类别失败。'
  }
}

const deleteClass = async (name) => {
  await annotationApi.deleteClass(selectedDataset.value, name)
  message.value = `已删除类别：${name}`
  await loadClasses()
  await loadImageDetail()
}

const triggerUpload = () => {
  if (!selectedDataset.value) {
    error.value = '请先选择数据集。'
    return
  }
  if (imageUploadInput.value) imageUploadInput.value.value = ''
  imageUploadInput.value?.click()
}

const uploadImages = async (event) => {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  if (!selectedDataset.value) {
    error.value = '请先选择数据集。'
    return
  }

  uploadingImages.value = true
  error.value = ''
  try {
    await annotationApi.uploadImages(selectedDataset.value, files)
    message.value = `已上传 ${files.length} 张图片。`
    // 重新加载图片列表
    await loadImageList()
    // 实时更新数据集图片数量
    const dataset = datasets.value.find((d) => d.name === selectedDataset.value)
    if (dataset) {
      dataset.image_count = images.value.length
    }
    // 重置图片选择
    resetCurrentImage()
    if (images.value.length) {
      currentImageName.value = images.value[0]?.name || ''
      if (currentImageName.value) await loadImageDetail()
    }
  } catch (err) {
    error.value = err.message || '上传图片失败。'
  } finally {
    uploadingImages.value = false
  }
}

const saveAnnotation = async () => {
  if (!selectedDataset.value || !currentImageName.value) {
    error.value = '请先选择数据集和图片。'
    return
  }

  savingAnnotation.value = true
  error.value = ''
  try {
    const savedImageName = currentImageName.value
    await annotationApi.saveAnnotation(selectedDataset.value, currentImageName.value, boxes.value, pendingImageFile.value)
    pendingImageFile.value = null
    message.value = boxes.value.length ? '当前图片标注已保存。' : '当前图片标注已清空并保存。'
    await loadImages()
    if (images.value.some((image) => image.name === savedImageName)) {
      currentImageName.value = savedImageName
      await loadImageDetail()
    }
  } catch (err) {
    error.value = err.message || '保存失败。'
  } finally {
    savingAnnotation.value = false
  }
}

const clearBoxes = async () => {
  boxes.value = []
  selectedBoxIndex.value = -1
  annotationAdvice.value = ''
  await redrawCanvas()
  message.value = '当前框已清空，点击“保存标注”后会同步到后端。'
}

const deleteCurrentImage = async () => {
  if (!selectedDataset.value || !currentImageName.value) {
    error.value = '请先选择要删除的图片。'
    return
  }

  const imageName = currentImageName.value
  const deletedIndex = images.value.findIndex((image) => image.name === imageName)
  if (!window.confirm(`确定要删除图片"${imageName}"及对应标注吗？此操作不可撤回。`)) return

  deletingImage.value = true
  error.value = ''
  try {
    await annotationApi.deleteImage(selectedDataset.value, imageName)
    message.value = `已删除图片：${imageName}`
    // 重新加载图片列表
    await loadImageList()
    // 实时更新数据集图片数量
    const dataset = datasets.value.find((d) => d.name === selectedDataset.value)
    if (dataset) {
      dataset.image_count = images.value.length
    }
    const nextImage = images.value[deletedIndex]?.name || images.value[deletedIndex - 1]?.name || ''
    if (nextImage) {
      currentImageName.value = nextImage
      await loadImageDetail()
    } else {
      resetCurrentImage()
    }
  } catch (err) {
    error.value = err.message || '删除图片失败。'
  } finally {
    deletingImage.value = false
  }
}

const importFromRecognitionLegacy = async () => {
  if (!selectedDataset.value || !currentImageName.value) {
    error.value = '请先选择要导入识别框的图片。'
    return
  }
  const stored = sessionStorage.getItem('pendingAnnotation')
  if (!stored) {
    error.value = '当前没有待导入的识别框。'
    return
  }

  try {
    const parsed = JSON.parse(stored)
    const importedBoxes = (parsed.detections || []).filter((item) => Array.isArray(item.bbox) && item.bbox.length >= 4)
    if (!importedBoxes.length) {
      error.value = '识别结果中没有可导入的检测框。'
      return
    }

    boxes.value = importedBoxes.map((item) => ({
      bbox: item.bbox.map(Number),
      class_name: item.class_name || item.label,
      confidence: item.confidence,
      source: item.source || 'recognition'
    }))
    selectedBoxIndex.value = -1
    annotationAdvice.value = ''
    const beforeClassCount = classes.value.length
    await ensureBoxClasses()
    const addedClassCount = Math.max(0, classes.value.length - beforeClassCount)
    message.value = addedClassCount
      ? `识别框已导入，并自动补充 ${addedClassCount} 个类别。`
      : '识别框已导入当前图片，可继续微调后保存。'
    await redrawCanvas()
  } catch (err) {
    error.value = err.message || '导入识别框失败。'
  }
}

const importFromRecognition = async () => {
  if (!selectedDataset.value || !currentImageName.value) {
    error.value = '请先选择要自动识别的图片。'
    return
  }
  if (!currentImageUrl.value) {
    error.value = '请先加载要自动识别的图片。'
    return
  }

  importRecognizing.value = true
  error.value = ''
  message.value = '正在自动识别当前图片并导入识别框...'
  try {
    const file = pendingImageFile.value && currentImageName.value === pendingImageFile.value.name
      ? pendingImageFile.value
      : await imageUrlToFile(currentImageUrl.value, currentImageName.value)
    const result = await predictApi.recognize(file, null, 0.5, {
      mode: 'single',
      datasetContext: selectedDataset.value
    })
    const importedBoxes = (result.detections || []).filter((item) => Array.isArray(item.bbox) && item.bbox.length >= 4)
    if (!importedBoxes.length) {
      error.value = '当前图片暂未识别到可导入的病害框。'
      message.value = ''
      return
    }

    boxes.value = importedBoxes.map((item) => ({
      bbox: item.bbox.map(Number),
      class_name: item.class_name || item.label,
      confidence: item.confidence,
      source: item.source || 'recognition'
    }))
    selectedBoxIndex.value = -1
    annotationAdvice.value = ''
    const beforeClassCount = classes.value.length
    await ensureBoxClasses()
    const addedClassCount = Math.max(0, classes.value.length - beforeClassCount)
    selectedBoxIndex.value = boxes.value.length ? 0 : -1
    message.value = addedClassCount
      ? `已自动识别并导入 ${boxes.value.length} 个病害框，并补充 ${addedClassCount} 个类别。`
      : `已自动识别并导入 ${boxes.value.length} 个病害框。`
    await redrawCanvas()
    if (selectedBoxIndex.value >= 0) {
      await refreshSelectedBoxAdvice()
    }
  } catch (err) {
    error.value = err.message || '自动识别并导入框失败。'
    message.value = ''
  } finally {
    importRecognizing.value = false
  }
}

const loadNextUnannotated = async () => {
  if (!selectedDataset.value) {
    error.value = '请先选择数据集。'
    return
  }
  if (!images.value.length) {
    error.value = '当前数据集还没有图片。'
    return
  }

  try {
    for (const image of images.value) {
      const detail = await annotationApi.getImageDetail(selectedDataset.value, image.name)
      if (!detail.annotations?.length) {
        currentImageName.value = image.name
        await loadImageDetail()
        message.value = `已跳转到未标注图片：${image.name}`
        return
      }
    }
    message.value = '当前数据集图片都已经有标注。'
  } catch (err) {
    error.value = err.message || '加载下一张未标注图片失败。'
  }
}

const downloadDataset = (name) => annotationApi.downloadDataset(name)

const deleteDataset = async (name) => {
  await annotationApi.deleteDataset(name)
  if (selectedDataset.value === name) {
    selectedDataset.value = ''
    classes.value = []
    images.value = []
    currentImageName.value = ''
    currentImageUrl.value = ''
    boxes.value = []
  }
  message.value = `已删除数据集：${name}`
  await loadBase()
}

const runAugmentationLegacy = async () => {
  const result = await annotationApi.augment(selectedDataset.value, augmentCount.value, trainRatio.value)
  message.value = result.summary
}

const startTrainingLegacy = async () => {
  training.value = true
  const result = await modelApi.train(selectedDataset.value, trainBaseModel.value, epochs.value, imgsz.value, outputModelName.value)
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    const status = await modelApi.getTaskStatus(result.task_id)
    trainingStatus.value = status
    if (status.status === 'completed') {
      training.value = false
      clearInterval(pollTimer)
      await loadBase()
      message.value = '训练完成，可前往模型资产中心查看新模型。'
    }
  }, 1400)
}

const runAugmentation = async () => {
  if (!selectedDataset.value || augmenting.value) return
  augmenting.value = true
  error.value = ''
  message.value = '正在执行数据增强，请稍候...'
  try {
    const result = await annotationApi.augment(selectedDataset.value, augmentCount.value, trainRatio.value)
    message.value = result.summary
    await loadBase()
    if (selectedDataset.value) await loadImageList()
  } catch (err) {
    error.value = err.message || '数据增强失败。'
    message.value = ''
  } finally {
    augmenting.value = false
  }
}

const stopTrainingPoll = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const startTraining = async () => {
  if (!selectedDataset.value || training.value) return
  training.value = true
  error.value = ''
  message.value = '训练任务正在启动...'
  trainingStatus.value = {
    status: 'queued',
    current_epoch: 0,
    total_epochs: epochs.value,
    loss: 0,
    map: 0,
    logs: ['训练任务正在启动，请稍候。']
  }
  try {
    const result = await modelApi.train(
      selectedDataset.value,
      trainBaseModel.value,
      epochs.value,
      imgsz.value,
      outputModelName.value,
      trainRatio.value
    )
    stopTrainingPoll()
    pollTimer = setInterval(async () => {
      try {
        const status = await modelApi.getTaskStatus(result.task_id)
        trainingStatus.value = status
        if (status.status === 'completed') {
          training.value = false
          stopTrainingPoll()
          await loadBase()
          message.value = '训练完成，可前往模型资产中心查看新模型。'
        } else if (status.status === 'failed') {
          training.value = false
          stopTrainingPoll()
          error.value = status.error || status.message || '训练失败，请查看任务日志。'
        }
      } catch (err) {
        training.value = false
        stopTrainingPoll()
        error.value = err.message || '训练状态刷新失败。'
      }
    }, 1400)
  } catch (err) {
    training.value = false
    stopTrainingPoll()
    error.value = err.message || '训练启动失败。'
    message.value = ''
  }
}

const openImageBrowser = async (datasetName) => {
  selectedDataset.value = datasetName
  await Promise.all([loadClasses(), loadImageList()])
  showImageBrowser.value = true
}

const closeImageBrowser = () => {
  showImageBrowser.value = false
  message.value = ''
  error.value = ''
}

const continueAnnotating = async (imageName) => {
  currentImageName.value = imageName
  await loadImageDetail()
  message.value = `已加载图片：${imageName}，可以继续标注。`
}

const deleteImageFromBrowser = async (imageName) => {
  if (!window.confirm(`确定要删除图片"${imageName}"及对应标注吗？此操作不可撤回。`)) return
  try {
    await annotationApi.deleteImage(selectedDataset.value, imageName)
    message.value = `已删除图片：${imageName}`
    await loadImageList()
    if (currentImageName.value === imageName) {
      resetCurrentImage()
    }
  } catch (err) {
    error.value = err.message || '删除图片失败。'
  }
}

onMounted(async () => {
  await loadBase()
  const pending = sessionStorage.getItem('pendingAnnotation')
  if (!pending) return

  try {
    const parsed = JSON.parse(pending)
    const applied = await applyPendingAnnotation(parsed)
    if (!applied) {
      message.value = '检测到识别结果，可以在选择图片后导入识别框。'
      return
    }

    const defaultDataset = datasets.value.find((dataset) => dataset.can_write) || datasets.value[0]
    if (defaultDataset?.name) {
      selectedDataset.value = defaultDataset.name
      await Promise.all([loadClasses(), loadImageList()])
      await ensureBoxClasses()
      message.value = `已载入实时识别截图和识别框，默认保存到数据集：${defaultDataset.name}。`
    } else {
      message.value = '已载入实时识别截图和识别框，请先新建数据集后保存标注。'
    }
  } catch (err) {
    error.value = err.message || '读取识别截图失败。'
  }
})

onBeforeUnmount(() => {
  stopTrainingPoll()
})
</script>

<style scoped>
.annotation-page {
  display: grid;
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: 16px;
}

.left-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--brand-green-rgb), 0.4) transparent;
}

/* 底部滑动栏样式 */
.left-wrapper::-webkit-scrollbar {
  height: 8px;
}

.left-wrapper::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
}

.left-wrapper::-webkit-scrollbar-thumb {
  background: rgba(var(--brand-green-rgb), 0.4);
  border-radius: 4px;
  transition: background 0.2s;
}

.left-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--brand-green-rgb), 0.6);
}

.dataset-class-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.86fr) minmax(320px, 0.92fr);
  gap: 16px;
  align-items: start;
  min-width: 0;
  justify-content: start;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 25px 18px 18px 18px;
  box-shadow: var(--shadow-soft);
  display: grid;
  gap: 12px;
  align-self: start;
  min-width: 0;
  box-sizing: border-box;
}

.head-row,
.mini-head,
.inline-actions,
.annotation-actions,
.toolbar,
.dual-row {
  display: flex;
  gap: 10px;
}

.head-row,
.mini-head {
  justify-content: space-between;
  align-items: center;
  min-width: 0;
}

.head-row .inline-actions {
  flex: 0 0 auto;
  flex-direction: row;
  align-items: center;
}

.annotation-head {
  flex-direction: column;
  align-items: stretch;
}

.annotation-head .inline-actions {
  width: 100%;
}

.annotation-head .inline-actions .soft-btn {
  flex: 1;
}

.head-row .inline-actions .soft-btn,
.head-row .inline-actions .primary-btn,
.head-row .inline-actions .danger-btn {
  min-width: 118px;
  white-space: nowrap;
}

.head-row > div,
.mini-head > div {
  min-width: 0;
}

.head-row h3,
.mini-head h4 {
  margin: 0;
}

.head-row p,
.dataset-main span,
.dataset-main small,
.class-list span,
.message {
  margin: 0;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.dataset-form,
.class-form {
  display: grid;
  gap: 12px;
}

.dataset-form input:not([type="range"]):not([type="checkbox"]),
.dataset-form select,
.class-form input:not([type="range"]):not([type="checkbox"]),
.class-form textarea,
.toolbar select,
.right-column input:not([type="range"]):not([type="checkbox"]),
.right-column select,
.left-wrapper label input:not([type="range"]):not([type="checkbox"]),
.left-wrapper label select,
.dual-row input:not([type="range"]):not([type="checkbox"]) {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.76);
}


.check-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dataset-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.dataset-card {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.45);
  padding: 14px;
  display: grid;
  gap: 12px;
}

.dataset-card.active {
  background: rgba(255,255,234,0.14);
}

.dataset-main {
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0;
}

.dataset-main strong,
.dataset-main span,
.dataset-main small {
  display: block;
}

.dataset-main span {
  line-height: 1.6;
  margin: 8px 0;
}

.class-list {
  list-style: none;
  padding: 0;
}

.class-carousel {
  display: grid;
  gap: 12px;
}

.carousel-page {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.class-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 18px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.5);
}

.class-item > div {
  min-width: 0;
}

.class-item .danger-btn {
  flex: 0 0 auto;
  min-width: 86px;
  white-space: nowrap;
}

.class-item strong,
.class-item span {
  display: block;
  overflow-wrap: anywhere;
}

.class-item strong {
  font-size: 18px;
}

.carousel-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.page-indicator {
  font-size: 14px;
  color: var(--text-muted);
  min-width: 48px;
  text-align: center;
}

.toolbar {
  flex-wrap: wrap;
}

.toolbar > * {
  flex: 1;
}

.canvas-shell {
  position: relative;
  min-height: 300px;
  border-radius: var(--radius-lg);
  overflow: auto;
  background: rgba(255, 255, 255, 0.42);
}

.canvas-shell canvas {
  display: block;
  width: 100%;
  height: auto;
}

.annotation-ai-card {
  display: grid;
  gap: 8px;
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--border);
}

.annotation-ai-card .mini-head {
  gap: 12px;
}

.annotation-ai-card .mini-head h4 {
  font-size: 18px;
}

.annotation-ai-card .soft-btn {
  min-width: 104px;
  padding: 9px 12px;
}

.annotation-ai-card p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.65;
  max-height: 132px;
  overflow-y: auto;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.training-box {
  display: grid;
  gap: 8px;
  border-radius: var(--radius-lg);
  padding: 16px;
  background: rgba(255, 255, 255, 0.54);
}

.training-box ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
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
  color: rgba(234, 234, 234, 0.9);
  font-weight: 700;
}

.soft-btn {
  background: rgba(255, 255, 255, 0.72);
}

.danger-btn {
  background: rgba(180, 95, 77, 0.1);
  color: rgba(160, 80, 60, 0.88);
}

.soft-btn:disabled,
.danger-btn:disabled {
  color: rgba(56, 56, 56, 0.9);
  opacity: 1;
}
.primary-btn:disabled{
  color: rgba(234, 234, 234, 0.9)
}
.hidden-input {
  display: none;
}

.message.error {
  color: var(--warn);
}

.dataset-image-link {
  cursor: pointer;
  text-decoration: underline;
  color: var(--brand-green);
  transition: color 0.2s;
}

.dataset-image-link:hover {
  color: var(--brand-green-hover, #4caf50);
}

.image-browser-panel {
  margin-top: 8px;
}

.image-browser-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.image-browser-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid var(--border);
  transition: background 0.2s;
}

.image-browser-item:hover {
  background: rgba(255, 255, 255, 0.65);
}

.image-browser-item > div:first-child {
  min-width: 0;
  flex: 1;
}

.image-browser-item strong {
  display: block;
  overflow-wrap: anywhere;
  margin-bottom: 4px;
}

.image-browser-item span {
  display: block;
  color: var(--text-muted);
  font-size: 14px;
}

.image-browser-item .inline-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 8px;
}

@media (max-width: 1200px) {
  .annotation-page {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1100px) {
  .dataset-class-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .head-row,
  .mini-head,
  .annotation-actions,
  .toolbar,
  .dual-row {
    flex-direction: column;
  }

  .head-row .inline-actions {
    width: 100%;
  }

  .head-row .inline-actions .soft-btn,
  .head-row .inline-actions .primary-btn,
  .head-row .inline-actions .danger-btn {
    flex: 1;
    min-width: 0;
  }
}
</style>
