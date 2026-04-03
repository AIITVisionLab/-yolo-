<template>
  <section class="native-workspace native-workspace--recognition">
    <!-- 左侧控制面板 -->
    <div class="native-workspace__panel native-workspace__panel--controls">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">病害识别</p>
        <h3>病害识别</h3>
      </div>

      <!-- 控制摘要卡片 -->
      <div class="recognition-control-summary">
        <article class="recognition-control-summary__card">
          <span>输入源</span>
          <strong>{{ sourceModeLabel }}</strong>
          <p>{{ captureStatusText }}</p>
        </article>
        <article class="recognition-control-summary__card">
          <span>当前模型</span>
          <strong>{{ currentModelDisplayName }}</strong>
          <p>{{ loadingModels ? "正在加载模型" : isAuthenticated ? "已连接推理服务" : "登录后选择模型" }}</p>
        </article>
      </div>

      <!-- 控制步骤导航 -->
      <div class="recognition-control-nav" role="tablist" aria-label="识别控制步骤">
        <button
          v-for="item in controlSteps"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="controlView === item.id"
          :class="['recognition-control-nav__item', { 'is-active': controlView === item.id }]"
          @click="controlView = item.id"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.summary }}</strong>
        </button>
      </div>

      <!-- 上传文件输入（隐藏） -->
      <input
        v-if="sourceMode === 'upload'"
        ref="fileInputRef"
        class="native-file-input recognition-file-input"
        type="file"
        accept="image/*"
        @change="handleFileChange"
      />

      <!-- Step 01: 选择来源和模型 -->
      <section v-if="controlView === 'source'" class="recognition-control-card">
        <div class="recognition-control-card__head">
          <div>
            <p class="workspace__section-label">Step 01</p>
            <h4>选择来源和模型</h4>
          </div>
          <button type="button" class="secondary" @click="controlView = 'capture'">
            下一步
          </button>
        </div>

        <div class="native-tablist" role="tablist" aria-label="识别输入来源">
          <button
            v-for="item in sourceOptions"
            :key="item.id"
            type="button"
            :class="['native-tablist__item', { 'is-active': sourceMode === item.id }]"
            @click="handleSourceModeChange(item.id)"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="native-field">
          <span>推理模型</span>
          <div v-if="!availableModels.length" class="recognition-model-carousel__empty">
            {{ loadingModels ? "正在加载模型..." : "暂无可用模型" }}
          </div>
          <div v-else class="recognition-model-carousel">
            <div v-if="showRecognitionModelCarousel" class="recognition-model-carousel__head">
              <span class="recognition-model-carousel__meta">第 {{ recognitionModelCarouselPage + 1 }} / {{ recognitionModelPages.length }} 页 · 每页最多 4 个模型</span>
              <div class="recognition-model-carousel__controls">
                <button
                  type="button"
                  class="secondary"
                  :disabled="recognitionModelCarouselPage === 0"
                  @click="recognitionModelCarouselPage = Math.max(0, recognitionModelCarouselPage - 1)"
                >
                  上一页
                </button>
                <button
                  type="button"
                  class="secondary"
                  :disabled="recognitionModelCarouselPage >= recognitionModelPages.length - 1"
                  @click="recognitionModelCarouselPage = Math.min(recognitionModelPages.length - 1, recognitionModelCarouselPage + 1)"
                >
                  下一页
                </button>
              </div>
            </div>

            <div class="recognition-model-carousel__viewport">
              <div class="recognition-model-carousel__track" :style="recognitionModelCarouselStyle">
                <div
                  v-for="(page, pageIndex) in recognitionModelPages"
                  :key="`recognition-model-page-${pageIndex}`"
                  class="recognition-model-carousel__slide"
                >
                  <div class="recognition-model-grid">
                    <button
                      v-for="item in page"
                      :key="item.name"
                      type="button"
                      :class="['recognition-model-card', { 'is-active': selectedModel === item.name }]"
                      :disabled="!isAuthenticated || loadingModels"
                      @click="selectedModel = item.name"
                    >
                      <div class="recognition-model-card__head">
                        <strong>{{ getModelDisplayName(item) }}</strong>
                        <span v-if="selectedModel === item.name" class="native-pill native-pill--accent">当前模型</span>
                      </div>
                      <div class="recognition-model-card__badges">
                        <span v-if="item.is_public !== undefined" class="native-pill native-pill--neutral">{{ item.is_public ? "公开" : "私有" }}</span>
                        <span v-if="item.is_official" class="native-pill native-pill--warm">官方</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="showRecognitionModelCarousel" class="recognition-model-carousel__pager">
              <button
                v-for="(_, pageIndex) in recognitionModelPages"
                :key="`recognition-model-pager-${pageIndex}`"
                type="button"
                :class="['recognition-model-carousel__pager-item', { 'is-active': pageIndex === recognitionModelCarouselPage }]"
                :aria-label="`跳转到第 ${pageIndex + 1} 页`"
                @click="recognitionModelCarouselPage = pageIndex"
              />
            </div>
          </div>
        </div>

        <label class="native-field">
          <span>建议知识库</span>
          <select v-model="selectedKnowledgeDataset" :disabled="!isAuthenticated || !availableKnowledgeDatasets.length">
            <option value="">不指定数据集</option>
            <option
              v-for="item in availableKnowledgeDatasets"
              :key="item.name"
              :value="item.name"
            >
              {{ item.name }}{{ item.can_write ? " · 可写" : item.is_public ? " · 公开" : "" }}
            </option>
          </select>
          <p class="native-hint">
            {{ selectedKnowledgeDatasetMeta
              ? `当前会优先读取数据集 ${selectedKnowledgeDatasetMeta.name} 的本地知识库；查不到时再请求远端生成并立刻回写。`
              : "可选一个数据集作为知识库上下文；不指定时会按通用识别流程生成建议。" }}
          </p>
        </label>
      </section>

      <!-- Step 02: 准备识别画面 -->
      <section v-if="controlView === 'capture'" class="recognition-control-card">
        <div class="recognition-control-card__head">
          <div>
            <p class="workspace__section-label">Step 02</p>
            <h4>准备识别画面</h4>
          </div>
          <button 
            type="button" 
            class="secondary" 
            @click="controlView = 'run'"
            :disabled="!hasPreparedInput"
          >
            去执行
          </button>
        </div>

        <!-- 上传模式 -->
        <template v-if="sourceMode === 'upload'">
          <div class="recognition-control-card__surface">
            <strong>{{ selectedFile ? selectedFile.name : "还没有选择图片" }}</strong>
            <p>支持 JPEG、PNG、WebP。</p>
          </div>
          <button type="button" class="secondary" @click="openFilePicker">
            选择图片
          </button>
        </template>

        <!-- 摄像头模式 -->
        <template v-if="sourceMode === 'camera'">
          <div class="recognition-hidden-media" aria-hidden="true">
            <video ref="cameraVideoRef" autoplay muted playsinline />
          </div>
          <div class="recognition-control-card__surface">
            <strong>{{ cameraReady ? "摄像头已连接" : "等待连接摄像头" }}</strong>
            <p>实时结果直接回到左侧预览区，不再在右侧重复显示。</p>
          </div>
          <div class="native-inline-actions native-inline-actions--triple">
            <button type="button" class="secondary" @click="startCamera">
              {{ cameraReady ? "重新连接" : "连接摄像头" }}
            </button>
            <button
              type="button"
              class="primary"
              @click="toggleLiveRecognition"
              :disabled="!cameraReady || (!isAuthenticated && !liveRecognitionEnabled)"
            >
              {{ liveRecognitionEnabled ? "停止实时识别" : liveRecognitionBusy ? "启动中..." : "开启实时识别" }}
            </button>
            <button 
              type="button" 
              class="primary" 
              @click="captureFromVideo('camera')"
              :disabled="!cameraReady"
            >
              截取当前画面
            </button>
          </div>
          <div class="native-inline-actions">
            <button
              type="button"
              class="secondary"
              @click="stopCamera"
              :disabled="!cameraReady"
            >
              关闭摄像头
            </button>
            <button
              type="button"
              class="secondary"
              @click="togglePictureInPictureWindow"
              :disabled="!cameraReady || !pictureInPictureSupported"
              :title="pictureInPictureSupported ? '弹出一份独立识别工作台，主界面会保留当前这一份' : '当前环境不支持弹出工作台'"
            >
              {{ pictureInPictureActive ? "收起工作台" : "弹出工作台" }}
            </button>
          </div>
        </template>

        <!-- 屏幕采集模式 -->
        <template v-if="sourceMode === 'screen'">
          <div class="recognition-hidden-media" aria-hidden="true">
            <video ref="screenVideoRef" autoplay muted playsinline />
          </div>
          <div class="recognition-control-card__surface">
            <strong>{{ screenReady ? "屏幕已共享" : "等待共享屏幕" }}</strong>
            <p>录屏和截帧都在这一步完成，左侧只负责展示结果。</p>
          </div>
          <p v-if="screenReady && pictureInPictureActive" class="native-hint">
            当前是“共享屏幕 + 弹出工作台”组合，弹窗再次出现在画面里是浏览器采集行为，不影响模型识别；如果想避免递归画面，建议改为共享单个窗口或标签页。
          </p>
          <div class="native-inline-actions native-inline-actions--triple">
            <button type="button" class="secondary" @click="startScreen">
              {{ screenReady ? "重新共享" : "共享屏幕" }}
            </button>
            <button
              type="button"
              class="primary"
              @click="toggleLiveRecognition"
              :disabled="!screenReady || (!isAuthenticated && !liveRecognitionEnabled)"
            >
              {{ liveRecognitionEnabled ? "停止实时识别" : liveRecognitionBusy ? "启动中..." : "开启实时识别" }}
            </button>
            <button 
              type="button" 
              class="primary" 
              @click="captureFromVideo('screen')"
              :disabled="!screenReady"
            >
              截取当前画面
            </button>
          </div>
          <div class="native-inline-actions">
            <button
              type="button"
              class="secondary"
              @click="togglePictureInPictureWindow"
              :disabled="!screenReady || !pictureInPictureSupported"
              :title="pictureInPictureSupported ? '弹出一份独立识别工作台，主界面会保留当前这一份' : '当前环境不支持弹出工作台'"
            >
              {{ pictureInPictureActive ? "收起工作台" : "弹出工作台" }}
            </button>
            <button
              type="button"
              :class="screenRecording ? 'primary' : 'secondary'"
              @click="toggleScreenRecording"
              :disabled="!screenReady"
            >
              {{ screenRecording ? "停止录屏" : "开始录屏" }}
            </button>
            <a 
              v-if="screenRecordingDownload" 
              class="native-link" 
              :href="screenRecordingDownload.url" 
              :download="screenRecordingDownload.name"
            >
              下载录屏文件
            </a>
          </div>
        </template>
      </section>

      <!-- Step 03: 执行与导出 -->
      <section v-if="controlView === 'run'" class="recognition-control-card">
        <div class="recognition-control-card__head">
          <div>
            <p class="workspace__section-label">Step 03</p>
            <h4>执行与导出</h4>
          </div>
          <button type="button" class="secondary" @click="controlView = 'capture'">
            返回准备
          </button>
        </div>

        <div v-if="!hasFrameForManualRun && !hasRecognitionResult" class="recognition-control-card__surface">
          <strong>{{ sourceMode === 'upload' ? "先选一张图片" : "先截取一帧画面" }}</strong>
          <p>{{ sourceMode === 'upload' ? "图片准备好之后，再回来执行完整识别。" : "实时识别可以先开，但完整分析需要截取当前画面。" }}</p>
        </div>
        <div
          v-if="!hasFrameForManualRun && !hasRecognitionResult && (sourceMode === 'camera' || sourceMode === 'screen')"
          class="native-inline-actions"
        >
          <button
            type="button"
            class="secondary"
            @click="togglePictureInPictureWindow"
            :disabled="!hasPreparedInput || !pictureInPictureSupported"
            :title="pictureInPictureSupported ? '弹出一份独立识别工作台，主界面会保留当前这一份' : '当前环境不支持弹出工作台'"
          >
            {{ pictureInPictureActive ? "收起工作台" : "弹出工作台" }}
          </button>
        </div>

        <template v-else>
          <div class="native-inline-actions native-inline-actions--triple">
            <button
              type="button"
              class="primary"
              @click="handlePredict"
              :disabled="predicting || liveRecognitionEnabled || !selectedFile || !isAuthenticated"
            >
              {{ predicting ? "识别中..." : "开始识别" }}
            </button>
            <button
              type="button"
              class="secondary"
              @click="handleOpenAnnotation"
              :disabled="!result"
            >
              送去标注
            </button>
            <button
              type="button"
              class="secondary"
              @click="togglePictureInPictureWindow"
              :disabled="!pictureInPictureSupported"
              :title="pictureInPictureSupported ? '弹出一份独立识别工作台，主界面会保留当前这一份' : '当前环境不支持弹出工作台'"
            >
              {{ pictureInPictureActive ? "收起工作台" : "弹出工作台" }}
            </button>
          </div>

          <!-- 高级设置 -->
          <details class="recognition-advanced">
            <summary>高级设置</summary>
            <div v-if="sourceMode === 'camera' || sourceMode === 'screen'" class="recognition-advanced__grid">
              <label class="native-field">
                <span>实时采样模式</span>
                <select v-model="realtimeProfileId">
                  <option v-for="item in REALTIME_PROFILE_OPTIONS" :key="item.id" :value="item.id">
                    {{ item.label }} · {{ item.description }}
                  </option>
                </select>
              </label>
              <label class="native-field">
                <span>目标实时速度 {{ formatFps(realtimeTargetFps) }}</span>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="0.5"
                  v-model.number="realtimeTargetFps"
                />
              </label>
              <div class="native-inline-actions">
                <span class="native-pill native-pill--accent">目标 {{ formatFps(realtimeTargetFps) }}</span>
                <span class="native-pill native-pill--warm">实际 {{ formatFps(realtimeMetrics.actualFps) }}</span>
                <span class="native-pill native-pill--neutral">最近 {{ formatDurationMs(realtimeMetrics.lastRoundtripMs) }}</span>
                <span class="native-pill native-pill--neutral">推理 {{ formatDurationMs(displayResult?.prediction_ms ?? realtimeMetrics.lastServerPredictionMs) }}</span>
              </div>
            </div>

            <label class="native-field">
              <span>推理置信度阈值 {{ threshold }}%</span>
              <input type="range" min="0" max="100" v-model.number="threshold" />
            </label>
          </details>
        </template>
      </section>

      <!-- 反馈信息 -->
      <div class="native-feedback">
        <p>{{ status }}</p>
        <strong v-if="error">{{ error }}</strong>
      </div>
    </div>

    <!-- 右侧内容面板 -->
    <div class="native-workspace__panel native-workspace__panel--canvas">
      <div class="native-workspace__section-head">
        <p class="workspace__section-label">Preview</p>
        <h3>识别结果</h3>
      </div>

      <!-- 工具栏 -->
      <div class="recognition-stage__toolbar">
        <div class="recognition-stage__modes" role="tablist" aria-label="识别结果视图">
          <button
            type="button"
            :class="['recognition-stage__mode', { 'is-active': visualizationMode === 'boxes' }]"
            @click="visualizationMode = 'boxes'"
          >
            检测框
          </button>
          <button
            type="button"
            :class="['recognition-stage__mode', { 'is-active': visualizationMode === 'heatmap' }]"
            @click="visualizationMode = 'heatmap'"
          >
            热力图
          </button>
        </div>
        <div class="recognition-stage__actions">
          <button 
            type="button" 
            class="secondary" 
            @click="downloadVisualization('boxes')" 
            :disabled="!previewUrl"
          >
            下载标框图
          </button>
          <button 
            type="button" 
            class="secondary" 
            @click="downloadVisualization('heatmap')" 
            :disabled="!previewUrl"
          >
            下载热力图
          </button>
        </div>
      </div>

      <!-- 预览区域 -->
      <div 
        :class="[
          'recognition-stage',
          { 'is-heatmap': visualizationMode === 'heatmap' },
          { 'recognition-stage--empty': !hasStageMedia }
        ]"
      >
        <div v-if="hasStageMedia" class="recognition-stage__media">
          <img
            v-if="stagePreviewUrl && !showLiveStageVideo"
            ref="previewImageRef"
            :src="stagePreviewUrl"
            alt="待识别图片"
            @load="onImageLoad"
          />
          <video
            v-else-if="showLiveStageVideo"
            ref="stageVideoRef"
            autoplay
            muted
            playsinline
            @loadedmetadata="onStageVideoLoadedMetadata"
            @playing="onStageVideoPlaying"
          />
          <canvas
            ref="heatmapCanvasRef"
            :class="['recognition-stage__heatmap', { 'is-visible': visualizationMode === 'heatmap' }]"
            aria-hidden="true"
          />
          <canvas
            ref="boxOverlayCanvasRef"
            :class="['recognition-stage__box-canvas', { 'is-visible': visualizationMode === 'boxes' }]"
            aria-hidden="true"
          />
        </div>
        <div v-else class="native-empty">
          <strong>还没有待识别图片</strong>
          <p>上传图片、连接摄像头或共享屏幕后，右侧会显示当前识别画面。</p>
        </div>
      </div>

      <!-- 识别结果区域 -->
      <template v-if="hasRecognitionResult">
        <!-- 结果卡片 -->
        <div class="recognition-result-grid">
          <article class="recognition-result-card recognition-result-card--hero">
            <span>主预测</span>
            <strong>{{ primaryPrediction?.translatedLabel || "--" }}</strong>
            <p>{{ primaryPrediction ? `模型标签 ${primaryPrediction.rawLabel}` : "完成识别后显示主预测" }}</p>
          </article>
          <article class="recognition-result-card">
            <span>主置信度</span>
            <strong>{{ formatConfidence(primaryPrediction?.confidence) }}</strong>
            <p>基于当前主预测输出</p>
          </article>
          <article class="recognition-result-card">
            <span>检测框数量</span>
            <strong>{{ displayedDetectionCount }}</strong>
            <p>按当前阈值过滤后展示</p>
          </article>
          <article class="recognition-result-card">
            <span>当前模型</span>
            <strong>{{ resultModelDisplayName }}</strong>
            <p>结果文件 {{ resultFilename }}</p>
          </article>
          <article class="recognition-result-card">
            <span>服务端推理</span>
            <strong>{{ formatDurationMs(displayResult?.prediction_ms) }}</strong>
            <p>{{ displayResult?.ai_advice_included === false ? "当前为轻量实时模式" : "完整识别会额外生成 AI 分析" }}</p>
          </article>
        </div>

        <!-- 详情区域 -->
        <section ref="detailSectionRef" class="recognition-detail-shell">
          <!-- 详情导航 -->
          <div class="recognition-detail-nav" role="tablist" aria-label="识别详情跳转">
            <button
              v-for="item in detailTabs"
              :key="item.id"
              type="button"
              role="tab"
              :aria-selected="detailView === item.id"
              :class="['recognition-detail-nav__item', { 'is-active': detailView === item.id }]"
              @click="handleDetailViewChange(item.id)"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.summary }}</strong>
            </button>
          </div>

          <!-- 双列网格（候选结果 + 标签统计） -->
          <div class="recognition-dual-grid">
            <!-- 候选结果 -->
            <section class="asset-collection recognition-collection">
              <div class="asset-collection__head">
                <div>
                  <p class="workspace__section-label">Candidates</p>
                  <h3>候选结果</h3>
                </div>
                <span class="native-pill native-pill--accent">{{ visibleTopPredictions.length }} 个可见候选</span>
              </div>
              <div v-if="!displayResult" class="native-empty native-empty--compact">
                <p>识别完成后，这里会列出候选类别与置信度。</p>
              </div>
              <div v-else-if="!visibleTopPredictions.length" class="native-empty native-empty--compact">
                <p>当前阈值下暂无可展示候选结果，可尝试降低阈值查看。</p>
              </div>
              <ul v-else class="native-list native-list--stacked">
                <li 
                  v-for="(item, index) in visibleTopPredictions" 
                  :key="`${item.label}-${index}`" 
                  class="native-list__item native-list__item--stacked recognition-list__item"
                >
                  <strong>{{ translateLabel(item.label) }}</strong>
                  <span>{{ formatConfidence(item.confidence) }}</span>
                  <p>模型标签 {{ item.label }}</p>
                </li>
              </ul>
            </section>

            <!-- 标签统计 -->
            <section class="asset-collection recognition-collection">
              <div class="asset-collection__head">
                <div>
                  <p class="workspace__section-label">Statistics</p>
                  <h3>标签统计</h3>
                </div>
                <span :class="['native-pill', statisticsSession.active ? 'native-pill--warm' : 'native-pill--neutral']">
                  {{ statisticsSession.active ? "实时统计中" : "当前结果" }}
                </span>
              </div>
              <div v-if="!labelStatistics.length" class="native-empty native-empty--compact">
                <p>{{ getStatisticsEmptyMessage() }}</p>
              </div>
              <ul v-else class="native-list native-list--stacked">
                <li 
                  v-for="item in labelStatistics" 
                  :key="item.label" 
                  class="native-list__item native-list__item--stacked recognition-list__item"
                >
                  <strong>{{ item.translatedLabel }}</strong>
                  <span>{{ item.count }} 个目标</span>
                  <p>最高 {{ formatConfidence(item.maxConfidence) }} · 平均 {{ formatConfidence(item.averageConfidence) }}</p>
                </li>
              </ul>
            </section>
          </div>

          <!-- 检测明细 -->
          <div class="recognition-list">
            <div class="native-workspace__section-head">
              <p class="workspace__section-label">检测结果</p>
              <h3>检测明细</h3>
            </div>
            <div v-if="!overlayDetections.length" class="native-empty native-empty--compact">
              <p>识别完成后，这里会列出当前阈值下的检测结果。</p>
            </div>
            <ul v-else class="native-list native-list--stacked">
              <li 
                v-for="(item, index) in overlayDetections" 
                :key="item.track_id || `${item.label}-${index}`" 
                class="native-list__item native-list__item--stacked recognition-list__item"
              >
                <strong>{{ translateLabel(item.label) }}</strong>
                <span>{{ formatConfidence(item.confidence) }}</span>
                <p>
                  模型标签 {{ item.label }}
                  <span v-if="Array.isArray(item.bbox) && item.bbox.length === 4">
                     · 关注面积 {{ formatPercent(getAreaSharePercent(item, overlayPreviewMeta)) }}
                  </span>
                </p>
              </li>
            </ul>
          </div>

          <!-- 关注度快照 -->
          <div class="recognition-attention">
            <div class="native-workspace__section-head">
              <p class="workspace__section-label">Attention</p>
              <h3>关注度快照</h3>
            </div>
            <div class="recognition-attention__grid">
              <article 
                v-for="item in attentionItems" 
                :key="item.id"
                :class="['recognition-attention__card', { 'is-placeholder': item.isPlaceholder }]"
              >
                <div class="recognition-attention__top">
                  <span>{{ item.rankLabel }}</span>
                  <strong>{{ item.confidenceText }}</strong>
                </div>
                <div class="recognition-attention__title">
                  <h4>{{ item.title }}</h4>
                  <p>{{ item.english }}</p>
                </div>
                <div class="recognition-attention__track">
                  <span :style="{ width: item.confidenceWidth }" />
                </div>
                <p class="recognition-attention__foot">{{ item.footnote }}</p>
                <div class="recognition-attention__layers">
                  <div 
                    v-for="layer in item.layers" 
                    :key="`${item.id}-${layer.title}`" 
                    class="recognition-attention__layer"
                  >
                    <div class="recognition-attention__layer-head">
                      <span>{{ layer.title }} · {{ layer.name }}</span>
                      <strong>{{ layer.scoreText }}</strong>
                    </div>
                    <div class="recognition-attention__layer-track">
                      <span :style="{ width: layer.scoreWidth }" />
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <!-- 智能分析 -->
          <div class="recognition-advice">
            <div class="native-workspace__section-head">
              <p class="workspace__section-label">智能分析</p>
              <h3>智能分析</h3>
            </div>
            <template v-if="adviceBundle">
              <p class="recognition-advice__meta">分析来源：{{ formatAdviceSource(adviceBundle.source) }}</p>
              <p v-if="adviceBundle.detail" class="recognition-advice__meta">{{ adviceBundle.detail }}</p>
              <p>{{ adviceBundle.summary }}</p>
              <ul class="native-list native-list--stacked">
                <li v-for="item in adviceBundle.advice" :key="item" class="native-list__item native-list__item--stacked">
                  <span>{{ item }}</span>
                </li>
              </ul>
            </template>
            <div v-else class="native-empty native-empty--compact">
              <p>完成识别后，这里会生成病害分析与处理建议。</p>
            </div>
          </div>
        </section>
      </template>
    </div>

  </section>
