
<!--病害识别模块-->
<template>
  <div v-if="popout" class="popout-page">
    <section class="panel preview-panel">
      <div class="preview-head">
        <div>
          <h3>识别画面</h3>
          <p v-if="popout" style="margin-top: 8px; font-size: 13px;">输入方式：{{ inputMode === 'camera' ? '摄像头' : (inputMode === 'screen' ? '屏幕共享' : '本地图片') }}</p>
          <div class="toggle-row" style="margin-top: 8px;">
            <button class="soft-btn" type="button" @click="toggleHeatmapMode">{{ heatmapMode ? '切回框视图' : '切到热力图' }}</button>
          </div>
        </div>
        <div class="timings">
          <span>推理 {{ timings.inference_ms || 0 }} ms</span>
          <span>建议 {{ timings.recommendation_ms || 0 }} ms</span>
        </div>
      </div>

      <div class="viewer">
        <video v-if="inputMode !== 'upload'" v-show="showVideo" ref="videoRef" autoplay playsinline muted></video>
        <canvas ref="canvasRef" :style="inputMode !== 'upload' ? 'position: absolute; top: 0; left: 0;' : ''"></canvas>
      </div>

      <div v-if="popout && inputMode !== 'upload'" class="stream-actions" style="margin-top: 12px;">
        <button class="primary-btn" type="button" @click="startStream" :disabled="showVideo">
          {{ inputMode === 'camera' ? '连接摄像头' : '开始屏幕共享' }}
        </button>
        <button class="soft-btn" type="button" @click="stopStream" :disabled="!showVideo">停止视频</button>
      </div>

      <div class="result-grid">
        <article class="highlight-card">
          <p>主预测</p>
          <strong>{{ topPrediction?.class_name || '等待识别' }}</strong>
          <span>{{ topPrediction ? `${(topPrediction.confidence * 100).toFixed(1)}%` : '暂无结果' }}</span>
        </article>

        <article class="summary-card">
          <p>Top 预测结果</p>
          <ul>
            <li v-for="item in topPredictions" :key="`${item.class_name}-${item.confidence}`">
              <span>{{ item.class_name }}</span>
              <strong>{{ (item.confidence * 100).toFixed(1) }}%</strong>
            </li>
          </ul>
        </article>
      </div>
    </section>
  </div>

  <div v-else class="page-grid">
    <section class="panel control-panel">
      <div class="section-head">
        <h3>输入与识别控制</h3>
      </div>

      <label>
        <span>输入方式</span>
        <select v-model="inputMode" @change="handleModeChange">
          <option value="upload">本地图片</option>
          <option value="camera">摄像头</option>
          <option value="screen">屏幕共享</option>
        </select>
      </label>

      <input ref="fileInput" class="hidden-input" type="file" accept="image/*" @change="handleUpload" />
      <div
        v-if="inputMode === 'upload'"
        class="dropzone upload-entry"
        @click="fileInput?.click()"
        @dragover.prevent
        @drop.prevent="handleDrop"
      >
        <span class="upload-kicker">图片上传</span>
        <strong>{{ currentFile ? currentFile.name : '点击选择图片' }}</strong>
        <span>{{ currentFile ? '已选择图片，可以直接执行识别。' : '也可以直接拖拽叶片图片到这里进行识别。' }}</span>
      </div>

      <label>
        <span>推理模型</span>
        <select v-model="selectedModel">
          <option v-for="model in models" :key="model.name" :value="model.name">{{ model.name }}</option>
        </select>
      </label>

      <label>
        <span>知识库数据集上下文</span>
        <select v-model="datasetContext">
          <option value="">不使用上下文</option>
          <option v-for="dataset in datasets" :key="dataset.name" :value="dataset.name">{{ dataset.name }}</option>
        </select>
      </label>

      <label>
        <span>置信度阈值 {{ confidence.toFixed(2) }}</span>
        <input v-model.number="confidence" type="range" min="0.2" max="0.95" step="0.05" />
      </label>

      <label>
        <span>实时识别目标 FPS {{ targetFps }}</span>
        <input v-model.number="targetFps" type="range" min="1" max="8" step="1" />
      </label>

      <label>
        <span>实时策略档位</span>
        <select v-model="realtimePolicy">
          <option value="balanced">平衡模式</option>
          <option value="quality">高质量模式</option>
          <option value="fast">高效率模式</option>
        </select>
      </label>

      <div class="toggle-row">
        <button class="soft-btn recognition-action-btn" type="button" @click="toggleHeatmapMode">{{ heatmapMode ? '切回框视图' : '切到热力图' }}</button>
        <button class="soft-btn recognition-action-btn" type="button" @click="toggleRealtimeMode" :disabled="inputMode === 'upload' && !currentFile">
          {{ realtimeMode ? '停止实时识别' : '开始实时识别' }}
        </button>
      </div>

      <div class="toggle-row">
        <button class="soft-btn recognition-action-btn" type="button" @click="toggleRecorder" :disabled="!activeStream">
          {{ recording ? '停止录屏并下载' : '开始录屏' }}
        </button>
        <button class="soft-btn recognition-action-btn" type="button" @click="openPopout">弹出识别小窗</button>
      </div>

      <div v-if="inputMode !== 'upload'" class="stream-actions">
        <button class="primary-btn" type="button" @click="startStream">
          {{ inputMode === 'camera' ? '连接摄像头' : '开始屏幕共享' }}
        </button>
        <button class="soft-btn capture-frame-btn" type="button" @click="captureFrame" :disabled="!activeStream">截取当前画面</button>
      </div>

      <button class="primary-btn wide" type="button" @click="runRecognition" :disabled="realtimeMode || loading || (inputMode === 'upload' && !currentFile)">
        {{ realtimeMode ? '实时识别中...' : (loading ? '识别中...' : '执行单次识别') }}
      </button>

      <p v-if="message" class="message">{{ message }}</p>
      <p v-if="error" class="message error">{{ error }}</p>
    </section>

    <section class="panel preview-panel">
      <div class="preview-head">
        <div>
          <h3>识别画面</h3>
          <p>支持主预测、Top 结果、推理耗时、建议耗时与结果送标注。</p>
        </div>
        <div class="timings">
          <span>推理 {{ timings.inference_ms || 0 }} ms</span>
          <span>建议 {{ timings.recommendation_ms || 0 }} ms</span>
        </div>
      </div>

      <div class="viewer" v-if="inputMode === 'upload'">
        <canvas ref="canvasRef"></canvas>
      </div>
      <div class="viewer" v-else>
        <video v-show="showVideo" ref="videoRef" autoplay playsinline muted></video>
        <canvas ref="canvasRef" style="position: absolute; top: 0; left: 0;"></canvas>
      </div>

      <div class="result-grid">
        <article class="highlight-card">
          <p>主预测</p>
          <strong>{{ topPrediction?.class_name || '等待识别' }}</strong>
          <span>{{ topPrediction ? `${(topPrediction.confidence * 100).toFixed(1)}%` : '暂无结果' }}</span>
        </article>

        <article class="summary-card">
          <p>Top 预测结果</p>
          <ul>
            <li v-for="item in topPredictions" :key="`${item.class_name}-${item.confidence}`">
              <span>{{ item.class_name }}</span>
              <strong>{{ (item.confidence * 100).toFixed(1) }}%</strong>
            </li>
          </ul>
        </article>
      </div>

      <article class="panel inner-panel">
        <div class="inner-head">
          <h4>AI 防治建议</h4>
          <button class="soft-btn annotation-transfer-btn" type="button" @click="sendToAnnotation" :disabled="!detections.length">送去标注工作区</button>
        </div>
        <p>{{ suggestion || '识别完成后会在这里显示病害处理建议。' }}</p>
      </article>
    </section>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { annotationApi, modelApi, predictApi } from '@/api'

