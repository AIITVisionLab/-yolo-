<template>
  <article class="pip-shell">
    <header class="pip-header">
      <div class="pip-header__copy">
        <p class="pip-header__eyebrow">识别小窗</p>
        <h1>{{ heroLabel }}</h1>
        <span class="pip-header__meta">置信度 {{ heroConfidence }}</span>
      </div>

      <div class="pip-header__actions">
        <button
          v-if="showStopCameraAction"
          type="button"
          class="pip-button pip-button--secondary"
          @click="emit('stop-camera')"
        >
          关闭摄像头
        </button>
        <button
          type="button"
          class="pip-button pip-button--primary"
          @click="emit('close')"
        >
          关闭窗口
        </button>
      </div>
    </header>

    <section :class="['pip-banner', { 'is-error': hasError }]">
      {{ bannerText }}
    </section>

    <section v-if="showScreenHint" class="pip-note">
      共享整屏时，小窗被再次录进画面是浏览器采集行为。想避免递归画面，优先共享单个窗口或标签页。
    </section>

    <section class="pip-stage-card">
      <div class="pip-stage-card__head">
        <div>
          <span>预览来源</span>
          <strong>{{ sourceLabel }}</strong>
        </div>
        <div class="pip-stage-card__side">
          <span>当前模型</span>
          <strong>{{ modelLabel }}</strong>
        </div>
      </div>

      <div v-if="hasPreviewMedia" class="pip-stage-card__modes" role="tablist" aria-label="小窗显示方式">
        <button
          type="button"
          :class="['pip-stage-card__mode', { 'is-active': pipVisualizationMode === 'boxes' }]"
          @click="pipVisualizationMode = 'boxes'"
        >
          标注框
        </button>
        <button
          type="button"
          :class="['pip-stage-card__mode', { 'is-active': pipVisualizationMode === 'heatmap' }]"
          @click="pipVisualizationMode = 'heatmap'"
        >
          热力图
        </button>
      </div>

      <div class="pip-stage">
        <div v-if="hasPreviewMedia" ref="mediaFrameRef" class="pip-stage__media">
          <video
            v-if="showLivePreview"
            ref="liveVideoRef"
            autoplay
            muted
            playsinline
            @loadedmetadata="handleMediaReady"
            @playing="handleMediaReady"
          />
          <img
            v-else
            ref="previewImageRef"
            :src="previewSrc"
            alt="识别预览"
            @load="handleMediaReady"
          />

          <canvas
            ref="heatmapCanvasRef"
            :class="['pip-stage__heatmap', { 'is-visible': pipVisualizationMode === 'heatmap' }]"
            aria-hidden="true"
          />
          <canvas
            ref="boxCanvasRef"
            :class="['pip-stage__box-canvas', { 'is-visible': pipVisualizationMode === 'boxes' }]"
            aria-hidden="true"
          />
        </div>

        <div v-else class="pip-stage__empty">
          <strong>等待主窗口提供画面</strong>
          <p>先在主窗口连接摄像头、共享屏幕或上传图片，小窗会自动同步。</p>
        </div>
      </div>

      <p class="pip-stage-card__hint">{{ sourceDetail }}</p>
    </section>

    <section class="pip-controls">
      <div class="pip-controls__head">
        <span>置信度阈值</span>
        <strong>{{ threshold }}%</strong>
      </div>
      <input
        class="pip-controls__range"
        type="range"
        min="0"
        max="100"
        :value="threshold"
        @input="emit('threshold-change', Number($event.target.value))"
      />
      <p class="pip-controls__hint">阈值调整会直接同步回主窗口。</p>
    </section>

    <section class="pip-metrics">
      <article class="pip-metric">
        <span>实时速度</span>
        <strong>{{ fpsLabel }}</strong>
        <p>{{ latencyLabel }}</p>
      </article>
      <article class="pip-metric">
        <span>检测数量</span>
        <strong>{{ detectionCountLabel }}</strong>
        <p>{{ detectionSubtitle }}</p>
      </article>
      <article class="pip-metric">
        <span>工作状态</span>
        <strong>{{ workStateLabel }}</strong>
        <p>{{ workStateDetail }}</p>
      </article>
    </section>

    <section class="pip-panel">
      <div class="pip-panel__head">
        <span>检测摘要</span>
        <strong>{{ detectionHeadline }}</strong>
      </div>

      <div v-if="detectionItems.length" class="pip-chip-list">
        <span
          v-for="(item, index) in detectionItems"
          :key="`${item.label}-${index}`"
          class="pip-chip"
        >
          {{ translateLabel(item.label) }} {{ formatConfidence(item.confidence) }}
        </span>
      </div>
      <p v-else class="pip-muted">
        当前阈值下没有可展示的检测结果。
      </p>
    </section>

    <section class="pip-panel">
      <div class="pip-panel__head">
        <span>处理建议</span>
        <strong>{{ adviceHeadline }}</strong>
      </div>

      <p class="pip-copy">{{ adviceSummary }}</p>
      <p v-if="adviceDetail" class="pip-subtle">{{ adviceDetail }}</p>

      <ul v-if="adviceItems.length" class="pip-list">
        <li v-for="item in adviceItems" :key="item">{{ item }}</li>
      </ul>
    </section>
  </article>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { translateLabel } from '@/lib/plantPresentation'