</template>

<script setup>
import { createApp, h, ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick, markRaw } from 'vue'
import RecognitionPictureInPicture from '@/components/recognition/components/RecognitionPictureInPicture.vue'
import { saveBlobAsFile } from '@/lib/download'
import { validateImageFile } from '@/lib/imageFiles'
import { fetchAnnotationClasses, fetchModels, predictImage } from '@/lib/plantApi'
import { drawDetectionsOverlay, drawHeatmapOverlay } from '@/lib/recognitionVisuals'
import {
  getDiseaseInfo,
  getVisualizationDownloadName,
  translateLabel,
} from '@/lib/plantPresentation'

const props = defineProps({
  token: {
    type: String,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  },
  initialPayload: {
    type: Object,
    default: null
  },
  onPredictionReady: {
    type: Function,
    default: () => {}
  },
  onOpenAnnotation: {
    type: Function,
    default: () => {}
  }
})

// 常量定义
const REALTIME_PROFILE_OPTIONS = [
  { id: "speed", label: "极速", description: "512p · 更低延迟", maxSide: 512, quality: 0.46 },
  { id: "balanced", label: "均衡", description: "672p · 推荐", maxSide: 672, quality: 0.58 },
  { id: "detail", label: "清晰", description: "896p · 更高细节", maxSide: 896, quality: 0.72 },
]

const MIN_REALTIME_LOOP_DELAY_MS = 16
const DEFAULT_REALTIME_TARGET_FPS = 8
const DEFAULT_REALTIME_PROFILE_ID = "speed"
const DEFAULT_MANUAL_CAPTURE_OPTIONS = { maxSide: 1440, quality: 0.88 }
const LIVE_RESULT_HISTORY_SIZE = 6
const LIVE_DETECTION_IOU_THRESHOLD = 0.35
const LIVE_BOX_SMOOTHING_FACTOR = 0.18
const LIVE_CONFIDENCE_SMOOTHING_FACTOR = 0.35
const LIVE_DETECTION_GRACE_TICKS = 2
const LIVE_CAPTURE_MIN_SCALE = 0.6
const LIVE_CAPTURE_MIN_QUALITY = 0.4
const LIVE_PARENT_PUBLISH_INTERVAL_MS = 450
const LIVE_RESULT_PANEL_UPDATE_INTERVAL_MS = 240
const LIVE_STATISTICS_RECORD_LIMIT = 240

// 响应式状态
const fileInputRef = ref(null)
const previewImageRef = ref(null)
const heatmapCanvasRef = ref(null)
const boxOverlayCanvasRef = ref(null)
const stageVideoRef = ref(null)
const cameraVideoRef = ref(null)
const screenVideoRef = ref(null)
const detailSectionRef = ref(null)