const router = useRouter()
const route = useRoute()

const popout = ref(route.query.popout === '1')

const fileInput = ref(null)
const videoRef = ref(null)
const canvasRef = ref(null)

const inputMode = ref('upload')
const selectedModel = ref('')
const datasetContext = ref('')
const confidence = ref(0.55)
const targetFps = ref(3)
const realtimePolicy = ref('balanced')
const realtimeMode = ref(false)
const heatmapMode = ref(false)

const models = ref([])
const datasets = ref([])
const currentFile = ref(null)
const detections = ref([])
const drawableDetections = ref([])
const topPrediction = ref(null)
const topPredictions = ref([])
const suggestion = ref('')
const timings = ref({})
const loading = ref(false)
const error = ref('')
const message = ref('')
const showVideo = ref(false)
const activeStream = ref(null)
const recording = ref(false)
const lastPreviewUrl = ref('')

const REALTIME_ADVICE_MIN_INTERVAL_MS = 6000

let realtimeTimer = null
let recorder = null
let chunks = []
let broadcastChannel = null
let popoutWindow = null
let lastRealtimeAdviceSignature = ''
let lastRealtimeAdviceAt = 0
let adviceRequestSeq = 0

const buildRecognitionSyncPayload = () => ({
  detections: JSON.parse(JSON.stringify(detections.value)),
  drawableDetections: JSON.parse(JSON.stringify(drawableDetections.value)),
  topPrediction: topPrediction.value ? JSON.parse(JSON.stringify(topPrediction.value)) : null,
  topPredictions: JSON.parse(JSON.stringify(topPredictions.value)),
  suggestion: suggestion.value,
  timings: JSON.parse(JSON.stringify(timings.value)),
  lastPreviewUrl: lastPreviewUrl.value,
  heatmapMode: heatmapMode.value,
  inputMode: inputMode.value,
  showVideo: showVideo.value
})

