const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const DEFAULT_MODEL_KEY = 'plantDefaultModel'

const getToken = () => {
  const token = localStorage.getItem('token')
  if (token) return token

  try {
    const userInfo = localStorage.getItem('userInfo')
    return userInfo ? JSON.parse(userInfo).token || null : null
  } catch {
    return null
  }
}

const clearStoredAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
}

const authHeaders = () => {
  const token = getToken()
  return token ? { 'X-Auth-Token': token } : {}
}

const request = async (endpoint, options = {}) => {
  const headers = {
    ...authHeaders(),
    ...options.headers
  }

  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    })
  } catch (error) {
    throw new Error(error.message?.includes('Failed to fetch')
      ? '无法连接到后端服务，请确认后端已启动。'
      : error.message || '请求失败')
  }

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuth()
    }
    throw new Error(data?.detail || data?.message || `请求失败：${response.status}`)
  }

  return data
}

const normalizeUser = (user) => ({
  ...user,
  disabled: Boolean(user?.is_disabled),
  flagged: Boolean(user?.is_flagged)
})

const normalizeModel = (model, currentModel = null) => ({
  name: model.name,
  display_name: model.display_name || model.name,
  type: 'ONNX',
  owner: model.owner_username || model.owner_display_name || 'platform',
  is_public: Boolean(model.is_public),
  can_manage: Boolean(model.can_manage),
  scope: model.is_official ? 'official' : 'private',
  is_online: Boolean(model.is_active || model.name === currentModel),
  created_at: model.uploaded_at || new Date().toISOString()
})

const normalizeDataset = (dataset, data = {}) => ({
  name: dataset.name,
  owner: dataset.owner_username || dataset.owner_display_name || 'platform',
  is_public: Boolean(dataset.is_public),
  is_official: Boolean(dataset.is_official),
  can_write: Boolean(dataset.can_write),
  image_count: dataset.name === data.selected_dataset ? data.source_image_count || 0 : dataset.source_image_count || 0,
  description: dataset.is_official ? '平台数据集' : dataset.can_write ? '我的数据集' : '可访问数据集'
})

const normalizeBox = (item) => {
  if (Array.isArray(item.bbox)) {
    return {
      label: item.label || item.class_name,
      x1: Number(item.bbox[0]),
      y1: Number(item.bbox[1]),
      x2: Number(item.bbox[2]),
      y2: Number(item.bbox[3]),
      source: item.source || 'manual'
    }
  }

  const hasBox = [item.x1, item.y1, item.x2, item.y2].every((value) => value !== undefined && value !== null)
  if (!hasBox) {
    return {
      label: item.label || item.class_name,
      bbox: null,
      source: item.source || 'manual'
    }
  }

  return {
    label: item.label || item.class_name,
    x1: Number(item.x1),
    y1: Number(item.y1),
    x2: Number(item.x2),
    y2: Number(item.y2),
    source: item.source || 'manual'
  }
}

const toFrontendBox = (item) => {
  const box = normalizeBox(item)
  return {
    label: box.label,
    class_name: box.label,
    bbox: box.bbox === null ? null : [box.x1, box.y1, box.x2, box.y2],
    confidence: item.confidence,
    source: box.source
  }
}

const formatAdvice = (advice) => {
  if (!advice) return '暂无建议'
  const lines = [advice.summary, ...(advice.advice || [])].filter(Boolean)
  return lines.join('\n')
}

const downloadWithAuth = async (url, filename) => {
  const response = await fetch(url, { headers: authHeaders() })
  if (!response.ok) throw new Error(`下载失败：${response.status}`)

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  link.click()
  URL.revokeObjectURL(blobUrl)
}

const loadImageWithAuth = async (url) => {
  const response = await fetch(url, { headers: authHeaders() })
  if (!response.ok) throw new Error(`图片加载失败：${response.status}`)
  return URL.createObjectURL(await response.blob())
}