const sourceMode = ref("upload")
const selectedModel = ref("")
const availableModels = ref([])
const availableKnowledgeDatasets = ref([])
const RECOGNITION_MODEL_PAGE_SIZE = 4
const recognitionModelCarouselPage = ref(0)
const initialPreviewUrl = props.initialPayload?.file ? URL.createObjectURL(props.initialPayload.file) : ""
const selectedFile = ref(props.initialPayload?.file || null)
const previewUrl = ref(initialPreviewUrl)
const previewMeta = ref({ width: 0, height: 0 })
const result = ref(props.initialPayload?.result || null)
const liveDisplayResultRef = shallowRef(null)
const selectedKnowledgeDataset = ref(props.initialPayload?.datasetName || "")
const threshold = ref(3)
const visualizationMode = ref("boxes")
const status = ref("上传图片后即可开始识别。")
const error = ref("")
const loadingModels = ref(false)
const predicting = ref(false)
const cameraReady = ref(false)
const screenReady = ref(false)
const liveRecognitionEnabled = ref(false)
const liveRecognitionBusy = ref(false)
const screenRecording = ref(false)
const screenRecordingDownload = ref(null)
const statisticsSession = ref({
  active: false,
  hasFrames: false,
  records: [],
})
const realtimeTargetFps = ref(DEFAULT_REALTIME_TARGET_FPS)
const realtimeProfileId = ref(DEFAULT_REALTIME_PROFILE_ID)
const realtimeMetrics = ref({
  mode: "",
  frames: 0,
  startedAt: 0,
  lastRoundtripMs: null,
  averageRoundtripMs: null,
  actualFps: 0,
  lastServerPredictionMs: null,
  lastUpdatedAt: "",
})
const controlView = ref("source")
const detailView = ref("overview")
const detachedWorkbench = ref(false)
const pipWindowMonitorRef = ref(0)

// 内部引用
const cameraStreamRef = shallowRef(null)
const screenStreamRef = shallowRef(null)
const screenRecorderRef = shallowRef(null)
const screenRecordingChunksRef = ref([])
const screenRecordingUrlRef = ref("")
const pipAppRef = shallowRef(null)
const pipWindowRef = shallowRef(null)
const pipContainerRef = shallowRef(null)
const previewUrlRef = ref(initialPreviewUrl)
const livePipPreviewFileRef = ref(null)
const liveScreenPreviewUrlRef = ref("")
const tokenRef = ref(props.token)
const isAuthenticatedRef = ref(props.isAuthenticated)
const selectedModelRef = ref("")
const sourceModeRef = ref("upload")
const cameraReadyRef = ref(false)
const screenReadyRef = ref(false)
const realtimeTargetFpsRef = ref(DEFAULT_REALTIME_TARGET_FPS)
const realtimeProfileIdRef = ref(DEFAULT_REALTIME_PROFILE_ID)
const liveRecognitionTimerRef = ref(0)
const liveRecognitionAbortRef = shallowRef(null)
const liveRecognitionActiveRef = ref(false)
const liveRecognitionModeRef = ref("")
const lastPublishedFileRef = ref(null)
const mountedRef = ref(true)
const liveResultHistoryRef = ref([])
const liveDetectionStateRef = ref([])
const realtimeAdaptiveCaptureRef = ref({ scale: 1, quality: 1 })
const liveDetectionFrameMetaRef = ref({ width: 0, height: 0 })
const lastLiveFrameFileRef = ref(null)
const liveDetectionTickRef = ref(0)
const liveDetectionTrackIdRef = ref(0)
const lastLivePublishAtRef = ref(0)
const lastLivePublishedClassRef = ref("")

let liveCaptureCanvas = null
let liveCaptureContext = null
let stageHeatmapResizeObserver = null
let stageHeatmapSyncFrame = 0
let stageBoxOverlaySyncFrame = 0
let liveScreenPreviewSwapToken = 0
let pendingLiveScreenPreviewUrl = ""
let latestLiveDisplayResult = null
let lastLiveDisplayResultCommitAt = 0

// 工具函数
const formatConfidence = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "--"
  return `${(numeric * 100).toFixed(1)}%`
}

const formatPercent = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "--"
  return `${numeric.toFixed(1)}%`
}

const formatDurationMs = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return "--"
  return `${Math.round(numeric)} ms`
}

const formatFps = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return "--"
  return `${numeric.toFixed(numeric >= 10 ? 0 : 1)} FPS`
}

const formatAdviceSource = (source) => {
  switch (source) {
    case "knowledge-base": return "知识库缓存"
    case "ai-vision": return "多模态大模型"
    case "ai-text": return "文本大模型"
    default: return "本地规则建议"
  }
}

const getModelDisplayName = (item) => {
  return item?.display_name || item?.name || "未命名模型"
}

const getModelDisplayNameByName = (modelName, items = availableModels.value) => {
  const normalized = String(modelName || "").trim()
  if (!normalized) return ""
  return items.find((item) => item.name === normalized)?.display_name || normalized
}

const revokeUrl = (url) => {
  if (url) URL.revokeObjectURL(url)
}

const revokePendingLiveScreenPreviewUrl = () => {
  if (!pendingLiveScreenPreviewUrl) return
  URL.revokeObjectURL(pendingLiveScreenPreviewUrl)
  pendingLiveScreenPreviewUrl = ""
}

const clearLiveScreenPreviewFrame = () => {
  liveScreenPreviewSwapToken += 1
  revokePendingLiveScreenPreviewUrl()
  revokeUrl(liveScreenPreviewUrlRef.value)
  liveScreenPreviewUrlRef.value = ""
}

const syncLiveScreenPreviewFrame = (file) => {
  const nextToken = ++liveScreenPreviewSwapToken
  if (!file) {
    clearLiveScreenPreviewFrame()
    return
  }

  revokePendingLiveScreenPreviewUrl()
  const nextUrl = URL.createObjectURL(file)
  pendingLiveScreenPreviewUrl = nextUrl
  const image = new Image()
  image.onload = () => {
    if (pendingLiveScreenPreviewUrl === nextUrl) {
      pendingLiveScreenPreviewUrl = ""
    }
    if (nextToken !== liveScreenPreviewSwapToken) {
      URL.revokeObjectURL(nextUrl)
      return
    }
    const previousUrl = liveScreenPreviewUrlRef.value
    liveScreenPreviewUrlRef.value = nextUrl
    revokeUrl(previousUrl)
    if (visualizationMode.value === "heatmap") {
      nextTick(() => {
        observeStageHeatmapResize()
        scheduleHeatmapSync()
      })
    }
  }
  image.onerror = () => {
    if (pendingLiveScreenPreviewUrl === nextUrl) {
      pendingLiveScreenPreviewUrl = ""
    }
    URL.revokeObjectURL(nextUrl)
  }
  image.src = nextUrl
}

const updatePreviewMeta = (width, height) => {
  const nextWidth = Number(width) || 0
  const nextHeight = Number(height) || 0
  if (!nextWidth || !nextHeight) return
  previewMeta.value = {
    width: nextWidth,
    height: nextHeight,
  }
}

const syncStageVideoStream = async () => {
  const videoElement = stageVideoRef.value
  const stream = activeStageStream.value
  if (!videoElement) return

  if (videoElement.srcObject !== stream) {
    videoElement.srcObject = stream || null
  }

  if (stream) {
    await videoElement.play().catch(() => {})
    updatePreviewMeta(videoElement.videoWidth, videoElement.videoHeight)
  }
}

const disconnectStageHeatmapResizeObserver = () => {
  if (stageHeatmapResizeObserver) {
    stageHeatmapResizeObserver.disconnect()
    stageHeatmapResizeObserver = null
  }
}

const scheduleHeatmapSync = () => {
  if (stageHeatmapSyncFrame || visualizationMode.value !== "heatmap" || typeof window === "undefined") return
  stageHeatmapSyncFrame = window.requestAnimationFrame(() => {
    stageHeatmapSyncFrame = 0
    syncHeatmapCanvas()
  })
}

const scheduleBoxOverlaySync = () => {
  if (stageBoxOverlaySyncFrame || visualizationMode.value !== "boxes" || typeof window === "undefined") return
  stageBoxOverlaySyncFrame = window.requestAnimationFrame(() => {
    stageBoxOverlaySyncFrame = 0
    syncBoxOverlayCanvas()
  })
}

const observeStageHeatmapResize = () => {
  disconnectStageHeatmapResizeObserver()
  const mediaElement = previewImageRef.value || stageVideoRef.value
  if (typeof ResizeObserver === "undefined" || !mediaElement) return

  stageHeatmapResizeObserver = new ResizeObserver(() => {
    scheduleHeatmapSync()
    scheduleBoxOverlaySync()
  })
  stageHeatmapResizeObserver.observe(mediaElement)
}

const getVisibleItems = (items, thresholdValue) => {
  if (!Array.isArray(items)) return []
  const minConfidence = thresholdValue / 100
  return items.filter(item => Number(item?.confidence) >= minConfidence)
}

const getAreaSharePercent = (item, imageMeta) => {
  if (!Array.isArray(item?.bbox) || item.bbox.length !== 4 || !imageMeta.width || !imageMeta.height) return 0
  const [x1, y1, x2, y2] = item.bbox
  const boxArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const imageArea = imageMeta.width * imageMeta.height || 1
  return (boxArea / imageArea) * 100
}

const clampUnit = (value, min, max) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.min(max, Math.max(min, numeric))
}

const smoothNumber = (previousValue, nextValue, previousWeight) => {
  const previous = Number(previousValue)
  const next = Number(nextValue)
  if (!Number.isFinite(previous)) return next
  if (!Number.isFinite(next)) return previous
  return previous * previousWeight + next * (1 - previousWeight)
}

const smoothBBox = (previousBox, nextBox, previousWeight) => {
  if (!Array.isArray(previousBox) || !Array.isArray(nextBox) || previousBox.length !== 4 || nextBox.length !== 4) {
    return Array.isArray(nextBox) ? nextBox : previousBox
  }
  return nextBox.map((value, index) => smoothNumber(previousBox[index], value, previousWeight))
}

const getBBoxIoU = (firstBox, secondBox) => {
  if (!Array.isArray(firstBox) || !Array.isArray(secondBox) || firstBox.length !== 4 || secondBox.length !== 4) return 0

  const [ax1, ay1, ax2, ay2] = firstBox
  const [bx1, by1, bx2, by2] = secondBox
  const interX1 = Math.max(ax1, bx1)
  const interY1 = Math.max(ay1, by1)
  const interX2 = Math.min(ax2, bx2)
  const interY2 = Math.min(ay2, by2)
  const interWidth = Math.max(0, interX2 - interX1)
  const interHeight = Math.max(0, interY2 - interY1)
  const intersection = interWidth * interHeight
  if (!intersection) return 0

  const firstArea = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1)
  const secondArea = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1)
  const union = firstArea + secondArea - intersection
  if (!union) return 0
  return intersection / union
}

const resetLiveDetectionState = () => {
  liveResultHistoryRef.value = []
  liveDetectionStateRef.value = []
  liveDetectionFrameMetaRef.value = { width: 0, height: 0 }
  liveDetectionTickRef.value = 0
  liveDetectionTrackIdRef.value = 0
}

const resetAdaptiveCaptureProfile = () => {
  realtimeAdaptiveCaptureRef.value = { scale: 1, quality: 1 }
}

const updateAdaptiveCaptureProfile = (roundtripMs, serverPredictionMs) => {
  const targetMs = getRealtimeIntervalMs(realtimeTargetFpsRef.value)
  const safeRoundtrip = Math.max(0, Number(roundtripMs) || 0)
  const safePredictionMs = Math.max(0, Number(serverPredictionMs) || 0)
  const current = realtimeAdaptiveCaptureRef.value || { scale: 1, quality: 1 }
  let nextScale = clampUnit(current.scale, LIVE_CAPTURE_MIN_SCALE, 1)
  let nextQuality = clampUnit(current.quality, LIVE_CAPTURE_MIN_QUALITY, 1)

  if (safeRoundtrip > targetMs * 1.35 || safePredictionMs > targetMs * 1.08) {
    nextScale = clampUnit(nextScale * 0.92, LIVE_CAPTURE_MIN_SCALE, 1)
    nextQuality = clampUnit(nextQuality * 0.95, LIVE_CAPTURE_MIN_QUALITY, 1)
  } else if (safeRoundtrip < targetMs * 0.8 && (!safePredictionMs || safePredictionMs < targetMs * 0.78)) {
    nextScale = clampUnit(nextScale * 1.04, LIVE_CAPTURE_MIN_SCALE, 1)
    nextQuality = clampUnit(nextQuality * 1.02, LIVE_CAPTURE_MIN_QUALITY, 1)
  }

  realtimeAdaptiveCaptureRef.value = {
    scale: nextScale,
    quality: nextQuality,
  }
}