const broadcastRecognitionState = () => {
  if (!broadcastChannel) return
  try {
    broadcastChannel.postMessage({
      type: 'sync-state',
      payload: buildRecognitionSyncPayload()
    })
  } catch (err) {
    if (!err.message?.includes('DataCloneError')) {
      console.error('BroadcastChannel error:', err)
    }
  }
}

const loadBaseData = async () => {
  try {
    const [modelRes, datasetRes] = await Promise.all([modelApi.getList(), annotationApi.getDatasets()])
    models.value = modelRes.models || []
    datasets.value = datasetRes.datasets || []
    selectedModel.value = modelRes.default_model || modelRes.current_model || models.value[0]?.name || ''
    if (!models.value.length) {
      error.value = '当前账号没有可访问的识别模型，请联系管理员上传公开模型或上传自己的模型。'
    }
  } catch (err) {
    error.value = err.message || '基础数据加载失败，请确认后端服务已启动并重新登录。'
  }
}

const stopStream = () => {
  if (realtimeTimer) {
    clearInterval(realtimeTimer)
    realtimeTimer = null
  }
  if (activeStream.value) {
    activeStream.value.getTracks().forEach((track) => track.stop())
    activeStream.value = null
  }
  showVideo.value = false
  if (videoRef.value) videoRef.value.srcObject = null
}

const getDrawablePredictions = (width, height) => {
  const predictions = drawableDetections.value.length
    ? drawableDetections.value
    : (detections.value.length ? detections.value : topPredictions.value)
  return predictions.map((item, index) => {
    if (Array.isArray(item.bbox) && item.bbox.length >= 4) {
      const bbox = item.bbox.map(Number)
      if (bbox.every(Number.isFinite)) return { ...item, bbox }
    }

    const size = Math.min(width, height) * (index === 0 ? 0.42 : 0.28)
    const offset = index * size * 0.18
    const cx = width / 2 + offset
    const cy = height / 2 + offset
    return {
      ...item,
      bbox: [
        Math.max(0, cx - size / 2),
        Math.max(0, cy - size / 2),
        Math.min(width, cx + size / 2),
        Math.min(height, cy + size / 2)
      ]
    }
  })
}

const drawHeatmap = (ctx, width, height) => {
  const predictions = getDrawablePredictions(width, height)
  if (!predictions.length) return false

  ctx.fillStyle = 'rgba(125, 74, 214, 0.42)'
  ctx.fillRect(0, 0, width, height)

  predictions.forEach((item) => {
    const [x1, y1, x2, y2] = item.bbox
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    const alpha = Math.min(0.72, Math.max(0.18, Number(item.confidence || 0.35)))
    const boxWidth = x2 - x1
    const boxHeight = y2 - y1
    const radius = Math.max(80, Math.max(boxWidth, boxHeight) * 0.78)
    const heat = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)

    heat.addColorStop(0, `rgba(255, 255, 210, ${Math.min(0.98, alpha + 0.24)})`)
    heat.addColorStop(0.22, `rgba(255, 245, 120, ${Math.min(0.88, alpha + 0.14)})`)
    heat.addColorStop(0.52, `rgba(237, 139, 255, ${alpha * 0.44})`)
    heat.addColorStop(1, 'rgba(125, 74, 214, 0)')
    ctx.fillStyle = heat
    ctx.fillRect(Math.max(0, cx - radius), Math.max(0, cy - radius), radius * 2, radius * 2)

    const confidenceText = `${Math.round(Number(item.confidence || 1) * 100)}%`
    ctx.font = 'bold 22px Trebuchet MS, sans-serif'
    const textWidth = ctx.measureText(confidenceText).width
    const labelX = Math.min(Math.max(0, cx - textWidth / 2 - 10), width - textWidth - 20)
    const labelY = Math.max(0, cy - radius * 0.62)
    ctx.fillStyle = 'rgba(73, 48, 96, 0.92)'
    ctx.fillRect(labelX, labelY, textWidth + 20, 30)
    ctx.fillStyle = 'rgba(255, 255, 210, 0.98)'
    ctx.fillText(confidenceText, labelX + 10, labelY + 22)
  })

  ctx.fillStyle = 'rgba(255, 244, 90, 0.92)'
  ctx.fillRect(0, height - 8, width, 8)
  return true
}

