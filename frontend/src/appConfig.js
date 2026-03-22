export const APP_NAME = "PlantOps";
export const APP_TAGLINE = "植物病害识别平台";
export const AUTH_STORAGE_KEY = "plant_auth_token";
export const DEFAULT_WORKSPACE = "recognition";

export const WORKSPACES = [
  {
    id: "recognition",
    label: "病害识别",
    group: "flow",
    groupLabel: "主流程",
    step: "01",
    hint: "上传、摄像头、录屏",
    summary: "聚焦病害识别主链路，上传叶片图片后直接回显检测框、主预测和处理建议。",
    focusTitle: "先拿到稳定识别结果",
    focusSummary: "先上传图片或打开摄像头/共享屏幕，确认检测框和主预测可用，再继续后续标注与训练。",
    highlights: ["上传图片或采集画面", "识别结果可直接送去标注", "模型切换与阈值过滤在同页完成"],
  },
  {
    id: "annotation",
    label: "标注与训练",
    group: "flow",
    groupLabel: "主流程",
    step: "02",
    hint: "数据集、增强、训练",
    summary: "围绕数据集、框选标注、增强和训练形成闭环，所有写入操作都在网页内完成。",
    focusTitle: "把识别结果沉淀成可训练数据",
    focusSummary: "在这里管理数据集、修正框选、做增强并发起训练，形成完整训练闭环。",
    highlights: ["支持导入识别框辅助标注", "按 YOLO 格式保存图片与标签", "训练任务进度在当前页面持续更新"],
  },
  {
    id: "details",
    label: "模型资产",
    group: "support",
    groupLabel: "其他功能",
    step: "03",
    hint: "上传、下载、切换",
    summary: "集中处理模型上传、下载、切换和使用，让识别链路始终能调用到当前可用模型。",
    focusTitle: "统一管理可用模型",
    focusSummary: "上传个人模型、切换当前在线模型、下载归档，都在这里集中处理。",
    highlights: ["上传个人模型并立即接入识别页", "下载与切换都在同一页完成", "公开模型和个人模型统一管理"],
  },
  {
    id: "admin",
    label: "平台管理",
    group: "support",
    groupLabel: "其他功能",
    step: "04",
    hint: "用户、模型、脚本",
    summary: "面向管理员的用户、模型、数据集和增强脚本总控入口。",
    focusTitle: "管理员总控",
    focusSummary: "统一处理用户、模型、数据集和增强脚本，避免在普通工作流中打断主任务。",
    highlights: ["统一查看用户和资源分布", "上传模型、数据集和增强脚本", "切换当前在线模型与增强算法"],
  },
];

export function getWorkspaceMeta(workspaceId) {
  return WORKSPACES.find((workspace) => workspace.id === workspaceId) || WORKSPACES[0];
}