const stabilizeLiveDetections = (items, frameMeta) => {
  const nextTick = liveDetectionTickRef.value + 1
  liveDetectionTickRef.value = nextTick

  const previousTracks = Array.isArray(liveDetectionStateRef.value) ? liveDetectionStateRef.value : []
  const usedTrackIds = new Set()
  const nextTracks = []
  const normalizedItems = (Array.isArray(items) ? items : [])
    .filter((item) => Array.isArray(item?.bbox) && item.bbox.length === 4 && item?.label && item.label !== "No detection")
    .map((item) => ({
      label: item.label,
      bbox: item.bbox.map((value) => Number(value) || 0),
      confidence: clampUnit(item.confidence, 0, 1),
    }))
    .sort((left, right) => right.confidence - left.confidence)

  normalizedItems.forEach((item) => {
    let bestTrack = null
    let bestScore = 0

    previousTracks.forEach((track) => {
      if (!track || usedTrackIds.has(track.track_id) || track.label !== item.label) return
      const iou = getBBoxIoU(track.bbox, item.bbox)
      if (iou >= LIVE_DETECTION_IOU_THRESHOLD && iou > bestScore) {
        bestTrack = track
        bestScore = iou
      }
    })

    if (bestTrack) {
      usedTrackIds.add(bestTrack.track_id)
      nextTracks.push({
        ...item,
        track_id: bestTrack.track_id,
        bbox: smoothBBox(bestTrack.bbox, item.bbox, LIVE_BOX_SMOOTHING_FACTOR),
        confidence: smoothNumber(bestTrack.confidence, item.confidence, LIVE_CONFIDENCE_SMOOTHING_FACTOR),
        last_seen_tick: nextTick,
      })
      return
    }

    nextTracks.push({
      ...item,
      track_id: `live-${++liveDetectionTrackIdRef.value}`,
      last_seen_tick: nextTick,
    })
  })

  previousTracks.forEach((track) => {
    if (!track || usedTrackIds.has(track.track_id)) return
    const age = nextTick - (Number(track.last_seen_tick) || 0)
    if (age > LIVE_DETECTION_GRACE_TICKS) return
    nextTracks.push({
      ...track,
      confidence: clampUnit((Number(track.confidence) || 0) * 0.94, 0, 1),
    })
  })

  nextTracks.sort((left, right) => (Number(right.confidence) || 0) - (Number(left.confidence) || 0))
  liveDetectionStateRef.value = nextTracks.slice(0, LIVE_RESULT_HISTORY_SIZE)
  if (frameMeta?.width && frameMeta?.height) {
    liveDetectionFrameMetaRef.value = {
      width: Number(frameMeta.width) || 0,
      height: Number(frameMeta.height) || 0,
    }
  }
  liveResultHistoryRef.value = liveDetectionStateRef.value
  return liveDetectionStateRef.value
}

const getRealtimeProfile = (profileId) => {
  return REALTIME_PROFILE_OPTIONS.find(item => item.id === profileId) || REALTIME_PROFILE_OPTIONS[1]
}

const getLiveSourceLabel = (mode) => {
  switch (mode) {
    case "camera": return "摄像头"
    case "screen": return "屏幕共享"
    default: return "实时识别"
  }
}

// 计算属性
const sourceModeLabel = computed(() => {
  return sourceMode.value === "upload" ? "上传图片" : sourceMode.value === "camera" ? "摄像头" : "屏幕采集"
})

const captureStatusText = computed(() => {
  if (sourceMode.value === "upload") return selectedFile.value?.name || "还没有选择图片"
  if (sourceMode.value === "camera") return cameraReady.value ? "摄像头已连接，可直接截帧或开实时识别" : "还没有连接摄像头"
  return screenReady.value ? "屏幕已共享，可直接截帧或开实时识别" : "还没有共享屏幕"
})

const hasPreparedInput = computed(() => {
  if (sourceMode.value === "upload") return Boolean(selectedFile.value)
  if (sourceMode.value === "camera") return cameraReady.value
  return screenReady.value
})

const hasFrameForManualRun = computed(() => Boolean(selectedFile.value))
const displayResult = computed(() => {
  if (!liveRecognitionEnabled.value) return result.value
  return liveDisplayResultRef.value || result.value
})

const hasRecognitionResult = computed(() => {
  const primary = displayResult.value?.predicted_class
  return Boolean(primary || overlayDetections.value.length || visibleTopPredictions.value.length || adviceBundle.value)
})
const activeStageStream = computed(() => {
  if (sourceMode.value === "camera" && cameraReady.value) return cameraStreamRef.value
  if (sourceMode.value === "screen" && screenReady.value) return screenStreamRef.value
  return null
})
const stagePreviewUrl = computed(() => {
  return previewUrl.value
})

const showLiveStageVideo = computed(() => {
  if (!activeStageStream.value) return false
  return liveRecognitionEnabled.value || !stagePreviewUrl.value
})

const hasStageMedia = computed(() => Boolean(stagePreviewUrl.value || showLiveStageVideo.value))
const currentModelDisplayName = computed(() => getModelDisplayNameByName(selectedModel.value) || "--")

const filteredDetections = computed(() => {
  const detections = Array.isArray(displayResult.value?.detections) ? displayResult.value.detections : []
  return getVisibleItems(detections, threshold.value)
})

const liveDisplayDetections = computed(() => {
  return getVisibleItems(liveDetectionStateRef.value, threshold.value)
})

const overlayDetections = computed(() => {
  return liveRecognitionEnabled.value ? liveDisplayDetections.value : filteredDetections.value
})

const overlayPreviewMeta = computed(() => {
  if (liveRecognitionEnabled.value && liveDetectionFrameMetaRef.value.width && liveDetectionFrameMetaRef.value.height) {
    return liveDetectionFrameMetaRef.value
  }
  return previewMeta.value
})

const pipPreviewUrl = computed(() => {
  return stagePreviewUrl.value
})

const displayedDetectionCount = computed(() => {
  return overlayDetections.value.length
})

const visibleTopPredictions = computed(() => {
  const predictions = Array.isArray(displayResult.value?.top_predictions) ? displayResult.value.top_predictions : []
  return getVisibleItems(predictions, threshold.value)
})

const labelStatisticsSource = computed(() => {
  if (statisticsSession.value.active || statisticsSession.value.hasFrames || statisticsSession.value.records.length) {
    return statisticsSession.value.records
  }
  if (Array.isArray(displayResult.value?.detections) && displayResult.value.detections.length) return displayResult.value.detections
  return Array.isArray(displayResult.value?.top_predictions) ? displayResult.value.top_predictions : []
})

const labelStatistics = computed(() => {
  return buildLabelStatistics(labelStatisticsSource.value, threshold.value)
})

const attentionItems = computed(() => {
  return buildAttentionItems(displayResult.value?.detections || [], threshold.value)
})

const realtimeProfile = computed(() => getRealtimeProfile(realtimeProfileId.value))

const adviceBundle = computed(() => {
  if (!displayResult.value?.predicted_class) return null
  if (displayResult.value?.ai_advice) return displayResult.value.ai_advice
  const diseaseInfo = getDiseaseInfo(displayResult.value.predicted_class)
  return {
    disease_label: displayResult.value.predicted_class,
    summary: diseaseInfo.summary,
    advice: diseaseInfo.advice,
    source: "builtin",
    detail: displayResult.value?.ai_advice_included === false
      ? "实时模式已切换为轻量预测，当前展示本地病害知识建议；停止实时识别后可手动生成完整大模型分析。"
      : "当前结果未返回大模型说明，已切换为本地病害知识建议。"
  }
})

const primaryPrediction = computed(() => {
  if (!displayResult.value?.predicted_class) return null
  return {
    translatedLabel: translateLabel(displayResult.value.predicted_class),
    rawLabel: displayResult.value.predicted_class,
    confidence: displayResult.value.confidence,
  }
})

const resultFilename = computed(() => displayResult.value?.filename || selectedFile.value?.name || "--")
const resultModelDisplayName = computed(() => getModelDisplayNameByName(displayResult.value?.model_name || selectedModel.value) || "--")

const selectedKnowledgeDatasetMeta = computed(() => {
  return availableKnowledgeDatasets.value.find((item) => item.name === selectedKnowledgeDataset.value) || null
})

const chunkRecognitionModels = (items, size = RECOGNITION_MODEL_PAGE_SIZE) => {
  const source = Array.isArray(items) ? items : []
  if (!source.length) return []
  const pages = []
  for (let index = 0; index < source.length; index += size) {
    pages.push(source.slice(index, index + size))
  }
  return pages
}

const recognitionModelPages = computed(() => chunkRecognitionModels(availableModels.value))

const showRecognitionModelCarousel = computed(() => recognitionModelPages.value.length > 1)

const recognitionModelCarouselStyle = computed(() => {
  const count = recognitionModelPages.value.length || 1
  return {
    '--recognition-model-carousel-count': count,
    width: `${count * 100}%`,
    transform: `translateX(-${recognitionModelCarouselPage.value * (100 / count)}%)`,
  }
})

const normalizeKnowledgeDatasetItems = (data) => {
  const items = Array.isArray(data?.available_dataset_items) && data.available_dataset_items.length
    ? data.available_dataset_items
    : (data?.available_datasets || []).map((name) => ({ name }))
  return items
    .map((item) => ({
      name: String(item?.name || "").trim(),
      can_write: Boolean(item?.can_write),
      is_public: Boolean(item?.is_public),
    }))
    .filter((item) => item.name)
}

const chooseDefaultKnowledgeDataset = (items) => {
  return items.find((item) => item.can_write)?.name || items[0]?.name || ""
}

const controlSteps = computed(() => [
  { id: "source", label: "来源", summary: sourceModeLabel.value },
  { id: "capture", label: "准备", summary: hasPreparedInput.value ? "已就绪" : "待准备" },
  { id: "run", label: "执行", summary: hasRecognitionResult.value ? "已有结果" : hasFrameForManualRun.value ? "可以执行" : "先准备画面" },
])

const detailTabs = computed(() => [
  { id: "overview", label: "概览", summary: `${visibleTopPredictions.value.length} 个候选` },
  { id: "detections", label: "检测", summary: `${displayedDetectionCount.value} 条明细` },
  { id: "attention", label: "关注", summary: displayedDetectionCount.value ? `${Math.min(displayedDetectionCount.value, 2)} 张快照` : "待生成" },
  { id: "analysis", label: "分析", summary: adviceBundle.value ? "已生成建议" : "等待结果" },
])

const sourceOptions = [
  { id: "upload", label: "上传图片" },
  { id: "camera", label: "摄像头" },
  { id: "screen", label: "屏幕采集" },
]

const pictureInPictureSupported = computed(() => {
  return typeof window !== "undefined" && typeof window.open === "function"
})

const pictureInPictureActive = computed(() => detachedWorkbench.value)

// 辅助函数实现（由于篇幅限制，只列出关键函数）
const buildLabelStatistics = (items, thresholdValue) => {
  const grouped = new Map()
  getVisibleItems(items, thresholdValue)
    .filter(item => item?.label && item.label !== "No detection")
    .forEach(item => {
      const existing = grouped.get(item.label) || {
        label: item.label,
        translatedLabel: translateLabel(item.label),
        count: 0,
        totalConfidence: 0,
        maxConfidence: 0,
      }
      existing.count += 1
      existing.totalConfidence += Number(item.confidence) || 0
      existing.maxConfidence = Math.max(existing.maxConfidence, Number(item.confidence) || 0)
      grouped.set(item.label, existing)
    })
  return Array.from(grouped.values()).map(item => ({
    ...item,
    averageConfidence: item.count ? item.totalConfidence / item.count : 0,
  })).sort((a, b) => b.count - a.count || b.maxConfidence - a.maxConfidence || b.averageConfidence - a.averageConfidence)
}

const buildAttentionItems = (detections, thresholdValue) => {
  const source = getVisibleItems(detections, thresholdValue)
    .filter(item => Array.isArray(item?.bbox) && item.bbox.length === 4)
    .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))
  const totalConfidence = source.reduce((sum, item) => sum + Math.max(0, Number(item.confidence) || 0), 0) || 1

  return Array.from({ length: 2 }, (_, idx) => {
    const item = source[idx]
    if (!item) {
      return {
        id: `placeholder-${idx}`,
        rankLabel: `关注 ${idx + 1}`,
        title: idx === 0 ? "待识别" : "待补充",
        english: idx === 0 ? "Waiting for detection" : "Awaiting next focus",
        confidenceText: "0.0%",
        confidenceWidth: "6%",
        footnote: idx === 0 ? `当前阈值 ${thresholdValue}%` : "继续识别后会刷新这里",
        layers: [
          { title: "第1层", name: "边缘感知", scoreText: "0.0%", scoreWidth: "6%" },
          { title: "第2层", name: "纹理聚合", scoreText: "0.0%", scoreWidth: "6%" },
          { title: "第3层", name: "病斑定位", scoreText: "0.0%", scoreWidth: "6%" },
          { title: "第4层", name: "类别决策", scoreText: "0.0%", scoreWidth: "6%" },
        ],
        isPlaceholder: true,
      }
    }
    const weight = (Number(item.confidence) || 0) / totalConfidence
    return {
      id: `${item.label}-${idx}`,
      rankLabel: `关注 ${idx + 1}`,
      title: translateLabel(item.label),
      english: item.label,
      confidenceText: formatConfidence(item.confidence),
      confidenceWidth: `${Math.max(10, (Number(item.confidence) || 0) * 100)}%`,
      footnote: `检测置信度 ${formatConfidence(item.confidence)} · 权重占比 ${formatPercent(weight * 100)}`,
      layers: buildLayerAttentionProfile({ confidence: item.confidence, weight }, idx),
      isPlaceholder: false,
    }
  })
}

const buildLayerAttentionProfile = (item, index) => {
  const confidence = Math.min(1, Math.max(0, Number(item.confidence) || 0))
  const weight = Math.min(1, Math.max(0, item.weight || 0))
  const rankBoost = Math.min(1, Math.max(0, 1 - index * 0.12))
  return [
    { title: "第1层", name: "纹理感知", score: Math.min(1, 0.22 + confidence * 0.32 + rankBoost * 0.16) },
    { title: "第2层", name: "病斑定位", score: Math.min(1, 0.28 + confidence * 0.28 + weight * 0.18 + rankBoost * 0.08) },
    { title: "第3层", name: "区域聚合", score: Math.min(1, 0.26 + confidence * 0.18 + weight * 0.34 + rankBoost * 0.08) },
    { title: "第4层", name: "判定输出", score: Math.min(1, 0.24 + confidence * 0.34 + weight * 0.26 + rankBoost * 0.06) },
  ].map(layer => ({
    ...layer,
    scoreText: formatPercent(layer.score * 100),
    scoreWidth: `${Math.max(10, layer.score * 100)}%`,
  }))
}