const drawResult = async (previewUrl) => {
  if (!canvasRef.value) {
    console.error('Canvas ref not available')
    if (!getRecommendationTargets().length) {
      suggestion.value = '未达到当前置信度阈值，暂无可展示的病害建议。'
    }
    return
  }
  
  try {
    const imageUrl = previewUrl || lastPreviewUrl.value
    if (!imageUrl) {
      console.error('No image URL provided')
      return
    }
    
    lastPreviewUrl.value = imageUrl
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')

    // Always draw from imageUrl (works for all modes)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = imageUrl
    
    await new Promise((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = (err) => {
        console.error('Failed to load image:', err)
        reject(err)
      }
    })
    
    canvas.width = image.width
    canvas.height = image.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    // Draw heatmap if mode is enabled
    if (heatmapMode.value) {
      const hasHeatmap = drawHeatmap(ctx, canvas.width, canvas.height)
      if (!hasHeatmap) {
        message.value = '暂无可绘制热力图的识别结果，请先执行识别。'
      }
      return
    }

    // Draw detection boxes, or a visible fallback box for Top predictions.
    const drawablePredictions = getDrawablePredictions(canvas.width, canvas.height)
    if (!drawablePredictions.length) {
      return
    }

    drawablePredictions.forEach((item, index) => {
      try {
        if (!item.bbox || !Array.isArray(item.bbox) || item.bbox.length < 4) {
          console.warn(`Detection ${index} has invalid bbox:`, item.bbox)
          return
        }
        
        const [x1, y1, x2, y2] = item.bbox.map(Number)
        if (![x1, y1, x2, y2].every(Number.isFinite)) {
          console.warn(`Detection ${index} bbox contains non-finite values:`, item.bbox)
          return
        }
        
        const boxWidth = x2 - x1
        const boxHeight = y2 - y1
        const radius = 12 // 圆角半径
        
        // 绘制圆角矩形边框（外层加粗）
        ctx.strokeStyle = 'rgba(255, 252, 240, 0.96)'
        ctx.lineWidth = 14
        ctx.beginPath()
        ctx.roundRect(x1, y1, boxWidth, boxHeight, radius)
        ctx.stroke()
        
        // 绘制圆角矩形边框（内层）
        ctx.strokeStyle = 'rgba(206, 244, 126, 0.98)'
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.roundRect(x1, y1, boxWidth, boxHeight, radius)
        ctx.stroke()
        
        // 绘制标签背景（圆角）
        ctx.fillStyle = 'rgba(255, 252, 240, 0.96)'
        ctx.font = 'bold 34px Trebuchet MS, sans-serif'
        const text = `${item.class_name} ${(item.confidence * 100).toFixed(1)}%`
        const textWidth = ctx.measureText(text).width
        
        const labelHeight = 58
        const labelY = Math.max(0, y1 - labelHeight)
        const labelRadius = 10
        
        ctx.beginPath()
        ctx.roundRect(x1, labelY, textWidth + 30, labelHeight, labelRadius)
        ctx.fill()
        
        // 绘制标签边框
        ctx.strokeStyle = 'rgba(7, 36, 22, 0.9)'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.roundRect(x1, labelY, textWidth + 30, labelHeight, labelRadius)
        ctx.stroke()
        
        ctx.fillStyle = '#072416'
        ctx.fillText(text, x1 + 15, labelY + 40)
      } catch (err) {
        console.error(`Error drawing detection ${index}:`, err)
      }
    })
  } catch (err) {
    console.error('drawResult error:', err)
  }
}

const toggleHeatmapMode = async () => {
  heatmapMode.value = !heatmapMode.value
  if (heatmapMode.value && !detections.value.length && !topPredictions.value.length) {
    if (currentFile.value || (inputMode.value !== 'upload' && activeStream.value)) {
      await runRecognition()
      return
    }
    message.value = '请先准备图片或视频画面，再切换热力图。'
  }
  if (inputMode.value !== 'upload' && activeStream.value && videoRef.value && videoRef.value.videoWidth > 0) {
    // For camera/screen mode, capture current frame and draw heatmap
    const temp = document.createElement('canvas')
    temp.width = videoRef.value.videoWidth
    temp.height = videoRef.value.videoHeight
    const ctx = temp.getContext('2d')
    ctx.drawImage(videoRef.value, 0, 0, temp.width, temp.height)
    const dataUrl = temp.toDataURL('image/jpeg')
    lastPreviewUrl.value = dataUrl
    await drawResult(dataUrl)
  } else if (lastPreviewUrl.value) {
    await drawResult(lastPreviewUrl.value)
  }
}