export const authApi = {
  async register(username, password) {
    const result = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    const userInfo = {
      username: result.data.user.username,
      role: result.data.user.role,
      token: result.data.token
    }
    localStorage.setItem('userInfo', JSON.stringify(userInfo))
    localStorage.setItem('token', result.data.token)
    return { token: result.data.token, user: normalizeUser(result.data.user) }
  },

  async login(username, password) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
    const userInfo = {
      username: result.data.user.username,
      role: result.data.user.role,
      token: result.data.token
    }
    localStorage.setItem('userInfo', JSON.stringify(userInfo))
    localStorage.setItem('token', result.data.token)
    return { token: result.data.token, user: normalizeUser(result.data.user) }
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' })
    } finally {
      clearStoredAuth()
    }
    return { success: true }
  },

  async getSession() {
    const result = await request('/auth/session', { method: 'GET' })
    if (result.data?.user) {
      const userInfo = {
        username: result.data.user.username,
        role: result.data.user.role,
        token: getToken()
      }
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
      if (userInfo.token) localStorage.setItem('token', userInfo.token)
      return { user: normalizeUser(result.data.user) }
    }
    return { user: null }
  }
}

export const predictApi = {
  async recognize(imageFile, modelName = null, confidence = 0.5, options = {}) {
    const formData = new FormData()
    formData.append('file', imageFile)

    const params = new URLSearchParams()
    if (modelName) params.append('model_name', modelName)
    if (confidence !== undefined) params.append('confidence_threshold', confidence)
    if (options.mode === 'realtime') params.append('realtime_mode', 'true')
    if (options.datasetContext) params.append('dataset_name', options.datasetContext)
    params.append('include_ai_advice', 'true')

    const result = await request(`/predict?${params.toString()}`, {
      method: 'POST',
      body: formData
    })

    const data = result.data
    const threshold = confidence === undefined ? 0 : Number(confidence)
    const isAboveThreshold = (item) => Number(item.confidence || 0) >= threshold
    const rawDetections = (data.detections || []).map(toFrontendBox)
    const rawTopPredictions = (data.top_predictions || []).map((item) => ({
      class_name: item.label || item.class_name,
      confidence: item.confidence,
      bbox: item.bbox || null
    }))
    const detections = rawDetections.filter(isAboveThreshold)
    const topPredictions = rawTopPredictions.filter(isAboveThreshold)
    const fallbackPrediction = data.predicted_class && data.predicted_class !== 'No detection' && Number(data.confidence || 0) >= threshold
      ? {
          class_name: data.predicted_class,
          confidence: Number(data.confidence || 0),
          bbox: null
        }
      : null
    const displayTopPredictions = topPredictions.length
      ? topPredictions
      : (detections.length ? detections.slice(0, 3) : (fallbackPrediction ? [fallbackPrediction] : []))

    return {
      model_name: data.model_name,
      detections,
      drawable_detections: rawDetections.length ? rawDetections : rawTopPredictions,
      top_prediction: detections[0] || displayTopPredictions[0] || null,
      top_predictions: displayTopPredictions,
      timings: {
        inference_ms: data.prediction_ms || 0,
        recommendation_ms: data.advice_ms || 0
      },
      preview_url: URL.createObjectURL(imageFile),
      mode: options.mode || 'single',
      ai_advice: data.ai_advice,
      suggestion: data.ai_advice ? formatAdvice(data.ai_advice) : ''
    }
  },

  async getRecommendation(detections, datasetContext = null) {
    if (!detections?.length) {
      return { suggestion: '未检测到目标，暂无防治建议。' }
    }

    const primaryDetection = detections[0]
    const result = await request('/ai/recommendation', {
      method: 'POST',
      body: JSON.stringify({
        disease_label: primaryDetection.class_name,
        confidence: primaryDetection.confidence,
        dataset_name: datasetContext || undefined,
        top_predictions: detections.map((det) => ({
          label: det.class_name,
          confidence: det.confidence,
          bbox: det.bbox || null
        }))
      })
    })

    return { suggestion: formatAdvice(result.data) }
  }
}