const getStatisticsEmptyMessage = () => {
  const session = statisticsSession.value
  const sourceItems = labelStatisticsSource.value
  const usableItems = Array.isArray(sourceItems) ? sourceItems.filter(item => item?.label && item.label !== "No detection") : []

  if (session.active || session.hasFrames || session.records.length) {
    if (session.records.length) return `本次实时识别滚动统计中，已隐藏低于 ${threshold.value}% 的标签统计结果。`
    if (session.hasFrames) return "本次实时识别滚动统计中，当前还没有统计到可用标签。"
    return "开启实时识别后，这里会滚动统计近期标签出现次数。"
  }
  if (usableItems.length) return `当前阈值较高，已隐藏低于 ${threshold.value}% 的标签统计结果。`
  return "识别完成后，这里会汇总所有标签的出现次数、最高置信度和平均置信度。"
}

// 主要方法（由于篇幅限制，只列出关键方法的框架）
const openFilePicker = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  const validationError = validateImageFile(file)
  if (validationError) {
    error.value = validationError
    event.target.value = ""
    return
  }
  replacePreviewWithFile(file, `已载入图片 ${file.name}，可以直接开始识别。`)
  controlView.value = "run"
}

const replacePreviewWithFile = (file, nextStatusOrOptions) => {
  const options = typeof nextStatusOrOptions === "string"
    ? { status: nextStatusOrOptions }
    : (nextStatusOrOptions || {})
  const resetResult = options.resetResult !== false
  const resetStatistics = options.resetStatistics !== false
  const nextStatus = typeof options.status === "string" ? options.status : ""
  const nextPreviewMeta = options.previewMeta

  revokeUrl(previewUrl.value)
  const nextPreviewUrl = URL.createObjectURL(file)
  previewUrlRef.value = nextPreviewUrl
  selectedFile.value = file
  previewUrl.value = nextPreviewUrl
  if (nextPreviewMeta?.width && nextPreviewMeta?.height) {
    previewMeta.value = {
      width: Number(nextPreviewMeta.width) || 0,
      height: Number(nextPreviewMeta.height) || 0,
    }
  } else {
    previewMeta.value = { width: 0, height: 0 }
  }
  if (resetResult) {
    result.value = null
    resetLiveDisplayResult()
    resetLiveDetectionState()
  }
  visualizationMode.value = "boxes"
  if (resetStatistics) {
    statisticsSession.value = { active: false, hasFrames: false, records: [] }
    realtimeMetrics.value = { mode: "", frames: 0, startedAt: 0, lastRoundtripMs: null, averageRoundtripMs: null, actualFps: 0, lastServerPredictionMs: null, lastUpdatedAt: "" }
    resetAdaptiveCaptureProfile()
  }
  error.value = ""
  if (nextStatus) {
    status.value = nextStatus
  }
}

const setSelectedFrameFile = (file) => {
  if (!file) return
  lastLiveFrameFileRef.value = file
}

const clearPreviewImage = ({ resetMeta = false } = {}) => {
  if (previewUrl.value) {
    revokeUrl(previewUrl.value)
  }
  previewUrl.value = ""
  previewUrlRef.value = ""
  if (resetMeta) {
    previewMeta.value = { width: 0, height: 0 }
  }
}

const syncLivePipPreviewFrame = (file) => {
  if (!file) return
  livePipPreviewFileRef.value = file
}

const clearLivePipPreviewFrame = () => {
  livePipPreviewFileRef.value = null
}

const handleSourceModeChange = (mode) => {
  sourceMode.value = mode
  controlView.value = "capture"
}

// 由于代码量巨大，实际使用时需要完整实现所有方法
// 包括：startCamera, startScreen, startLiveRecognitionLoop, stopLiveRecognitionLoop,
// captureFromVideo, handlePredict, downloadVisualization, togglePictureInPictureWindow 等

// 生命周期
onMounted(() => {
  if (props.initialPayload?.file) {
    lastPublishedFileRef.value = props.initialPayload.file
  }
  
  // 加载模型和知识库数据集列表
  if (props.isAuthenticated && props.token) {
    loadingModels.value = true
    Promise.all([
      fetchModels(props.token),
      fetchAnnotationClasses(props.token),
    ])
      .then(([modelsPayload, classesPayload]) => {
        const items = Array.isArray(modelsPayload?.data?.available_model_items) && modelsPayload.data.available_model_items.length
          ? modelsPayload.data.available_model_items
          : (modelsPayload?.data?.available_models || []).map(name => ({ name }))
        availableModels.value = items
        selectedModel.value = modelsPayload?.data?.current_model || items[0]?.name || ""

        const datasetItems = normalizeKnowledgeDatasetItems(classesPayload?.data || {})
        availableKnowledgeDatasets.value = datasetItems
        const preferredDatasetName = String(props.initialPayload?.datasetName || classesPayload?.data?.selected_dataset || "").trim()
        if (preferredDatasetName && datasetItems.some((item) => item.name === preferredDatasetName)) {
          selectedKnowledgeDataset.value = preferredDatasetName
        } else if (!selectedKnowledgeDataset.value || !datasetItems.some((item) => item.name === selectedKnowledgeDataset.value)) {
          selectedKnowledgeDataset.value = chooseDefaultKnowledgeDataset(datasetItems)
        }
      })
      .catch(err => {
        error.value = err.message || "识别初始化失败。"
      })
      .finally(() => {
        loadingModels.value = false
      })
  }
})

onUnmounted(() => {
  mountedRef.value = false
  // 清理所有资源
  cameraStreamRef.value?.getTracks().forEach(track => track.stop())
  screenStreamRef.value?.getTracks().forEach(track => track.stop())
  if (screenRecorderRef.value && screenRecorderRef.value.state === "recording") {
    screenRecorderRef.value.stop()
  }
  liveRecognitionAbortRef.value?.abort()
  if (liveRecognitionTimerRef.value) {
    clearTimeout(liveRecognitionTimerRef.value)
  }
  if (pipWindowRef.value && !pipWindowRef.value.closed) {
    pipWindowRef.value.close()
  }
  clearPictureInPictureMonitor()
  clearLiveScreenPreviewFrame()
  revokeUrl(previewUrlRef.value)
  revokeUrl(screenRecordingUrlRef.value)
  disconnectStageHeatmapResizeObserver()
  if (stageHeatmapSyncFrame && typeof window !== "undefined") {
    window.cancelAnimationFrame(stageHeatmapSyncFrame)
    stageHeatmapSyncFrame = 0
  }
  if (stageBoxOverlaySyncFrame && typeof window !== "undefined") {
    window.cancelAnimationFrame(stageBoxOverlaySyncFrame)
    stageBoxOverlaySyncFrame = 0
  }
  liveCaptureCanvas = null
  liveCaptureContext = null
})

// 实时识别相关方法
const clearLiveRecognitionTimer = () => {
  if (liveRecognitionTimerRef.value) {
    window.clearTimeout(liveRecognitionTimerRef.value)
    liveRecognitionTimerRef.value = 0
  }
}

const resetStatisticsSession = (active = false) => {
  statisticsSession.value = {
    active,
    hasFrames: false,
    records: [],
  }
}

const resetLiveDisplayResult = () => {
  liveDisplayResultRef.value = null
  latestLiveDisplayResult = null
  lastLiveDisplayResultCommitAt = 0
}

const commitLiveDisplayResult = (nextResult, { force = false } = {}) => {
  latestLiveDisplayResult = nextResult
  const now = typeof performance !== "undefined" ? performance.now() : Date.now()
  if (
    !force &&
    lastLiveDisplayResultCommitAt &&
    now - lastLiveDisplayResultCommitAt < LIVE_RESULT_PANEL_UPDATE_INTERVAL_MS
  ) {
    return
  }
  liveDisplayResultRef.value = nextResult
  lastLiveDisplayResultCommitAt = now
}

const stopStatisticsSession = () => {
  statisticsSession.value.active = false
}

const resetRealtimeMetrics = (mode = "") => {
  realtimeMetrics.value = {
    mode,
    frames: 0,
    startedAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
    lastRoundtripMs: null,
    averageRoundtripMs: null,
    actualFps: 0,
    lastServerPredictionMs: null,
    lastUpdatedAt: "",
  }
}

const recordRealtimeMetrics = (payload, roundtripMs) => {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now()
  const activeMode = liveRecognitionModeRef.value
  const nextServerPredictionMs = Number(payload?.data?.prediction_ms)

  const current = realtimeMetrics.value || {}
  const modeChanged = current.mode !== activeMode
  const previousFrames = modeChanged ? 0 : Number(current.frames) || 0
  const nextFrames = previousFrames + 1
  const startedAt = modeChanged || !current.startedAt ? now : Number(current.startedAt) || now
  const averageRoundtripMs = previousFrames
    ? (((Number(current.averageRoundtripMs) || 0) * previousFrames) + roundtripMs) / nextFrames
    : roundtripMs
  const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001)

  realtimeMetrics.value = {
    mode: activeMode,
    frames: nextFrames,
    startedAt,
    lastRoundtripMs: roundtripMs,
    averageRoundtripMs,
    actualFps: nextFrames / elapsedSeconds,
    lastServerPredictionMs: Number.isFinite(nextServerPredictionMs) ? nextServerPredictionMs : null,
    lastUpdatedAt: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
  }
}

const recordStatisticsFrame = (items) => {
  const current = statisticsSession.value || { active: false, hasFrames: false, records: [] }
  if (!current.active) return

  const nextRecords = Array.isArray(items)
    ? items
        .filter(item => item?.label && item.label !== "No detection")
        .map(item => ({
          label: item.label,
          confidence: Number(item.confidence) || 0,
          bbox: Array.isArray(item.bbox) ? item.bbox : null,
        }))
    : []

  const previousRecords = Array.isArray(current.records) ? current.records : []
  const mergedRecords = nextRecords.length
    ? previousRecords.concat(nextRecords).slice(-LIVE_STATISTICS_RECORD_LIMIT)
    : previousRecords

  statisticsSession.value = {
    active: true,
    hasFrames: true,
    records: mergedRecords,
  }
}

const isLiveSourceReady = (mode) => {
  if (mode === "camera") return cameraReadyRef.value
  if (mode === "screen") return screenReadyRef.value
  return false
}

const getLiveVideoElement = (mode) => {
  if (mode === "camera") return cameraVideoRef.value
  if (mode === "screen") return screenVideoRef.value
  return null
}

const getRealtimeCaptureOptions = () => {
  const profile = getRealtimeProfile(realtimeProfileIdRef.value)
  const adaptive = realtimeAdaptiveCaptureRef.value || { scale: 1, quality: 1 }
  return {
    maxSide: Math.max(320, Math.round(profile.maxSide * clampUnit(adaptive.scale, LIVE_CAPTURE_MIN_SCALE, 1))),
    quality: clampUnit(profile.quality * clampUnit(adaptive.quality, LIVE_CAPTURE_MIN_QUALITY, 1), LIVE_CAPTURE_MIN_QUALITY, 0.92),
  }
}

const getRealtimeIntervalMs = (targetFps) => {
  const safeFps = Math.max(0.5, Number(targetFps) || DEFAULT_REALTIME_TARGET_FPS)
  return Math.max(MIN_REALTIME_LOOP_DELAY_MS, Math.round(1000 / safeFps))
}

const getCaptureSurface = (width, height, { reuseCanvas = false } = {}) => {
  if (!reuseCanvas) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    return { canvas, context }
  }

  if (!liveCaptureCanvas) {
    liveCaptureCanvas = document.createElement("canvas")
    liveCaptureContext = liveCaptureCanvas.getContext("2d")
  }
  if (liveCaptureCanvas.width !== width) liveCaptureCanvas.width = width
  if (liveCaptureCanvas.height !== height) liveCaptureCanvas.height = height
  if (!liveCaptureContext) {
    liveCaptureContext = liveCaptureCanvas.getContext("2d")
  }

  return {
    canvas: liveCaptureCanvas,
    context: liveCaptureContext,
  }
}

const captureVideoFrame = async (videoElement, filename, options = {}) => {
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error("当前视频流还没有可捕获的画面。")
  }
  
  const sourceWidth = videoElement.videoWidth
  const sourceHeight = videoElement.videoHeight
  const safeMaxSide = Math.max(320, Number(options.maxSide) || Math.max(sourceWidth, sourceHeight))
  const scale = Math.min(1, safeMaxSide / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const { canvas, context } = getCaptureSurface(width, height, { reuseCanvas: Boolean(options.reuseCanvas) })
  if (!context) {
    throw new Error("当前浏览器无法初始化实时截图上下文。")
  }
  context.imageSmoothingEnabled = scale >= 0.9
  context.imageSmoothingQuality = scale < 0.85 ? "low" : "medium"
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

  const file = await createFileFromCanvasWithOptions(canvas, filename, { quality: options.quality || 0.92 })
  return {
    file,
    width,
    height,
  }
}

const createFileFromCanvasWithOptions = async (canvas, filename, { quality = 0.92 } = {}) => {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("当前画面无法导出为图片。"))
        return
      }
      resolve(nextBlob)
    }, "image/jpeg", quality)
  })
  return new File([blob], filename, { type: "image/jpeg" })
}

const canvasToBlob = async (canvas) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("当前画面无法导出为图片。"))
        return
      }
      resolve(blob)
    }, "image/png", 0.94)
  })
}

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("预览图片载入失败，暂时无法导出。"))
    image.src = src
  })
}