const startStream = async () => {
  error.value = ''
  try {
    const stream = inputMode.value === 'camera'
      ? await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })

    activeStream.value = stream
    showVideo.value = true
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      // Wait for video to be ready
      await new Promise((resolve) => {
        if (videoRef.value.videoWidth > 0 && videoRef.value.videoHeight > 0) {
          resolve()
        } else {
          videoRef.value.onloadedmetadata = () => resolve()
        }
      })
    }
    // Start real-time recognition after stream is ready
    if (realtimeMode.value) {
      message.value = inputMode.value === 'camera' ? '摄像头已连接，实时识别已自动开启。' : '屏幕共享已开始，实时识别已自动开启。'
      // Trigger first recognition immediately
      await runRealtimeRecognition()
    } else {
      message.value = inputMode.value === 'camera' ? '摄像头已连接，可以截图识别。' : '屏幕共享已开始，可以截图识别。'
    }
  } catch (err) {
    error.value = err.message || '无法启动视频流。'
  }
}

const captureFrameFile = () => new Promise((resolve) => {
  if (!videoRef.value || !videoRef.value.videoWidth || !videoRef.value.videoHeight) {
    resolve(null)
    return
  }
  const temp = document.createElement('canvas')
  temp.width = videoRef.value.videoWidth
  temp.height = videoRef.value.videoHeight
  temp.getContext('2d').drawImage(videoRef.value, 0, 0, temp.width, temp.height)
  temp.toBlob((blob) => {
    if (!blob) {
      resolve(null)
      return
    }
    resolve(new File([blob], `${inputMode.value}-capture.jpg`, { type: 'image/jpeg' }))
  }, 'image/jpeg')
})

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    resolve('')
    return
  }
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result || '')
  reader.onerror = () => reject(reader.error || new Error('图片读取失败。'))
  reader.readAsDataURL(file)
})

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result || '')
  reader.onerror = () => reject(reader.error || new Error('图片读取失败。'))
  reader.readAsDataURL(blob)
})

const getRecognitionPreviewUrl = async (result) => {
  if (result?.preview_url?.startsWith('blob:')) {
    URL.revokeObjectURL(result.preview_url)
  }
  return fileToDataUrl(currentFile.value)
}

const getAnnotationImageDataUrl = async () => {
  if (currentFile.value) return fileToDataUrl(currentFile.value)
  if (lastPreviewUrl.value?.startsWith('data:')) return lastPreviewUrl.value
  if (lastPreviewUrl.value?.startsWith('blob:')) {
    const response = await fetch(lastPreviewUrl.value)
    return blobToDataUrl(await response.blob())
  }
  return ''
}

const captureFrame = async () => {
  const file = await captureFrameFile()
  if (!file) {
    error.value = '当前视频画面还没有准备好，请稍后再试。'
    return
  }
  currentFile.value = file
  message.value = '当前画面已截取，可以执行识别。'
}

const handleUpload = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  currentFile.value = file
  error.value = ''
  message.value = `已选择图片：${file.name}`
}

const handleDrop = (event) => {
  const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith('image/'))
  if (!file) {
    error.value = '请拖入图片文件。'
    return
  }
  currentFile.value = file
  error.value = ''
  message.value = `已选择图片：${file.name}`
}

const getRecommendationTargets = () => (
  detections.value.length ? detections.value : topPredictions.value
)

const buildAdviceSignature = (targets, datasetName) => {
  const primary = targets[0]
  if (!primary) return ''
  const label = primary.class_name || primary.label || ''
  const confidenceBucket = Math.round(Number(primary.confidence || 0) * 20)
  const count = targets.length
  return `${datasetName || ''}|${label}|${confidenceBucket}|${count}`
}