export const modelApi = {
  async getList() {
    const result = await request('/models', { method: 'GET' })
    const models = (result.data.available_model_items || []).map((model) => normalizeModel(model, result.data.current_model))
    const storedDefault = localStorage.getItem(DEFAULT_MODEL_KEY)
    const defaultModel = models.some((model) => model.name === storedDefault)
      ? storedDefault
      : result.data.current_model
    return { models, current_model: result.data.current_model, default_model: defaultModel }
  },

  async getTrainingBaseModels() {
    const result = await request('/models/training-bases', { method: 'GET' })
    return {
      models: result.data.models || [],
      default_model: result.data.default_model || 'yolov8n.pt'
    }
  },

  async upload(name, onnxFile, labelsFile = null, metadataFile = null, isPublic = false, enableNow = true) {
    const formData = new FormData()
    formData.append('model_file', onnxFile)
    if (labelsFile) formData.append('labels_file', labelsFile)
    if (metadataFile) formData.append('metadata_file', metadataFile)
    formData.append('activate', enableNow ? 'true' : 'false')
    formData.append('is_public', isPublic ? 'true' : 'false')

    await request('/models/upload', {
      method: 'POST',
      body: formData
    })
    return { success: true }
  },

  download(modelName) {
    const url = `${API_BASE_URL}/models/${encodeURIComponent(modelName)}/download`
    downloadWithAuth(url, `${modelName}_model.zip`).catch(console.error)
    return url
  },

  async delete(modelName) {
    await request('/models/delete', {
      method: 'POST',
      body: JSON.stringify({ model_name: modelName })
    })
    return { success: true }
  },

  async select(modelName) {
    await request(`/models/select?model_name=${encodeURIComponent(modelName)}`, {
      method: 'POST'
    })
    localStorage.setItem(DEFAULT_MODEL_KEY, modelName)
    return { success: true }
  },

  async train(datasetName, baseModel, epochs = 100, imgsz = 640, modelName = null, trainRatio = 0.8) {
    const result = await request('/models/train/tasks', {
      method: 'POST',
      body: JSON.stringify({
        dataset_name: datasetName,
        base_model: baseModel,
        epochs,
        imgsz,
        model_name: modelName || undefined,
        train_ratio: trainRatio
      })
    })
    return { task_id: result.data.task_id }
  },

  async getTaskStatus(taskId) {
    const result = await request(`/models/train/tasks/${taskId}`, { method: 'GET' })
    const data = result.data
    return {
      status: data.status,
      current_epoch: data.current_epoch || 0,
      total_epochs: data.total_epochs || data.result?.epochs || 0,
      loss: data.result?.loss || 0,
      map: data.result?.map50 || 0,
      message: data.message || '',
      error: data.error || '',
      logs: [
        `数据集：${data.dataset_name}`,
        `基础模型：${data.result?.base_model || 'yolov8n'}`,
        `阶段：${data.stage || data.status}`,
        data.message || (data.status === 'completed' ? '训练完成，已生成模型' : '训练进行中')
      ]
    }
  }
}