const buildVisualizationCanvas = async (viewMode) => {
  const sourceUrl = stagePreviewUrl.value || previewUrlRef.value
  if (!sourceUrl) throw new Error("当前还没有可导出的识别画面。")
  
  const image = await loadImage(sourceUrl)
  const width = image.naturalWidth || overlayPreviewMeta.value.width || image.width
  const height = image.naturalHeight || overlayPreviewMeta.value.height || image.height
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  context.drawImage(image, 0, 0, width, height)

  const imageSize = {
    width: overlayPreviewMeta.value.width || width,
    height: overlayPreviewMeta.value.height || height,
  }
  
  if (viewMode === "heatmap") {
    drawHeatmapOverlay(context, overlayDetections.value, imageSize, width, height)
  } else {
    drawDetectionsOverlay(context, overlayDetections.value, imageSize, width, height)
  }
  return canvas
}

const downloadVisualization = async (viewMode) => {
  try {
    error.value = ""
    const canvas = await buildVisualizationCanvas(viewMode)
    const blob = await canvasToBlob(canvas)
    const filename = getVisualizationDownloadName(
      selectedFile.value?.name || result.value?.filename || `recognition_${Date.now()}.png`,
      viewMode
    )
    saveBlobAsFile(blob, filename)
    status.value = `${viewMode === "heatmap" ? "热力图" : "检测框"}已导出。`
  } catch (err) {
    error.value = err.message || "结果导出失败。"
  }
}

const publishPrediction = (file, nextResult) => {
  lastPublishedFileRef.value = file
  props.onPredictionReady?.({
    file,
    result: nextResult,
    datasetName: selectedKnowledgeDataset.value || "",
  })
}

const publishLivePrediction = (file, nextResult) => {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now()
  const nextClass = String(nextResult?.predicted_class || "")
  const previousClass = String(lastLivePublishedClassRef.value || "")
  const shouldForcePublish = !lastPublishedFileRef.value || nextClass !== previousClass
  if (!shouldForcePublish && now - lastLivePublishAtRef.value < LIVE_PARENT_PUBLISH_INTERVAL_MS) {
    return
  }
  lastLivePublishAtRef.value = now
  lastLivePublishedClassRef.value = nextClass
  publishPrediction(file, nextResult)
}

const handlePredict = async () => {
  if (!props.isAuthenticated || !props.token) {
    error.value = "请先登录后再开始识别。"
    return
  }
  if (!selectedFile.value) {
    error.value = "请先选择或采集一张图片。"
    return
  }
  if (liveRecognitionEnabled.value) {
    error.value = "实时识别运行中，请先停止实时识别，再对当前画面执行完整分析。"
    return
  }

  predicting.value = true
  error.value = ""
  resetStatisticsSession(false)
  status.value = "正在上传图片并请求识别结果..."
  
  try {
    const payload = await predictImage(props.token, selectedFile.value, selectedModel.value, undefined, {
      includeAiAdvice: true,
      confidenceThreshold: threshold.value / 100,
      datasetName: selectedKnowledgeDataset.value,
    })
    const nextResult = payload?.data || null
    result.value = nextResult
    const modelDisplayName = getModelDisplayNameByName(nextResult?.model_name || selectedModel.value) || "默认模型"
    if (!nextResult || nextResult?.predicted_class === "No detection") {
      status.value = `当前模型 ${modelDisplayName} 在阈值 ${threshold.value}% 下未检出目标。可以尝试把阈值降到 5% 以下，或切换到识别更稳定的模型后再试。`
    } else {
      status.value = `识别完成：${translateLabel(nextResult?.predicted_class || "未识别")}，当前模型 ${modelDisplayName}${selectedKnowledgeDataset.value ? `，建议已按数据集 ${selectedKnowledgeDataset.value} 生成。` : "，已生成结果分析。"}`
    }
    publishPrediction(selectedFile.value, nextResult)
  } catch (err) {
    error.value = err.message || "识别失败。"
  } finally {
    predicting.value = false
  }
}

const handleOpenAnnotation = () => {
  if (result.value) {
    props.onOpenAnnotation?.()
  }
}

const stopLiveRecognitionLoop = ({ keepStatus = false } = {}) => {
  const activeMode = liveRecognitionModeRef.value
  const finalLiveResult = latestLiveDisplayResult || liveDisplayResultRef.value
  liveRecognitionActiveRef.value = false
  liveRecognitionModeRef.value = ""
  clearLiveRecognitionTimer()
  if (liveRecognitionAbortRef.value) {
    liveRecognitionAbortRef.value.abort()
    liveRecognitionAbortRef.value = null
  }
  stopStatisticsSession()
  resetAdaptiveCaptureProfile()
  clearLivePipPreviewFrame()
  clearLiveScreenPreviewFrame()
  const lastLiveFrameFile = lastLiveFrameFileRef.value
  if (mountedRef.value) {
    if (finalLiveResult) {
      result.value = finalLiveResult
    }
    liveRecognitionEnabled.value = false
    liveRecognitionBusy.value = false
    if (!previewUrl.value && lastLiveFrameFile && liveDetectionFrameMetaRef.value.width && liveDetectionFrameMetaRef.value.height) {
      replacePreviewWithFile(lastLiveFrameFile, {
        resetResult: false,
        resetStatistics: false,
        previewMeta: liveDetectionFrameMetaRef.value,
      })
    }
    if (!keepStatus && activeMode && isLiveSourceReady(activeMode)) {
      status.value = activeMode === "screen"
        ? "屏幕共享已连接，可继续手动截取、导出录屏或重新开启实时识别。"
        : "摄像头已连接，可继续手动截取或重新开启实时识别。"
    }
  }
  resetLiveDisplayResult()
  lastLiveFrameFileRef.value = null
}

const scheduleNextLiveRecognition = (delay) => {
  if (!liveRecognitionActiveRef.value) return
  clearLiveRecognitionTimer()
  const nextDelay = Number.isFinite(delay)
    ? Math.max(MIN_REALTIME_LOOP_DELAY_MS, Math.round(delay))
    : getRealtimeIntervalMs(realtimeTargetFpsRef.value)
  liveRecognitionTimerRef.value = window.setTimeout(() => {
    runLiveRecognitionTick()
  }, nextDelay)
}

const runLiveRecognitionTick = async () => {
  if (!liveRecognitionActiveRef.value) return

  const activeMode = liveRecognitionModeRef.value
  if (!isAuthenticatedRef.value || !tokenRef.value || !activeMode || sourceModeRef.value !== activeMode || !isLiveSourceReady(activeMode)) {
    stopLiveRecognitionLoop({ keepStatus: true })
    return
  }

  const videoElement = getLiveVideoElement(activeMode)
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    scheduleNextLiveRecognition(220)
    return
  }
  updatePreviewMeta(videoElement.videoWidth, videoElement.videoHeight)

  const tickStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now()
  const controller = new AbortController()
  liveRecognitionAbortRef.value = markRaw(controller)
  liveRecognitionBusy.value = true
  
  try {
    const frameCapture = await captureVideoFrame(
      videoElement,
      `${activeMode}_${Date.now()}.jpg`,
      {
        ...getRealtimeCaptureOptions(),
        reuseCanvas: true,
      }
    )
    if (!liveRecognitionActiveRef.value || controller.signal.aborted) return

    setSelectedFrameFile(frameCapture.file)
    const payload = await predictImage(
      tokenRef.value,
      frameCapture.file,
      selectedModelRef.value,
      controller.signal,
      {
        includeAiAdvice: false,
        confidenceThreshold: threshold.value / 100,
        realtimeMode: true,
      }
    )
    if (!liveRecognitionActiveRef.value || controller.signal.aborted) return

    const nextResult = payload?.data || null
    const roundtripMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - tickStartedAt
    const stabilizedDetections = stabilizeLiveDetections(nextResult?.detections || [], {
      width: frameCapture.width,
      height: frameCapture.height,
    })
    const stabilizedResult = nextResult
      ? {
          ...nextResult,
          detections: stabilizedDetections,
        }
      : null
    commitLiveDisplayResult(stabilizedResult)
    const modelDisplayName = getModelDisplayNameByName(stabilizedResult?.model_name || selectedModelRef.value) || "默认模型"
    status.value = `${getLiveSourceLabel(activeMode)}实时识别中：${translateLabel(stabilizedResult?.predicted_class || "未识别")}，当前模型 ${modelDisplayName}，已切换轻量预测。`
    publishLivePrediction(frameCapture.file, stabilizedResult)
    recordStatisticsFrame(stabilizedDetections.length ? stabilizedDetections : stabilizedResult?.top_predictions)
    recordRealtimeMetrics(payload, roundtripMs)
    updateAdaptiveCaptureProfile(roundtripMs, stabilizedResult?.prediction_ms)
    error.value = ""
    scheduleNextLiveRecognition(Math.max(MIN_REALTIME_LOOP_DELAY_MS, getRealtimeIntervalMs(realtimeTargetFpsRef.value) - roundtripMs))
  } catch (err) {
    if (controller.signal.aborted) return
    error.value = err.message || `${getLiveSourceLabel(activeMode)}实时识别失败。`
    status.value = `${getLiveSourceLabel(activeMode)}实时识别已暂停，请检查网络、模型或服务器负载后重试。`
    stopLiveRecognitionLoop({ keepStatus: true })
  } finally {
    if (liveRecognitionAbortRef.value === controller) {
      liveRecognitionAbortRef.value = null
    }
    if (mountedRef.value) {
      liveRecognitionBusy.value = false
    }
  }
}

const startLiveRecognitionLoop = async () => {
  const activeMode = sourceModeRef.value
  const sourceLabel = getLiveSourceLabel(activeMode)
  
  if (!isAuthenticatedRef.value || !tokenRef.value) {
    error.value = `请先登录后再使用${sourceLabel}实时识别。`
    return
  }
  if (activeMode !== "camera" && activeMode !== "screen") {
    error.value = "请先选择摄像头或屏幕采集，再开启实时识别。"
    return
  }
  if (!isLiveSourceReady(activeMode)) {
    error.value = activeMode === "screen" ? "请先共享屏幕，再开启实时识别。" : "请先连接摄像头，再开启实时识别。"
    return
  }
  if (liveRecognitionActiveRef.value) return

  resetStatisticsSession(true)
  resetRealtimeMetrics(activeMode)
  resetLiveDetectionState()
  resetAdaptiveCaptureProfile()
  resetLiveDisplayResult()
  lastLivePublishAtRef.value = 0
  lastLivePublishedClassRef.value = ""
  lastLiveFrameFileRef.value = null
  clearPreviewImage()
  clearLivePipPreviewFrame()
  clearLiveScreenPreviewFrame()
  result.value = null
  liveRecognitionActiveRef.value = true
  liveRecognitionModeRef.value = activeMode
  liveRecognitionEnabled.value = true
  liveRecognitionBusy.value = true
  error.value = ""
  status.value = `${sourceLabel}已连接，正在实时识别当前画面，并优先保证刷新速度...`
  
  await runLiveRecognitionTick()
}

const toggleLiveRecognition = () => {
  if (liveRecognitionEnabled.value) {
    stopLiveRecognitionLoop({ keepStatus: false })
  } else {
    startLiveRecognitionLoop()
  }
}

const stopCamera = ({ keepStatus = false } = {}) => {
  const hadCameraStream = Boolean(cameraStreamRef.value || cameraReady.value)
  const shouldClosePictureInPicture =
    pictureInPictureActive.value &&
    !previewUrl.value &&
    (sourceMode.value === "camera" || liveRecognitionModeRef.value === "camera")

  stopLiveRecognitionLoop({ keepStatus: true })

  if (cameraVideoRef.value) {
    cameraVideoRef.value.pause?.()
    cameraVideoRef.value.srcObject = null
  }

  cameraStreamRef.value?.getTracks().forEach(track => track.stop())
  cameraStreamRef.value = null
  cameraReady.value = false
  cameraReadyRef.value = false

  if (!previewUrl.value) {
    previewMeta.value = { width: 0, height: 0 }
  }

  if (shouldClosePictureInPicture) {
    closePictureInPictureWindow()
  }

  if (!keepStatus && hadCameraStream) {
    error.value = ""
    status.value = "摄像头已关闭。"
  }
}

const startCamera = async () => {
  try {
    error.value = ""
    stopLiveRecognitionLoop({ keepStatus: true })
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } }, 
      audio: false 
    })
    
    if (cameraStreamRef.value) {
      cameraStreamRef.value.getTracks().forEach(track => track.stop())
    }
    cameraStreamRef.value = markRaw(stream)
    
    const [track] = stream.getVideoTracks()
    if (track) {
      if ("contentHint" in track) {
        track.contentHint = "motion"
      }
      track.addEventListener("ended", () => {
        stopLiveRecognitionLoop({ keepStatus: true })
        cameraReady.value = false
        cameraReadyRef.value = false
        cameraStreamRef.value = null
        status.value = "摄像头连接已结束。"
      }, { once: true })
    }
    
    if (cameraVideoRef.value) {
      cameraVideoRef.value.srcObject = stream
      await cameraVideoRef.value.play().catch(() => {})
      updatePreviewMeta(cameraVideoRef.value.videoWidth, cameraVideoRef.value.videoHeight)
    }
    
    cameraReady.value = true
    cameraReadyRef.value = true
    
    if (!props.isAuthenticated || !props.token) {
      status.value = "摄像头已连接，登录后可开启实时识别；小窗改为手动弹出。"
      return
    }

    status.value = "摄像头已连接，正在开启实时识别。需要小窗时请手动点击“弹出工作台”。"
    await startLiveRecognitionLoop()
  } catch (err) {
    error.value = err.message || "摄像头初始化失败。"
  }
}