const refreshRecommendation = async ({ realtime = false, force = false } = {}) => {
  const recommendationTargets = getRecommendationTargets()
  if (!recommendationTargets.length) {
    if (!realtime) {
      suggestion.value = '未检测到目标，无法生成防治建议。'
    }
    return false
  }

  const datasetForAdvice = datasetContext.value || 'general_plant_diseases'
  const signature = buildAdviceSignature(recommendationTargets, datasetForAdvice)
  const now = Date.now()

  if (realtime && !force) {
    const tooSoon = now - lastRealtimeAdviceAt < REALTIME_ADVICE_MIN_INTERVAL_MS
    if (signature === lastRealtimeAdviceSignature || tooSoon) return false
  }

  lastRealtimeAdviceSignature = signature
  lastRealtimeAdviceAt = now
  const requestId = ++adviceRequestSeq

  if (!suggestion.value || !realtime) {
    suggestion.value = 'AI 正在生成防治建议...'
  }

  try {
    const recommendation = await predictApi.getRecommendation(recommendationTargets, datasetForAdvice)
    if (requestId === adviceRequestSeq) {
      suggestion.value = recommendation.suggestion
    }
    return true
  } catch (err) {
    console.warn('AI建议生成失败:', err)
    if (requestId === adviceRequestSeq) {
      suggestion.value = 'AI 建议生成失败，请重试。'
    }
    return false
  }
}

const scheduleRealtimeRecommendation = () => {
  refreshRecommendation({ realtime: true }).catch((err) => {
    console.warn('实时AI建议生成失败:', err)
  })
}

const runRecognition = async () => {
  if (!currentFile.value && inputMode.value !== 'upload' && activeStream.value) {
    currentFile.value = await captureFrameFile()
  }

  if (!currentFile.value) {
    error.value = '请先准备图片或视频截图。'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const result = await predictApi.recognize(currentFile.value, selectedModel.value, confidence.value, {
      mode: realtimeMode.value ? 'realtime' : 'single',
      policy: realtimePolicy.value,
      fps: targetFps.value,
      datasetContext: datasetContext.value
    })

    detections.value = result.detections || []
    drawableDetections.value = result.drawable_detections || result.detections || []
    topPrediction.value = result.top_prediction
    topPredictions.value = result.top_predictions || []
    timings.value = result.timings || {}
    
    // 只为非实时识别模式生成AI建议
    if (!realtimeMode.value) {
      const recommendationTargets = detections.value.length ? detections.value : topPredictions.value
      if (recommendationTargets.length > 0) {
        try {
          const datasetForAdvice = datasetContext.value || 'general_plant_diseases'
          suggestion.value = 'AI 正在生成防治建议...'
          const recommendation = await predictApi.getRecommendation(recommendationTargets, datasetForAdvice)
          suggestion.value = recommendation.suggestion
        } catch (err) {
          console.warn('AI建议生成失败:', err)
          suggestion.value = 'AI 建议生成失败，请重试。'
        }
      } else {
        suggestion.value = '未检测到目标，无法生成防治建议。'
      }
    } else {
      // 实时识别模式不清空suggestion，保持之前显示的内容
    }
    
    if (realtimeMode.value) {
      if (getRecommendationTargets().length) {
        scheduleRealtimeRecommendation()
      } else {
        suggestion.value = '未达到当前置信度阈值，暂无可展示的病害建议。'
      }
    }

    await drawResult(await getRecognitionPreviewUrl(result))
    message.value = '识别已完成，可以切换到标注工作区继续处理。'
  } catch (err) {
    error.value = err.message || '识别失败。'
  } finally {
    loading.value = false
  }
}

const runRealtimeRecognition = async () => {
  if (loading.value) return
  if (inputMode.value !== 'upload' && activeStream.value) {
    currentFile.value = await captureFrameFile()
  }
  if (currentFile.value) await runRecognition()
}