export const annotationApi = {
  async getDatasets() {
    const result = await request('/annotation/classes', { method: 'GET' })
    
    // 添加调试信息
    console.log('getDatasets response:', {
      hasData: !!result.data,
      hasAvailableItems: !!(result.data?.available_dataset_items),
      itemsCount: result.data?.available_dataset_items?.length,
      availableDatasets: result.data?.available_datasets,
      templates: result.data?.class_templates?.length
    })
    
    const datasets = (result.data?.available_dataset_items || []).map((dataset) => normalizeDataset(dataset, result.data))
    const classTemplates = (result.data?.class_templates || []).map((template) => ({
      key: template.key,
      label: template.label,
      description: template.description,
      class_count: template.class_count,
      classes: template.classes || []
    }))
    
    console.log('Processed datasets:', datasets.length, 'templates:', classTemplates.length)
    
    return {
      datasets,
      class_templates: classTemplates,
      selected_dataset_template_key: result.data?.selected_dataset_template_key || 'blank'
    }
  },

  async createDataset(name, description = '', isPublic = false, template = 'blank') {
    await request('/annotation/datasets', {
      method: 'POST',
      body: JSON.stringify({
        dataset_name: name,
        is_public: isPublic,
        class_template_key: template
      })
    })
    return { success: true }
  },

  async importFolder(files, relativePaths, name, isPublic = false) {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    relativePaths.forEach((path) => formData.append('relative_paths', path))
    formData.append('dataset_name', name)
    formData.append('is_public', isPublic ? 'true' : 'false')

    await request('/annotation/datasets/import-folder', {
      method: 'POST',
      body: formData
    })
    return { success: true }
  },

  downloadDataset(datasetName) {
    const url = `${API_BASE_URL}/annotation/datasets/${encodeURIComponent(datasetName)}/download`
    downloadWithAuth(url, `${datasetName}_dataset.zip`).catch(console.error)
    return url
  },

  async deleteDataset(datasetName) {
    await request('/annotation/datasets/delete', {
      method: 'POST',
      body: JSON.stringify({ dataset_name: datasetName })
    })
    return { success: true }
  },

  async getClasses(datasetName) {
    const result = await request(`/annotation/classes?dataset=${encodeURIComponent(datasetName)}`, {
      method: 'GET'
    })
    const classes = (result.data.classes || []).map((className, index) => ({
      name: className,
      knowledge_suggestion: result.data.class_advices?.[index]?.summary || ''
    }))
    return { classes }
  },

  async addClass(datasetName, className) {
    await request('/annotation/classes', {
      method: 'POST',
      body: JSON.stringify({
        dataset_name: datasetName,
        class_name: className
      })
    })
    return { success: true }
  },

  async deleteClass(datasetName, className) {
    await request('/annotation/classes/delete', {
      method: 'POST',
      body: JSON.stringify({
        dataset_name: datasetName,
        class_name: className
      })
    })
    return { success: true }
  },

  async uploadImages(datasetName, files) {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    formData.append('dataset_name', datasetName)

    await request('/annotation/source-images/upload', {
      method: 'POST',
      body: formData
    })
    return { success: true }
  },

  async getImages(datasetName) {
    const result = await request(`/annotation/classes?dataset=${encodeURIComponent(datasetName)}`, {
      method: 'GET'
    })
    const images = (result.data.source_images || []).map((img) => ({
      name: img.name,
      has_annotation: img.has_annotation,
      annotation_count: img.annotation_count,
      previewUrl: `${API_BASE_URL}/annotation/source-images/${encodeURIComponent(datasetName)}/${encodeURIComponent(img.name)}`
    }))
    return { images }
  },

  async getImageDetail(datasetName, imageName) {
    const imageUrl = `${API_BASE_URL}/annotation/source-images/${encodeURIComponent(datasetName)}/${encodeURIComponent(imageName)}`
    const result = await request(
      `/annotation/source-images/${encodeURIComponent(datasetName)}/${encodeURIComponent(imageName)}/detail`,
      { method: 'GET' }
    )

    return {
      annotations: (result.data.annotations || []).map(toFrontendBox),
      image_url: await loadImageWithAuth(imageUrl)
    }
  },

  async deleteImage(datasetName, imageName) {
    await request(
      `/annotation/source-images/${encodeURIComponent(datasetName)}/${encodeURIComponent(imageName)}/delete`,
      { method: 'POST' }
    )
    return { success: true }
  },

  async saveAnnotation(datasetName, imageName, annotations, imageFile = null) {
    const formData = new FormData()
    const normalized = annotations.map(normalizeBox)

    if (imageFile) {
      formData.append('file', imageFile)
    } else {
      formData.append('source_filename', imageName)
    }

    formData.append('dataset_name', datasetName)
    formData.append('annotations', JSON.stringify(normalized))

    await request('/annotation/save', {
      method: 'POST',
      body: formData
    })
    return { success: true }
  },

  async augment(datasetName, augmentCount = 3, trainRatio = 0.8, seed = 42) {
    const result = await request('/annotation/augment', {
      method: 'POST',
      body: JSON.stringify({
        dataset_name: datasetName,
        copies: augmentCount,
        train_ratio: trainRatio,
        seed
      })
    })
    const data = result.data
    return {
      success: true,
      summary: `已对 ${datasetName} 执行 ${data.augmented_count} 份增强，训练集 ${data.train_count} 张，验证集 ${data.val_count} 张。`
    }
  }
}