const startScreen = async () => {
  try {
    error.value = ""
    stopLiveRecognitionLoop({ keepStatus: true })
    stopScreenRecording()
    clearScreenRecordingLink()
    
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 60, max: 60 } },
      audio: false,
    })
    
    if (screenStreamRef.value) {
      screenStreamRef.value.getTracks().forEach(track => track.stop())
    }
    screenStreamRef.value = markRaw(stream)
    
    const [track] = stream.getVideoTracks()
    if (track) {
      if ("contentHint" in track) {
        track.contentHint = "motion"
      }
      track.addEventListener("ended", () => {
        stopLiveRecognitionLoop({ keepStatus: true })
        stopScreenRecording()
        screenReady.value = false
        screenReadyRef.value = false
        screenStreamRef.value = null
        status.value = "屏幕共享已结束。"
      }, { once: true })
    }
    
    if (screenVideoRef.value) {
      screenVideoRef.value.srcObject = stream
      await screenVideoRef.value.play().catch(() => {})
      updatePreviewMeta(screenVideoRef.value.videoWidth, screenVideoRef.value.videoHeight)
    }
    
    screenReady.value = true
    screenReadyRef.value = true
    
    if (!props.isAuthenticated || !props.token) {
      status.value = "屏幕共享已连接，登录后可开启实时识别和录屏下载；小窗改为手动弹出。"
      return
    }
    
    status.value = "屏幕共享已连接，正在开启实时识别。需要小窗时请手动点击“弹出工作台”。"
    await startLiveRecognitionLoop()
  } catch (err) {
    error.value = err.message || "屏幕共享初始化失败。"
  }
}

const captureFromVideo = async (mode) => {
  try {
    const targetVideo = mode === "camera" ? cameraVideoRef.value : screenVideoRef.value
    const frameCapture = await captureVideoFrame(targetVideo, `${mode}_${Date.now()}.jpg`, DEFAULT_MANUAL_CAPTURE_OPTIONS)
    replacePreviewWithFile(frameCapture.file, {
      status: mode === "camera" ? "已截取摄像头画面，可以开始识别。" : "已截取屏幕画面，可以开始识别。",
      previewMeta: {
        width: frameCapture.width,
        height: frameCapture.height,
      },
    })
    sourceMode.value = "upload"
    controlView.value = "run"
  } catch (err) {
    error.value = err.message || "画面截取失败。"
  }
}

const clearScreenRecordingLink = () => {
  revokeUrl(screenRecordingUrlRef.value)
  screenRecordingUrlRef.value = ""
  if (mountedRef.value) {
    screenRecordingDownload.value = null
  }
}

const stopScreenRecording = () => {
  if (screenRecorderRef.value && screenRecorderRef.value.state === "recording") {
    screenRecorderRef.value.stop()
  }
}

const startScreenRecording = () => {
  if (!screenStreamRef.value) {
    error.value = "请先共享屏幕，再开始录屏。"
    return
  }
  if (typeof MediaRecorder === "undefined") {
    error.value = "当前浏览器不支持 MediaRecorder，无法录屏。"
    return
  }

  clearScreenRecordingLink()
  screenRecordingChunksRef.value = []

  let recorder = null
  try {
    recorder = new MediaRecorder(screenStreamRef.value, { mimeType: "video/webm;codecs=vp9,opus" })
  } catch {
    try {
      recorder = new MediaRecorder(screenStreamRef.value, { mimeType: "video/webm" })
    } catch (err) {
      error.value = err.message || "录屏初始化失败。"
      return
    }
  }

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      screenRecordingChunksRef.value.push(event.data)
    }
  })

  recorder.addEventListener("stop", () => {
    const chunks = screenRecordingChunksRef.value
    screenRecorderRef.value = null
    if (!mountedRef.value) return
    
    screenRecording.value = false
    if (!chunks.length) {
      status.value = "录屏已停止，但没有生成可下载的数据。"
      return
    }
    
    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" })
    const url = URL.createObjectURL(blob)
    screenRecordingUrlRef.value = url
    const name = `screen_record_${Date.now()}.webm`
    screenRecordingDownload.value = { url, name }
    status.value = "录屏已停止，已生成下载链接。"
  }, { once: true })

  recorder.start()
  screenRecorderRef.value = markRaw(recorder)
  screenRecording.value = true
  error.value = ""
  status.value = "录屏已开始，可继续实时识别或随时截取当前画面。"
}

const toggleScreenRecording = () => {
  if (screenRecording.value) {
    stopScreenRecording()
  } else {
    startScreenRecording()
  }
}

const preparePictureInPictureWindow = (pipWindow) => {
  const { document } = pipWindow
  document.title = "病害识别工作台"
  document.documentElement.lang = "zh-CN"
  document.head.replaceChildren()

  const meta = document.createElement("meta")
  meta.setAttribute("charset", "utf-8")
  document.head.appendChild(meta)

  window.document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    document.head.appendChild(node.cloneNode(true))
  })

  const style = document.createElement("style")
  style.textContent = `
    html, body {
      margin: 0;
      min-height: 100%;
      background: #ece7de;
      overscroll-behavior: contain;
    }
    body {
      padding: 12px;
      overflow-y: auto;
    }
    .recognition-workbench-popup-host {
      min-height: calc(100vh - 24px);
    }
  `
  document.head.appendChild(style)

  document.body.replaceChildren()
  const container = document.createElement("div")
  container.className = "recognition-workbench-popup-host"
  container.textContent = "识别小窗加载中..."
  document.body.appendChild(container)
  return container
}

const clearPictureInPictureMonitor = () => {
  if (!pipWindowMonitorRef.value) return
  window.clearInterval(pipWindowMonitorRef.value)
  pipWindowMonitorRef.value = 0
}

const unmountPictureInPictureApp = () => {
  if (!pipAppRef.value) return
  try {
    pipAppRef.value.unmount()
  } catch {
    // 弹窗销毁时优先保证主窗口状态收敛，不阻塞后续清理。
  }
  pipAppRef.value = null
}

const resetPictureInPictureState = () => {
  clearPictureInPictureMonitor()
  unmountPictureInPictureApp()
  pipContainerRef.value = null
  pipWindowRef.value = null
  detachedWorkbench.value = false
}

const startPictureInPictureMonitor = (pipWindow) => {
  clearPictureInPictureMonitor()
  if (typeof window === "undefined" || !pipWindow) return
  pipWindowMonitorRef.value = window.setInterval(() => {
    if (pipWindow.closed) {
      resetPictureInPictureState()
    }
  }, 400)
}

const getPictureInPictureStyles = () => {
  return `
    :root {
      color-scheme: light;
      font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: radial-gradient(circle at top right, rgba(184, 136, 85, 0.16), transparent 24%),
                  linear-gradient(180deg, #141f19 0%, #1e2d24 100%);
      color: #f2ede4;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body { padding: 14px; background: inherit; color: inherit; }
    button, input { font: inherit; }
    .recognition-pip { display: grid; gap: 12px; }
    /* 其他样式... */
  `
}

const getAdaptivePictureInPictureStyles = () => {
  return `
    :root {
      color-scheme: light;
      font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: radial-gradient(circle at 12% 9%, rgba(255, 255, 255, 0.38), transparent 16%),
                  radial-gradient(circle at 88% 8%, rgba(166, 122, 76, 0.06), transparent 16%),
                  linear-gradient(180deg, #efebe4 0%, #e7e1d8 58%, #ddd6cb 100%);
      color: #202420;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      padding: 12px;
      background: inherit;
      color: inherit;
      overflow: auto;
    }
    button, input { font: inherit; }
    .recognition-pip { display: grid; gap: 10px; }
    .recognition-pip--compact { gap: 8px; }
    .recognition-pip__status {
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255, 253, 250, 0.78);
      border: 1px solid rgba(31, 36, 32, 0.08);
      color: #202420;
      line-height: 1.5;
      font-size: 13px;
    }
    .recognition-pip__status.is-error {
      background: rgba(184, 103, 72, 0.12);
      color: #8c4d37;
    }
    .recognition-pip__panel,
    .recognition-pip__metric {
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .recognition-pip__panel {
      display: grid;
      gap: 10px;
      padding: 12px;
      background: radial-gradient(circle at top right, rgba(166, 122, 76, 0.08), transparent 28%),
                  linear-gradient(180deg, rgba(255, 253, 250, 0.94), rgba(245, 240, 233, 0.92));
    }
    .recognition-pip__panel--hero {
      background: radial-gradient(circle at top right, rgba(166, 122, 76, 0.1), transparent 28%),
                  linear-gradient(180deg, rgba(255, 255, 253, 0.97), rgba(245, 240, 233, 0.94));
    }
    .recognition-pip__hero,
    .recognition-pip__threshold-head,
    .recognition-pip__section-head,
    .recognition-pip__list-item {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }
    .recognition-pip__hero span,
    .recognition-pip__section-head span,
    .recognition-pip__analysis-meta {
      color: #6c7068;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .recognition-pip__hero strong,
    .recognition-pip__section-head strong {
      display: block;
      margin-top: 4px;
      font-size: 16px;
      color: #1f2420;
    }
    .recognition-pip__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .recognition-pip__action {
      min-height: 32px;
      padding: 0 12px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 700;
    }
    .recognition-pip__action--primary {
      border: 0;
      background: linear-gradient(135deg, #274b3d 0%, #162f25 100%);
      color: #f8f5ef;
    }
    .recognition-pip__action--secondary {
      border: 1px solid rgba(39, 75, 61, 0.18);
      background: rgba(255, 255, 255, 0.82);
      color: #274b3d;
    }
    .recognition-pip__threshold {
      display: grid;
      gap: 6px;
      padding: 10px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.72);
    }
    .recognition-pip__threshold strong {
      color: #243d31;
    }
    .recognition-pip__threshold input {
      width: 100%;
      margin: 0;
      accent-color: #345946;
    }
    .recognition-pip__visualization {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      padding: 10px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.72);
    }
    .recognition-pip__visualization span {
      color: #6c7068;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .recognition-pip__mode-group {
      display: inline-flex;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(36, 61, 49, 0.08);
    }
    .recognition-pip__mode {
      min-height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #476255;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
    }
    .recognition-pip__mode.is-active {
      background: linear-gradient(135deg, #274b3d 0%, #162f25 100%);
      color: #f8f5ef;
    }
    .recognition-pip__preview {
      display: grid;
      place-items: center;
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid rgba(31, 36, 32, 0.08);
      background: repeating-linear-gradient(90deg, rgba(52, 89, 70, 0.04) 0, rgba(52, 89, 70, 0.04) 1px, transparent 1px, transparent 64px),
                  linear-gradient(180deg, rgba(255, 253, 250, 0.92), rgba(245, 240, 233, 0.9));
    }
    .recognition-pip__media {
      position: relative;
      display: inline-block;
      max-width: 100%;
      line-height: 0;
      contain: layout paint;
    }
    .recognition-pip__preview img,
    .recognition-pip__preview video {
      display: block;
      width: auto;
      max-width: 100%;
      height: auto;
      max-height: 260px;
      object-fit: contain;
    }
    .recognition-pip__media--live video {
      min-height: 160px;
      max-height: 220px;
    }
    .recognition-pip__heatmap {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0;
      transition: opacity 160ms ease;
    }
    .recognition-pip__heatmap.is-visible {
      opacity: 1;
    }
    .recognition-pip__overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      contain: layout paint;
    }
    .recognition-pip__box {
      position: absolute;
      box-sizing: border-box;
      display: grid;
      align-content: space-between;
      padding: 6px;
      border-radius: 12px;
      border: 2px solid rgba(52, 89, 70, 0.9);
      background: rgba(52, 89, 70, 0.12);
      color: #1f2420;
      transform: translateZ(0);
      will-change: left, top, width, height;
      backface-visibility: hidden;
    }
    .recognition-pip__box em {
      font-style: normal;
      font-size: 10px;
    }
    .recognition-pip__box strong {
      justify-self: start;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 10px;
      background: rgba(255, 253, 250, 0.9);
    }
    .recognition-pip__empty,
    .recognition-pip__list-empty {
      padding: 12px;
      border-radius: 14px;
      border: 1px dashed rgba(31, 36, 32, 0.12);
      background: rgba(255, 255, 255, 0.52);
      color: #6c7068;
      line-height: 1.6;
      font-size: 13px;
    }
    .recognition-pip__metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .recognition-pip__metric {
      display: grid;
      gap: 3px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.58);
    }
    .recognition-pip__metric span,
    .recognition-pip__metric p {
      margin: 0;
      color: #6c7068;
      font-size: 12px;
    }
    .recognition-pip__metric strong {
      font-size: 15px;
      color: #1f2420;
      word-break: break-word;
    }
    .recognition-pip__compact-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .recognition-pip__compact-tag {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 10px;
      border-radius: 999px;
      color: #243d31;
      background: rgba(52, 89, 70, 0.1);
      border: 1px solid rgba(52, 89, 70, 0.12);
      font-size: 12px;
    }
    .recognition-pip__list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .recognition-pip__list--stacked {
      gap: 10px;
    }
    .recognition-pip__list-item {
      padding: 12px 13px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.58);
    }
    .recognition-pip__list-item strong,
    .recognition-pip__list-item span,
    .recognition-pip__analysis p {
      margin: 0;
    }
    .recognition-pip__list-item strong {
      color: #1f2420;
    }
    .recognition-pip__list-item span,
    .recognition-pip__analysis p {
      color: #555a52;
    }
    .recognition-pip__list-item--stacked {
      align-items: flex-start;
    }
    .recognition-pip__analysis {
      display: grid;
      gap: 10px;
    }
    @media (max-width: 520px), (max-height: 560px) {
      body { padding: 10px; }
      .recognition-pip { gap: 8px; }
      .recognition-pip__panel,
      .recognition-pip__metric {
        border-radius: 16px;
      }
      .recognition-pip__panel {
        padding: 10px;
        gap: 8px;
      }
      .recognition-pip__status,
      .recognition-pip__empty,
      .recognition-pip__list-empty {
        padding: 10px;
        font-size: 12px;
      }
      .recognition-pip__metrics {
        gap: 6px;
      }
      .recognition-pip__metric {
        padding: 10px;
      }
      .recognition-pip__visualization {
        align-items: flex-start;
        flex-direction: column;
      }
      .recognition-pip__preview img,
      .recognition-pip__preview video {
        max-height: 220px;
      }
      .recognition-pip:not(.recognition-pip--compact) > .recognition-pip__panel:last-child {
        display: none;
      }
    }
    @media (max-width: 380px), (max-height: 440px) {
      body { padding: 8px; }
      .recognition-pip__metrics {
        grid-template-columns: 1fr;
      }
      .recognition-pip__hero {
        align-items: flex-start;
      }
      .recognition-pip__hero strong,
      .recognition-pip__section-head strong,
      .recognition-pip__metric strong {
        font-size: 14px;
      }
      .recognition-pip__preview img,
      .recognition-pip__preview video {
        max-height: 180px;
      }
      .recognition-pip:not(.recognition-pip--compact) > .recognition-pip__panel:nth-last-child(2) {
        display: none;
      }
    }
  `
}