const toggleRealtimeMode = async () => {
  if (realtimeMode.value) {
    realtimeMode.value = false
    if (realtimeTimer) {
      clearInterval(realtimeTimer)
      realtimeTimer = null
    }
    // 停止实时识别后，调用AI生成真实建议
    const recommendationTargets = getRecommendationTargets()
    if (recommendationTargets.length > 0) {
      try {
        suggestion.value = 'AI 正在生成防治建议...'
        // 如果没有选择数据集上下文，使用默认数据集名称以确保建议被存储
        const datasetForAdvice = datasetContext.value || 'general_plant_diseases'
        const recommendation = await predictApi.getRecommendation(recommendationTargets, datasetForAdvice)
        suggestion.value = recommendation.suggestion
        message.value = '实时识别已停止，AI 防治建议已生成。'
      } catch (err) {
        console.warn('生成建议失败:', err)
        suggestion.value = 'AI 建议生成失败，请重试。'
      }
    } else {
      message.value = '实时识别已停止。'
    }
    return
  }

  if (inputMode.value !== 'upload' && !activeStream.value) {
    await startStream()
    if (!activeStream.value) return
    // Wait for video to be ready before starting recognition
    if (videoRef.value) {
      await new Promise((resolve) => {
        if (videoRef.value.videoWidth > 0 && videoRef.value.videoHeight > 0) {
          resolve()
        } else {
          videoRef.value.onloadedmetadata = () => resolve()
        }
      })
    }
  }

  if (inputMode.value === 'upload' && !currentFile.value) {
    error.value = '请先选择一张图片，再开启实时识别。'
    return
  }

  error.value = ''
  realtimeMode.value = true
  message.value = inputMode.value === 'upload'
    ? '实时识别已开启，将持续刷新当前图片结果。'
    : '实时识别已开启，将自动截取当前画面进行识别。'
  // Trigger first recognition immediately
  await runRealtimeRecognition()
}

const toggleRecorder = () => {
  if (!activeStream.value) return
  if (recording.value) {
    recorder?.stop()
    recording.value = false
    return
  }

  chunks = []
  recorder = new MediaRecorder(activeStream.value)
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'recognition-recording.webm'
    link.click()
    URL.revokeObjectURL(url)
    message.value = '录屏文件已开始下载。'
  }
  recorder.start()
  recording.value = true
  message.value = '录屏中，点击按钮即可停止并下载。'
}

const handleModeChange = () => {
  currentFile.value = null
  detections.value = []
  drawableDetections.value = []
  topPrediction.value = null
  topPredictions.value = []
  suggestion.value = ''
  lastPreviewUrl.value = ''
  stopStream()
}

const sendToAnnotation = async () => {
  const imageDataUrl = await getAnnotationImageDataUrl()
  sessionStorage.setItem('pendingAnnotation', JSON.stringify({
    detections: detections.value,
    previewName: currentFile.value?.name || 'captured-image.jpg',
    imageDataUrl
  }))
  router.push('/annotation')
}

const openPopout = () => {
  const popoutUrl = `${window.location.origin}/recognize-popout?popout=1`
  popoutWindow = window.open(popoutUrl, 'recognition-popout', 'width=800,height=600')

  // Initialize broadcast channel for parent -> popout communication
  broadcastChannel = new BroadcastChannel('plant-recognize-sync')
  broadcastChannel.onmessage = (event) => {
    if (event.data?.type === 'popout-ready' || event.data?.type === 'request-sync') {
      broadcastRecognitionState()
    }
  }

  ;[80, 260, 600, 1200].forEach((delay) => {
    setTimeout(() => broadcastRecognitionState(), delay)
  })

  // Focus popout window
  setTimeout(() => {
    if (popoutWindow) popoutWindow.focus()
  }, 100)
}

const restartRealtimeTimer = () => {
  if (realtimeTimer) {
    clearInterval(realtimeTimer)
    realtimeTimer = null
  }
  if (realtimeMode.value) {
    // Only start timer in watch, first call handled in toggleRealtimeMode
    realtimeTimer = setInterval(() => {
      runRealtimeRecognition()
    }, Math.max(600, 1000 / targetFps.value))
  }
}

watch(realtimeMode, () => {
  restartRealtimeTimer()
})

watch(targetFps, () => {
  restartRealtimeTimer()
})

// Watch for recognition result changes and broadcast to popout
watch([detections, drawableDetections, topPrediction, topPredictions, suggestion, timings, lastPreviewUrl, heatmapMode, showVideo], () => {
  broadcastRecognitionState()
})

