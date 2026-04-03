import { translateLabel } from '@/lib/plantPresentation'

const formatOverlayConfidence = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "--"
  return `${(numeric * 100).toFixed(1)}%`
}

export const getBBoxStyle = (bbox, imageMeta) => {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !imageMeta?.width || !imageMeta?.height) return null
  const [x1, y1, x2, y2] = bbox
  return {
    left: `${(x1 / imageMeta.width) * 100}%`,
    top: `${(y1 / imageMeta.height) * 100}%`,
    width: `${((x2 - x1) / imageMeta.width) * 100}%`,
    height: `${((y2 - y1) / imageMeta.height) * 100}%`,
  }
}

export const drawDetectionsOverlay = (context, detections, imageMeta, targetWidth, targetHeight) => {
  const visibleDetections = Array.isArray(detections) ? detections : []
  const scaleX = targetWidth / (imageMeta?.width || targetWidth || 1)
  const scaleY = targetHeight / (imageMeta?.height || targetHeight || 1)
  const fontSize = Math.max(14, Math.round(Math.min(targetWidth, targetHeight) * 0.024))
  const lineWidth = Math.max(2, Math.round(fontSize * 0.16))
  const labelHeight = Math.max(22, Math.round(fontSize * 1.55))
  const labelPaddingX = Math.max(6, Math.round(fontSize * 0.42))

  context.lineWidth = lineWidth
  context.font = `${fontSize}px "Segoe UI"`
  context.textBaseline = "alphabetic"

  visibleDetections.forEach((item, index) => {
    if (!Array.isArray(item?.bbox) || item.bbox.length !== 4) return
    const [x1, y1, x2, y2] = item.bbox
    const drawX = x1 * scaleX
    const drawY = y1 * scaleY
    const drawWidth = (x2 - x1) * scaleX
    const drawHeight = (y2 - y1) * scaleY
    const color = index === 0 ? "#f4c95d" : "#79ca8d"
    const text = `${translateLabel(item.label)} ${formatOverlayConfidence(item.confidence)}`

    context.strokeStyle = color
    context.strokeRect(drawX, drawY, drawWidth, drawHeight)
    const textWidth = context.measureText(text).width
    const textY = Math.max(labelHeight, drawY - Math.round(fontSize * 0.55))
    context.fillStyle = "rgba(12, 26, 19, 0.84)"
    context.fillRect(drawX, textY - labelHeight, textWidth + labelPaddingX * 2, labelHeight)
    context.fillStyle = "#ffffff"
    context.fillText(text, drawX + labelPaddingX, textY - Math.round(fontSize * 0.18))
  })
}

export const drawHeatmapOverlay = (context, detections, imageMeta, targetWidth, targetHeight) => {
  const visibleDetections = Array.isArray(detections) ? detections : []
  const scaleX = targetWidth / (imageMeta?.width || targetWidth || 1)
  const scaleY = targetHeight / (imageMeta?.height || targetHeight || 1)
  const totalConfidence = visibleDetections.reduce((sum, item) => sum + Math.max(Number(item?.confidence) || 0, 0), 0) || 1
  const badgeFontSize = Math.max(13, Math.round(Math.min(targetWidth, targetHeight) * 0.022))
  const badgePaddingX = Math.max(8, Math.round(badgeFontSize * 0.55))
  const badgeHeight = Math.max(24, Math.round(badgeFontSize * 1.8))
  const strokeWidth = Math.max(2, Math.round(badgeFontSize * 0.12))

  context.fillStyle = "rgba(40, 12, 72, 0.24)"
  context.fillRect(0, 0, targetWidth, targetHeight)

  visibleDetections.forEach((item) => {
    if (!Array.isArray(item?.bbox) || item.bbox.length !== 4) return
    const [x1, y1, x2, y2] = item.bbox
    const boxWidth = (x2 - x1) * scaleX
    const boxHeight = (y2 - y1) * scaleY
    const centerX = x1 * scaleX + boxWidth / 2
    const centerY = y1 * scaleY + boxHeight / 2
    const radius = Math.max(boxWidth, boxHeight) * 0.82
    const alpha = Math.min(0.95, 0.32 + (Number(item.confidence) || 0) * 0.68)
    const weightPercent = Math.round(((Number(item.confidence) || 0) / totalConfidence) * 100)

    context.save()
    context.globalCompositeOperation = "screen"
    const gradient = context.createRadialGradient(centerX, centerY, radius * 0.08, centerX, centerY, radius)
    gradient.addColorStop(0, `rgba(255, 250, 196, ${Math.min(1, alpha * 1.08)})`)
    gradient.addColorStop(0.24, `rgba(255, 132, 228, ${alpha})`)
    gradient.addColorStop(0.58, `rgba(167, 82, 255, ${alpha * 0.92})`)
    gradient.addColorStop(0.84, `rgba(92, 35, 182, ${alpha * 0.58})`)
    gradient.addColorStop(1, "rgba(28, 6, 64, 0)")
    context.fillStyle = gradient
    context.fillRect(Math.max(0, centerX - radius), Math.max(0, centerY - radius), radius * 2, radius * 2)
    context.restore()

    context.save()
    context.strokeStyle = `rgba(255, 224, 124, ${Math.min(0.96, 0.38 + (Number(item.confidence) || 0) * 0.5)})`
    context.lineWidth = Math.max(strokeWidth, strokeWidth + (Number(item.confidence) || 0) * 2.2)
    context.strokeRect(x1 * scaleX, y1 * scaleY, boxWidth, boxHeight)
    context.restore()

    const badgeText = `${weightPercent}%`
    context.save()
    context.font = `bold ${badgeFontSize}px "Segoe UI"`
    const badgeWidth = context.measureText(badgeText).width + badgePaddingX * 2
    const badgeX = Math.max(8, Math.min(targetWidth - badgeWidth - 8, centerX - badgeWidth / 2))
    const badgeY = Math.max(badgeHeight, centerY - radius * 0.36)
    context.fillStyle = "rgba(46, 12, 92, 0.84)"
    context.fillRect(badgeX, badgeY - badgeHeight, badgeWidth, badgeHeight)
    context.strokeStyle = "rgba(255, 226, 140, 0.72)"
    context.lineWidth = Math.max(1, Math.round(badgeFontSize * 0.1))
    context.strokeRect(badgeX, badgeY - badgeHeight, badgeWidth, badgeHeight)
    context.fillStyle = "#fff6c8"
    context.fillText(badgeText, badgeX + badgePaddingX, badgeY - Math.round(badgeFontSize * 0.22))
    context.restore()
  })
}