const clampPictureInPictureDimension = (value, min, max) => {
  return Math.min(max, Math.max(min, Math.round(value)))
}

const getPictureInPictureWindowOptions = () => {
  const currentMode = sourceModeRef.value
  const isLiveSource = currentMode === "camera" || currentMode === "screen"
  const liveVideoElement = getLiveVideoElement(currentMode)
  const sourceWidth = Number(previewMeta.value.width) || Number(liveVideoElement?.videoWidth) || 0
  const sourceHeight = Number(previewMeta.value.height) || Number(liveVideoElement?.videoHeight) || 0
  const aspectRatio = sourceWidth && sourceHeight ? sourceWidth / sourceHeight : (isLiveSource ? 16 / 9 : 1)
  const safeAspectRatio = Math.min(1.8, Math.max(0.72, aspectRatio))
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
  const maxWidth = Math.max(360, viewportWidth - 96)
  const maxHeight = Math.max(320, viewportHeight - 96)

  if (isLiveSource) {
    const mediaHeight = clampPictureInPictureDimension(Math.min(viewportHeight * 0.34, 240), 180, 240)
    const width = clampPictureInPictureDimension(mediaHeight * safeAspectRatio + 132, 340, Math.min(620, maxWidth))
    const height = clampPictureInPictureDimension(mediaHeight + 210, 320, Math.min(560, maxHeight))
    return { width, height }
  }

  const width = clampPictureInPictureDimension(420 * safeAspectRatio + 56, 380, Math.min(760, maxWidth))
  const height = clampPictureInPictureDimension((width / safeAspectRatio) + 250, 500, Math.min(860, maxHeight))
  return { width, height }
}

const createPictureInPictureRootComponent = () => ({
  name: "RecognitionPictureInPictureWindowRoot",
  render() {
    return h(RecognitionPictureInPicture, {
      previewUrl: stagePreviewUrl.value,
      previewFile: livePipPreviewFileRef.value,
      liveStream: activeStageStream.value,
      previewMeta: overlayPreviewMeta.value,
      visualizationMode: visualizationMode.value,
      threshold: threshold.value,
      filteredDetections: overlayDetections.value,
      result: displayResult.value,
      adviceBundle: adviceBundle.value,
      selectedModel: resultModelDisplayName.value,
      status: status.value,
      error: error.value,
      liveRecognitionEnabled: liveRecognitionEnabled.value,
      liveSourceMode: sourceMode.value,
      realtimeTargetFps: realtimeTargetFps.value,
      realtimeProfile: realtimeProfile.value,
      realtimeMetrics: realtimeMetrics.value,
      onThresholdChange: (value) => {
        threshold.value = value
      },
      onClose: closePictureInPictureWindow,
      onStopCamera: () => {
        stopCamera()
      },
    })
  },
})

const mountPictureInPictureApp = (container) => {
  unmountPictureInPictureApp()
  const app = createApp(createPictureInPictureRootComponent())
  pipAppRef.value = markRaw(app)
  app.mount(container)
}

const openPictureInPictureWindow = async ({ silent = false } = {}) => {
  if (pipWindowRef.value && !pipWindowRef.value.closed) {
    pipWindowRef.value.focus()
    return true
  }

  if (!pictureInPictureSupported.value) {
    if (!silent) {
      error.value = "当前浏览器拦截了弹出工作台，请允许本站点打开新窗口。"
    }
    return false
  }

  const options = getPictureInPictureWindowOptions()
  const featureParts = [
    "popup=yes",
    `width=${options.width}`,
    `height=${options.height}`,
    "resizable=yes",
    "scrollbars=yes",
  ]

  const popupWindow = window.open("", "recognition-workbench", featureParts.join(","))
  if (!popupWindow) {
    if (!silent) {
      error.value = "弹出工作台失败，请检查浏览器是否拦截了弹窗。"
    }
    return false
  }

  let container = null
  try {
    container = preparePictureInPictureWindow(popupWindow)
    pipContainerRef.value = markRaw(container)
    pipWindowRef.value = markRaw(popupWindow)
    mountPictureInPictureApp(container)
    detachedWorkbench.value = true
  } catch (mountError) {
    resetPictureInPictureState()
    if (!popupWindow.closed) {
      popupWindow.close()
    }
    if (!silent) {
      error.value = mountError?.message || "弹出工作台失败，未能在新窗口中挂载内容。"
    }
    return false
  }

  popupWindow.addEventListener("beforeunload", () => {
    resetPictureInPictureState()
  }, { once: true })

  startPictureInPictureMonitor(popupWindow)
  popupWindow.focus()
  if (!silent) {
    error.value = ""
  }
  return true
}

const closePictureInPictureWindow = () => {
  const popupWindow = pipWindowRef.value
  resetPictureInPictureState()
  if (popupWindow && !popupWindow.closed) {
    popupWindow.close()
  }
}

const togglePictureInPictureWindow = async () => {
  if (pictureInPictureActive.value) {
    closePictureInPictureWindow()
  } else {
    await openPictureInPictureWindow()
  }
}

const handleDetailViewChange = (nextView) => {
  detailView.value = nextView
  nextTick(() => {
    detailSectionRef.value?.scrollIntoView({ behavior: "smooth", block: "start" })
  })
}

const onImageLoad = (event) => {
  updatePreviewMeta(event.target.naturalWidth, event.target.naturalHeight)
  observeStageHeatmapResize()
  scheduleHeatmapSync()
  scheduleBoxOverlaySync()
}

const onStageVideoLoadedMetadata = (event) => {
  updatePreviewMeta(event.target.videoWidth, event.target.videoHeight)
  observeStageHeatmapResize()
  scheduleHeatmapSync()
  scheduleBoxOverlaySync()
}

const onStageVideoPlaying = (event) => {
  updatePreviewMeta(event.target.videoWidth, event.target.videoHeight)
  observeStageHeatmapResize()
  scheduleHeatmapSync()
  scheduleBoxOverlaySync()
}

const syncBoxOverlayCanvas = () => {
  const mediaElement = previewImageRef.value || stageVideoRef.value
  const canvas = boxOverlayCanvasRef.value
  if (!mediaElement || !canvas || visualizationMode.value !== "boxes") return

  const rect = mediaElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  canvas.width = rect.width
  canvas.height = rect.height
  const context = canvas.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  const intrinsicWidth = mediaElement.naturalWidth || mediaElement.videoWidth || overlayPreviewMeta.value.width || rect.width
  const intrinsicHeight = mediaElement.naturalHeight || mediaElement.videoHeight || overlayPreviewMeta.value.height || rect.height
  drawDetectionsOverlay(
    context,
    overlayDetections.value,
    {
      width: overlayPreviewMeta.value.width || intrinsicWidth,
      height: overlayPreviewMeta.value.height || intrinsicHeight,
    },
    canvas.width,
    canvas.height,
  )
}

const syncHeatmapCanvas = () => {
  const mediaElement = previewImageRef.value || stageVideoRef.value
  const canvas = heatmapCanvasRef.value
  if (!mediaElement || !canvas || visualizationMode.value !== "heatmap") return
  
  const rect = mediaElement.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  
  canvas.width = rect.width
  canvas.height = rect.height
  const context = canvas.getContext("2d")
  context.clearRect(0, 0, canvas.width, canvas.height)
  const intrinsicWidth = mediaElement.naturalWidth || mediaElement.videoWidth || overlayPreviewMeta.value.width || rect.width
  const intrinsicHeight = mediaElement.naturalHeight || mediaElement.videoHeight || overlayPreviewMeta.value.height || rect.height
  drawHeatmapOverlay(
    context,
    overlayDetections.value,
    {
      width: overlayPreviewMeta.value.width || intrinsicWidth,
      height: overlayPreviewMeta.value.height || intrinsicHeight,
    },
    canvas.width,
    canvas.height
  )
}

// 监听可视化模式变化
watch(visualizationMode, (newMode) => {
  if (newMode === "heatmap" && hasStageMedia.value) {
    nextTick(() => {
      observeStageHeatmapResize()
      scheduleHeatmapSync()
    })
  } else if (newMode === "boxes" && hasStageMedia.value) {
    nextTick(() => {
      observeStageHeatmapResize()
      scheduleBoxOverlaySync()
    })
  } else if (newMode !== "heatmap") {
    const canvas = heatmapCanvasRef.value
    const context = canvas?.getContext("2d")
    context?.clearRect(0, 0, canvas.width, canvas.height)
  }
  if (newMode !== "boxes") {
    const canvas = boxOverlayCanvasRef.value
    const context = canvas?.getContext("2d")
    context?.clearRect(0, 0, canvas.width, canvas.height)
  }
})

// 监听预览图片变化
watch(stagePreviewUrl, (newUrl) => {
  if (newUrl) {
    nextTick(() => {
      observeStageHeatmapResize()
      scheduleHeatmapSync()
      scheduleBoxOverlaySync()
    })
  } else if (!newUrl) {
    disconnectStageHeatmapResizeObserver()
  }
})

watch(activeStageStream, () => {
  nextTick(() => {
    syncStageVideoStream()
    observeStageHeatmapResize()
    scheduleHeatmapSync()
    scheduleBoxOverlaySync()
  })
})

watch(overlayPreviewMeta, () => {
  scheduleHeatmapSync()
  scheduleBoxOverlaySync()
}, { deep: true })

// 监听检测结果变化
watch(overlayDetections, () => {
  scheduleHeatmapSync()
  scheduleBoxOverlaySync()
}, { deep: true })

watch(() => props.token, (value) => {
  tokenRef.value = String(value || "")
}, { immediate: true })

watch(() => props.isAuthenticated, (value) => {
  isAuthenticatedRef.value = Boolean(value)
}, { immediate: true })

watch(selectedModel, (value) => {
  selectedModelRef.value = String(value || "")
}, { immediate: true })

watch(sourceMode, (value) => {
  sourceModeRef.value = String(value || "upload")
}, { immediate: true })

watch(cameraReady, (value) => {
  cameraReadyRef.value = Boolean(value)
}, { immediate: true })

watch(screenReady, (value) => {
  screenReadyRef.value = Boolean(value)
}, { immediate: true })

watch(realtimeTargetFps, (value) => {
  realtimeTargetFpsRef.value = Number(value) || DEFAULT_REALTIME_TARGET_FPS
}, { immediate: true })

watch(realtimeProfileId, (value) => {
  realtimeProfileIdRef.value = String(value || DEFAULT_REALTIME_PROFILE_ID)
}, { immediate: true })

watch(() => recognitionModelPages.value.length, (count) => {
  recognitionModelCarouselPage.value = Math.min(recognitionModelCarouselPage.value, Math.max(count - 1, 0))
}, { immediate: true })
</script>
<style scoped>
.native-workspace--recognition {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 1.5rem;
  height: 100%;
}

.native-workspace--recognition.is-workbench-detached {
  grid-template-columns: minmax(0, 1fr);
}

.native-workspace__panel--canvas.is-detached {
  width: 100%;
  max-width: none;
  min-height: calc(100vh - 24px);
  overflow: auto;
  box-shadow: none;
}

.recognition-workbench__detach-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.08), rgba(var(--primary-rgb), 0.03));
}

.recognition-workbench__placeholder {
  display: none;
}

.recognition-workbench__detach-bar span {
  display: block;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.recognition-workbench__detach-bar strong {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-primary);
}

.recognition-model-carousel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recognition-model-carousel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.recognition-model-carousel__meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.recognition-model-carousel__controls {
  display: flex;
  gap: 0.5rem;
}

.recognition-model-carousel__viewport {
  overflow: hidden;
}

.recognition-model-carousel__track {
  display: flex;
  transition: transform 0.3s ease;
}

.recognition-model-carousel__slide {
  flex: 0 0 calc(100% / var(--recognition-model-carousel-count));
  min-width: 0;
}

.recognition-model-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.recognition-model-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  text-align: left;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.recognition-model-card:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--primary-color);
}

.recognition-model-card.is-active {
  border-color: var(--primary-color);
  background: rgba(var(--primary-rgb), 0.08);
}

.recognition-model-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.recognition-model-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.recognition-model-card__head strong {
  font-size: 0.95rem;
  word-break: break-all;
}

.recognition-model-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.recognition-model-carousel__pager {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.recognition-model-carousel__pager-item {
  width: 0.65rem;
  height: 0.65rem;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--border-color);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.recognition-model-carousel__pager-item.is-active {
  background: var(--primary-color);
  transform: scale(1.15);
}

.recognition-model-carousel__empty {
  padding: 0.85rem 1rem;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  color: var(--text-muted);
  background: var(--bg-secondary);
}

.recognition-stage__box-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.recognition-stage__box-canvas.is-visible {
  opacity: 1;
}

@media (max-width: 768px) {
  .native-workspace__panel--canvas.is-detached {
    min-height: calc(100vh - 20px);
  }

  .recognition-workbench__detach-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .recognition-model-carousel__head,
  .recognition-model-carousel__controls {
    width: 100%;
  }
}

</style>