export const adminApi = {
  async getUsers() {
    const result = await request('/users', { method: 'GET' })
    return { users: (result.data.users || []).map(normalizeUser) }
  },

  async setUserDisabled(userId, disabled) {
    await request(`/admin/users/${userId}/disabled`, {
      method: 'POST',
      body: JSON.stringify({ value: disabled })
    })
    return { success: true }
  },

  async setUserFlagged(userId, flagged) {
    await request(`/admin/users/${userId}/flagged`, {
      method: 'POST',
      body: JSON.stringify({ value: flagged })
    })
    return { success: true }
  },

  async deleteUser(userId) {
    await request(`/admin/users/${userId}`, { method: 'DELETE' })
    return { success: true }
  },

  async getConsole() {
    const result = await request('/admin/console', { method: 'GET' })
    const data = result.data
    const augmentations = [
      data.builtin_augmentation_item,
      ...(data.managed_augmentation_scripts || [])
    ].filter(Boolean)
    const current = augmentations.find((item) => item.name === data.active_augmentation_script) || data.builtin_augmentation_item || null

    return {
      augmentations,
      current_augmentation: current,
      managed_models: (data.managed_models || []).map((model) => normalizeModel(model, data.current_model)),
      managed_datasets: data.managed_datasets || []
    }
  },

  async uploadPlatformModel(name, onnxFile, labelsFile = null) {
    const formData = new FormData()
    formData.append('model_file', onnxFile)
    if (labelsFile) formData.append('labels_file', labelsFile)
    formData.append('activate', 'false')
    formData.append('is_public', 'true')

    await request('/admin/models/upload', {
      method: 'POST',
      body: formData
    })
    return { success: true }
  },

  async uploadPlatformDataset(name, zipFile, isPublic = false) {
    const formData = new FormData()
    formData.append('dataset_file', zipFile)
    formData.append('dataset_name', name)
    formData.append('is_public', isPublic ? 'true' : 'false')

    await request('/admin/datasets/upload', {
      method: 'POST',
      body: formData
    })
    return { success: true }
  },

  async uploadAugmentation(file, displayName, version, author, description, datasetType = '通用') {
    const formData = new FormData()
    formData.append('script_file', file)
    formData.append('activate', 'true')
    if (displayName) formData.append('display_name', displayName)
    if (version) formData.append('version', version)
    if (author) formData.append('author', author)
    if (description) formData.append('description', description)
    if (datasetType) formData.append('dataset_types', datasetType)

    await request('/admin/augmentations/upload', {
      method: 'POST',
      body: formData
    })
    return { success: true }
  },

  async selectAugmentation(scriptName) {
    await request(`/admin/augmentations/select?script_name=${encodeURIComponent(scriptName)}`, {
      method: 'POST'
    })
    return { success: true }
  },

  async deleteAugmentation(scriptName) {
    await request(`/admin/augmentations/${encodeURIComponent(scriptName)}`, {
      method: 'DELETE'
    })
    return { success: true }
  }
}