onMounted(() => {
  loadBaseData()

  // If this is a popout window, set up listening for parent updates
  if (popout.value) {
    broadcastChannel = new BroadcastChannel('plant-recognize-sync')
    const requestParentSync = () => {
      broadcastChannel?.postMessage({ type: 'popout-ready' })
      broadcastChannel?.postMessage({ type: 'request-sync' })
    }
    requestParentSync()
    ;[120, 400, 900, 1600].forEach((delay) => {
      setTimeout(requestParentSync, delay)
    })

    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'sync-state') {
        const { detections: d, drawableDetections: dd, topPrediction: tp, topPredictions: tps, suggestion: sg, timings: t, lastPreviewUrl: lpu, heatmapMode: hm, inputMode: im, showVideo: sv } = event.data.payload
        detections.value = d || []
        drawableDetections.value = dd || d || []
        topPrediction.value = tp || null
        topPredictions.value = tps || []
        suggestion.value = sg || ''
        timings.value = t || {}
        // Sync inputMode for popout window
        if (im !== undefined) {
          inputMode.value = im
        }
        // Sync showVideo state
        if (sv !== undefined) {
          showVideo.value = sv
        }
        // Sync heatmap mode before drawing, otherwise the popout may redraw as box view.
        if (hm !== undefined) {
          heatmapMode.value = hm
        }
        if (lpu) {
          lastPreviewUrl.value = lpu
          // Redraw canvas with new data
          setTimeout(() => {
            drawResult(lpu)
          }, 50)
        }
      }
    }
  } else {
    // For main window, show initial message
    message.value = '实时识别已默认开启，请选择摄像头或屏幕共享开始识别。'
  }
})
onBeforeUnmount(() => {
  stopStream()
  if (recorder && recording.value) recorder.stop()
  if (broadcastChannel) {
    broadcastChannel.close()
    broadcastChannel = null
  }
})
</script>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 22px;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(16px);
}

.section-head h3,
.preview-head h3,
.inner-head h4 {
  margin: 0;
}

.section-head p,
.preview-head p,
.inner-panel p {
  margin: 8px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.control-panel {
  display: grid;
  gap: 16px;
  align-self: start;
}

.control-panel label span {
  display: block;
  margin-bottom: 8px;
  color: var(--text-muted);
  font-size: 14px;
}

.control-panel select,
.control-panel input[type='range'] {
  width: 100%;
}

.control-panel select {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.82);
}

.toggle-row,
.stream-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.primary-btn,
.soft-btn {
  border-radius: 16px;
  padding: 13px 14px;
  border: 1px solid var(--border);
}

.primary-btn {
  background: rgba(var(--brand-green-rgb), 0.84);
  color: var(--cream-white);
  font-weight: 700;
}

.soft-btn {
  background: rgba(37, 37, 37, 0.68);
  color: var(--text);
}

.recognition-action-btn {
  background: var(--cream-white);
  color: var(--text);
}

.annotation-transfer-btn {
  background: var(--cream-white);
  color: var(--text);
}

.capture-frame-btn {
  background: rgba(var(--brand-green-rgb), 0.84);
  color: var(--cream-white);
  font-weight: 700;
}

.wide {
  width: 100%;
}

.dropzone {
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 24px;
  background: rgba(255, 255, 255, 0.44);
}

.upload-entry {
  cursor: pointer;
  padding: 18px;
  background:
    rgba(255, 255, 255, 0.44);
  border-color: rgba(var(--brand-green-rgb), 0.42);
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.upload-entry:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--brand-green-rgb), 0.68);
  background:
    rgba(255, 255, 255, 0.5);
}

.upload-kicker {
  margin: 0 0 8px;
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.dropzone strong,
.dropzone span {
  display: block;
}

.dropzone span {
  margin-top: 8px;
  color: var(--text-muted);
  line-height: 1.7;
}

.hidden-input {
  display: none;
}

.message {
  margin: 0;
  color: var(--text-muted);
}

.message.error {
  color: var(--warn);
}

.preview-panel {
  display: grid;
  gap: 20px;
}

.preview-head,
.inner-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.timings {
  display: grid;
  gap: 6px;
  text-align: right;
  font-size: 14px;
  color: var(--text-muted);
}

.viewer {
  position: relative;
  min-height: 320px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.45);
}

.viewer video,
.viewer canvas {
  width: 100%;
  height: auto;
  display: block;
}

.result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.highlight-card,
.summary-card,
.inner-panel {
  border-radius: var(--radius-lg);
}

.highlight-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.46);
}

.highlight-card p,
.summary-card p {
  margin: 0 0 10px;
  color: var(--text-muted);
}

.highlight-card strong {
  display: block;
  font-size: 30px;
  margin-bottom: 8px;
}

.summary-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.56);
}

.summary-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.summary-card li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.inner-panel {
  padding: 20px;
  background: rgba(255, 255, 255, 0.54);
}

.popout-page {
  width: 100vw;
  height: 100vh;
  overflow: auto;
  background: var(--page-bg);
}

.popout-page .preview-panel {
  min-height: 100vh;
  border: none;
  border-radius: 0;
  padding: 28px;
  backdrop-filter: none;
}

.popout-page .viewer {
  min-height: 520px;
}

.popout-page .stream-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 1080px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .toggle-row,
  .stream-actions,
  .result-grid {
    grid-template-columns: 1fr;
  }

  .preview-head,
  .inner-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .timings {
    text-align: left;
  }
}
</style>