import { drawDetectionsOverlay, drawHeatmapOverlay } from '@/lib/recognitionVisuals'

const props = defineProps({
  previewUrl: {
    type: String,
    default: "",
  },
  previewFile: {
    type: Object,
    default: null,
  },
  liveStream: {
    type: Object,
    default: null,
  },
  previewMeta: {
    type: Object,
    default: () => ({ width: 0, height: 0 }),
  },
  visualizationMode: {
    type: String,
    default: "boxes",
  },
  threshold: {
    type: Number,
    default: 10,
  },
  filteredDetections: {
    type: Array,
    default: () => [],
  },
  result: {
    type: Object,
    default: null,
  },
  adviceBundle: {
    type: Object,
    default: null,
  },
  selectedModel: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    default: "",
  },
  error: {
    type: String,
    default: "",
  },
  liveRecognitionEnabled: {
    type: Boolean,
    default: false,
  },
  liveSourceMode: {
    type: String,
    default: "",
  },
  realtimeTargetFps: {
    type: Number,
    default: 6,
  },
  realtimeProfile: {
    type: Object,
    default: null,
  },
  realtimeMetrics: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(["threshold-change", "close", "stop-camera"])

const liveVideoRef = ref(null)
const previewImageRef = ref(null)
const mediaFrameRef = ref(null)
const heatmapCanvasRef = ref(null)
const boxCanvasRef = ref(null)
const ownedPreviewUrl = ref("")
const pipVisualizationMode = ref("boxes")

let mediaResizeObserver = null
let heatmapSyncFrame = 0
let heatmapSchedulerWindow = null
let boxSyncFrame = 0
let boxSchedulerWindow = null

const showLivePreview = computed(() => Boolean(props.liveStream))
const showStopCameraAction = computed(() => props.liveSourceMode === "camera" && Boolean(props.liveStream))
const showScreenHint = computed(() => props.liveSourceMode === "screen" && Boolean(props.liveStream))
const hasError = computed(() => Boolean(props.error))
const previewSrc = computed(() => ownedPreviewUrl.value || props.previewUrl || "")
const hasPreviewMedia = computed(() => showLivePreview.value || Boolean(previewSrc.value))
const heroLabel = computed(() => translateLabel(props.result?.predicted_class || "待识别"))
const heroConfidence = computed(() => formatConfidence(props.result?.confidence))
const modelLabel = computed(() => String(props.selectedModel || "").trim() || "未选择模型")

const sourceLabel = computed(() => {
  if (props.liveSourceMode === "camera") return "摄像头"
  if (props.liveSourceMode === "screen") return "屏幕共享"
  if (previewSrc.value) return "静态预览"
  return "待输入"
})

const sourceDetail = computed(() => {
  if (props.liveRecognitionEnabled) {
    return "主窗口正在持续识别，小窗只负责轻量同步。"
  }
  if (showLivePreview.value) {
    return "采集源已连接，当前显示实时画面。"
  }
  if (previewSrc.value) {
    return "当前显示最近一次上传或截取的画面。"
  }
  return "当前没有可显示的输入画面。"
})

const bannerText = computed(() => {
  return props.error || props.status || "识别结果会从主窗口同步到这里。"
})

const detectionItems = computed(() => props.filteredDetections.slice(0, 6))
const detectionHeadline = computed(() => detectionItems.value.length ? "已同步结果" : "等待识别")
const detectionCountLabel = computed(() => String(props.filteredDetections.length || 0))
const detectionSubtitle = computed(() => {
  if (!props.filteredDetections.length) return "当前阈值下无目标"
  return `${detectionItems.value.length} 条摘要已展示`
})

const workStateLabel = computed(() => {
  if (props.liveRecognitionEnabled) return "实时识别中"
  if (showLivePreview.value) return "实时画面已连接"
  if (previewSrc.value) return "静态查看"
  return "等待输入"
})

const workStateDetail = computed(() => {
  if (props.liveRecognitionEnabled) return `目标 ${formatFps(props.realtimeTargetFps)}`
  if (showLivePreview.value) return "小窗优先走流预览"
  if (previewSrc.value) return "当前画面不会自动刷新"
  return "请回主窗口准备画面"
})

const fpsLabel = computed(() => {
  if (props.liveRecognitionEnabled) {
    return formatFps(props.realtimeMetrics?.actualFps || props.realtimeTargetFps)
  }
  return "--"
})

const latencyLabel = computed(() => {
  if (!props.liveRecognitionEnabled) return "未开启实时识别"
  return `最近耗时 ${formatDurationMs(props.realtimeMetrics?.lastRoundtripMs)}`
})

const adviceHeadline = computed(() => props.adviceBundle ? "已生成建议" : "等待分析")
const adviceSummary = computed(() => props.adviceBundle?.summary || "完成识别后，这里会显示简化处理建议。")
const adviceDetail = computed(() => {
  const parts = [formatAdviceSource(props.adviceBundle?.source), props.adviceBundle?.detail].filter(Boolean)
  return parts.join(" · ")
})
const adviceItems = computed(() => Array.isArray(props.adviceBundle?.advice) ? props.adviceBundle.advice.slice(0, 3) : [])

function formatConfidence(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "--"
  return `${(numeric * 100).toFixed(1)}%`
}

function formatDurationMs(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return "--"
  return `${Math.round(numeric)} ms`
}

function formatFps(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return "--"
  return `${numeric.toFixed(numeric >= 10 ? 0 : 1)} FPS`
}

function formatAdviceSource(source) {
  switch (source) {
    case "knowledge-base":
      return "知识库建议"
    case "ai-vision":
      return "多模态模型"
    case "ai-text":
      return "文本模型"
    default:
      return ""
  }
}

function revokeOwnedPreviewUrl() {
  if (!ownedPreviewUrl.value) return
  URL.revokeObjectURL(ownedPreviewUrl.value)
  ownedPreviewUrl.value = ""
}

function getMediaWindow() {
  return mediaFrameRef.value?.ownerDocument?.defaultView
    || liveVideoRef.value?.ownerDocument?.defaultView
    || previewImageRef.value?.ownerDocument?.defaultView
    || (typeof window !== "undefined" ? window : null)
}

function disconnectMediaResizeObserver() {
  if (mediaResizeObserver) {
    mediaResizeObserver.disconnect()
    mediaResizeObserver = null
  }
}

function clearHeatmapCanvas() {
  const canvas = heatmapCanvasRef.value
  const context = canvas?.getContext("2d")
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
}

function clearBoxCanvas() {
  const canvas = boxCanvasRef.value
  const context = canvas?.getContext("2d")
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
}

function syncHeatmapCanvas() {
  const frame = mediaFrameRef.value
  const canvas = heatmapCanvasRef.value
  const mediaElement = showLivePreview.value ? liveVideoRef.value : previewImageRef.value
  if (!frame || !canvas || !mediaElement) return

  const rect = frame.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  if (!width || !height) {
    clearHeatmapCanvas()
    return
  }

  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (pipVisualizationMode.value !== "heatmap") return

  const intrinsicWidth = mediaElement.naturalWidth || mediaElement.videoWidth || props.previewMeta.width || width
  const intrinsicHeight = mediaElement.naturalHeight || mediaElement.videoHeight || props.previewMeta.height || height
  drawHeatmapOverlay(
    context,
    props.filteredDetections,
    {
      width: props.previewMeta.width || intrinsicWidth,
      height: props.previewMeta.height || intrinsicHeight,
    },
    width,
    height,
  )
}

function syncBoxCanvas() {
  const frame = mediaFrameRef.value
  const canvas = boxCanvasRef.value
  const mediaElement = showLivePreview.value ? liveVideoRef.value : previewImageRef.value
  if (!frame || !canvas || !mediaElement) return

  const rect = frame.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  if (!width || !height) {
    clearBoxCanvas()
    return
  }

  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (pipVisualizationMode.value !== "boxes") return

  const intrinsicWidth = mediaElement.naturalWidth || mediaElement.videoWidth || props.previewMeta.width || width
  const intrinsicHeight = mediaElement.naturalHeight || mediaElement.videoHeight || props.previewMeta.height || height
  drawDetectionsOverlay(
    context,
    props.filteredDetections,
    {
      width: props.previewMeta.width || intrinsicWidth,
      height: props.previewMeta.height || intrinsicHeight,
    },
    width,
    height,
  )
}

function scheduleHeatmapSync() {
  const mediaWindow = getMediaWindow()
  if (heatmapSyncFrame || !mediaWindow?.requestAnimationFrame) return
  heatmapSchedulerWindow = mediaWindow
  heatmapSyncFrame = mediaWindow.requestAnimationFrame(() => {
    heatmapSyncFrame = 0
    syncHeatmapCanvas()
  })
}

function scheduleBoxSync() {
  const mediaWindow = getMediaWindow()
  if (boxSyncFrame || !mediaWindow?.requestAnimationFrame) return
  boxSchedulerWindow = mediaWindow
  boxSyncFrame = mediaWindow.requestAnimationFrame(() => {
    boxSyncFrame = 0
    syncBoxCanvas()
  })
}

function observeMediaResize() {
  disconnectMediaResizeObserver()
  const ResizeObserverCtor = getMediaWindow()?.ResizeObserver || (typeof ResizeObserver !== "undefined" ? ResizeObserver : null)
  if (!ResizeObserverCtor || !mediaFrameRef.value) return

  mediaResizeObserver = new ResizeObserverCtor(() => {
    scheduleHeatmapSync()
    scheduleBoxSync()
  })
  mediaResizeObserver.observe(mediaFrameRef.value)
}

function handleMediaReady() {
  observeMediaResize()
  scheduleHeatmapSync()
  scheduleBoxSync()
}

async function syncLiveVideo() {
  if (!liveVideoRef.value) return

  if (liveVideoRef.value.srcObject !== props.liveStream) {
    liveVideoRef.value.srcObject = props.liveStream || null
  }

  if (props.liveStream) {
    await liveVideoRef.value.play().catch(() => {})
  }
}

watch(
  () => props.visualizationMode,
  (value) => {
    pipVisualizationMode.value = value === "heatmap" ? "heatmap" : "boxes"
  },
  { immediate: true },
)

watch(
  () => props.previewFile,
  (file) => {
    revokeOwnedPreviewUrl()
    if (!file) return
    ownedPreviewUrl.value = URL.createObjectURL(file)
  },
  { immediate: true },
)

watch(
  () => props.liveStream,
  () => {
    nextTick(() => {
      syncLiveVideo()
      handleMediaReady()
    })
  },
  { immediate: true },
)

watch(
  () => previewSrc.value,
  () => {
    nextTick(() => {
      handleMediaReady()
    })
  },
)

watch(
  () => props.previewMeta,
  () => {
    scheduleHeatmapSync()
    scheduleBoxSync()
  },
  { deep: true },
)

watch(
  () => props.filteredDetections,
  () => {
    scheduleHeatmapSync()
    scheduleBoxSync()
  },
  { deep: true },
)

watch(pipVisualizationMode, (value) => {
  if (value === "heatmap") {
    clearBoxCanvas()
    nextTick(() => {
      handleMediaReady()
    })
    return
  }
  clearHeatmapCanvas()
  nextTick(() => {
    handleMediaReady()
  })
})

watch(liveVideoRef, () => {
  nextTick(() => {
    syncLiveVideo()
    handleMediaReady()
  })
})

onBeforeUnmount(() => {
  revokeOwnedPreviewUrl()
  disconnectMediaResizeObserver()
  if (heatmapSyncFrame && heatmapSchedulerWindow?.cancelAnimationFrame) {
    heatmapSchedulerWindow.cancelAnimationFrame(heatmapSyncFrame)
    heatmapSyncFrame = 0
  }
  if (boxSyncFrame && boxSchedulerWindow?.cancelAnimationFrame) {
    boxSchedulerWindow.cancelAnimationFrame(boxSyncFrame)
    boxSyncFrame = 0
  }
  heatmapSchedulerWindow = null
  boxSchedulerWindow = null
  clearHeatmapCanvas()
  clearBoxCanvas()
  if (liveVideoRef.value) {
    liveVideoRef.value.srcObject = null
  }
})
</script>

<style scoped>
.pip-shell {
  display: grid;
  gap: 12px;
  color: #1d2b23;
  font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.pip-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.pip-header__copy {
  min-width: 0;
}

.pip-header__eyebrow {
  margin: 0 0 4px;
  color: #6f776e;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pip-header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.1;
  color: #16231d;
}

.pip-header__meta {
  display: inline-flex;
  margin-top: 8px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(39, 75, 61, 0.1);
  color: #264638;
  font-size: 12px;
  font-weight: 700;
}

.pip-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.pip-button {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.pip-button--primary {
  border: 0;
  background: linear-gradient(135deg, #274b3d 0%, #162f25 100%);
  color: #f7f4ed;
}

.pip-button--secondary {
  border: 1px solid rgba(39, 75, 61, 0.18);
  background: rgba(255, 255, 255, 0.84);
  color: #274b3d;
}

.pip-banner,
.pip-note,
.pip-stage-card,
.pip-controls,
.pip-metric,
.pip-panel {
  border-radius: 18px;
  border: 1px solid rgba(31, 36, 32, 0.08);
  background: linear-gradient(180deg, rgba(255, 254, 251, 0.97), rgba(244, 239, 232, 0.92));
}

.pip-banner,
.pip-note {
  padding: 10px 12px;
  line-height: 1.5;
  font-size: 13px;
}

.pip-banner {
  color: #264638;
}

.pip-banner.is-error {
  background: rgba(182, 92, 66, 0.12);
  color: #924e3b;
}

.pip-note {
  color: #6c7068;
}

.pip-stage-card,
.pip-controls,
.pip-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.pip-stage-card__head,
.pip-controls__head,
.pip-panel__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.pip-stage-card__head span,
.pip-controls__head span,
.pip-panel__head span {
  display: block;
  color: #6f776e;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pip-stage-card__head strong,
.pip-controls__head strong,
.pip-panel__head strong {
  display: block;
  margin-top: 4px;
  color: #16231d;
  font-size: 15px;
}

.pip-stage-card__side {
  text-align: right;
}

.pip-stage-card__modes {
  display: inline-flex;
  gap: 6px;
  width: fit-content;
  padding: 4px;
  border-radius: 999px;
  background: rgba(39, 75, 61, 0.08);
}

.pip-stage-card__mode {
  min-height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #476255;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.pip-stage-card__mode.is-active {
  background: linear-gradient(135deg, #274b3d 0%, #162f25 100%);
  color: #f7f4ed;
}

.pip-stage {
  display: grid;
  place-items: center;
  min-height: 190px;
  border-radius: 16px;
  overflow: hidden;
  background: repeating-linear-gradient(90deg, rgba(52, 89, 70, 0.04) 0, rgba(52, 89, 70, 0.04) 1px, transparent 1px, transparent 48px),
              linear-gradient(180deg, rgba(230, 236, 228, 0.9), rgba(216, 224, 213, 0.92));
}

.pip-stage__media {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 100%;
  line-height: 0;
}

.pip-stage video,
.pip-stage img {
  display: block;
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  background: #d9e2d4;
}

.pip-stage__heatmap,
.pip-stage__box-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pip-stage__heatmap {
  opacity: 0;
  transition: opacity 140ms ease;
}

.pip-stage__heatmap.is-visible {
  opacity: 1;
}

.pip-stage__box-canvas {
  opacity: 0;
  transition: opacity 120ms ease;
}

.pip-stage__box-canvas.is-visible {
  opacity: 1;
}

.pip-stage__empty {
  padding: 18px;
  text-align: center;
  color: #5f665e;
}

.pip-stage__empty strong {
  display: block;
  margin-bottom: 6px;
  color: #213128;
}

.pip-stage__empty p,
.pip-stage-card__hint,
.pip-controls__hint,
.pip-metric p,
.pip-muted,
.pip-copy,
.pip-subtle {
  margin: 0;
}

.pip-stage-card__hint,
.pip-controls__hint,
.pip-muted,
.pip-subtle {
  color: #6c7068;
  font-size: 13px;
  line-height: 1.55;
}

.pip-controls__range {
  width: 100%;
  margin: 0;
  accent-color: #345946;
}

.pip-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.pip-metric {
  display: grid;
  gap: 4px;
  padding: 12px;
}

.pip-metric span {
  color: #6f776e;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pip-metric strong {
  color: #16231d;
  font-size: 18px;
}

.pip-metric p {
  color: #5a6158;
  font-size: 12px;
  line-height: 1.5;
}

.pip-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pip-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(39, 75, 61, 0.1);
  color: #254538;
  font-size: 12px;
  font-weight: 700;
}

.pip-copy {
  color: #1d2b23;
  font-size: 14px;
  line-height: 1.6;
}

.pip-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 0 0 18px;
  color: #22342b;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 560px) {
  .pip-header,
  .pip-stage-card__head,
  .pip-controls__head,
  .pip-panel__head {
    flex-direction: column;
  }

  .pip-stage-card__side {
    text-align: left;
  }

  .pip-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
