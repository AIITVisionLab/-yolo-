yolo1/
├── fronted/                          # 前端项目目录
│   ├── index.html                    # HTML入口文件
│   ├── package.json                  # 项目依赖配置
│   ├── vite.config.js                # Vite构建配置
│   ├── src/                          # 源代码目录
│   │   ├── main.js                   # 应用入口，初始化Vue、Pinia、Router
│   │   ├── App.vue                   # 根组件，包含路由视图
│   │   ├── api/                      # API接口层
│   │   │   └── index.js              # 统一API接口定义（Mock数据）//待接入真实接口
│   │   ├── router/                   # 路由配置
│   │   │   └── index.js              # 路由定义和导航守卫
│   │   ├── stores/                   # Pinia状态管理
│   │   │   └── User.js               # 用户状态管理
│   │   ├── styles/                   # 全局样式
│   │   │   └── monet-theme.css       # Monet风格主题CSS变量定义
│   │   └── views/                    # 页面组件
│   │       ├── Login.vue             # 用户登录页面
│   │       ├── Workbench.vue         # 工作台布局框架
│   │       ├── Recognize.vue         # 病害识别功能页
│   │       ├── Annotation.vue        # 标注与训练功能页
│   │       ├── Models.vue            # 模型资产管理页
│   │       └── Admin.vue             # 平台管理页（管理员专用）
│   └── dist/                         # 构建输出目录（可重新生成）
└── .idea/                            # IDE配置目录

核心功能模块
1. 用户认证模块 (Login.vue)
   功能: 用户登录/注册
   权限: 两种角色 - 管理员(admin) 和 普通用户(user)
   默认账号:
   admin/admin (管理员)
   demo/demo (普通用户)
   guest/guest (普通用户，已标记)
2. 工作台布局 (Workbench.vue)
   功能: 整体布局框架，包含左侧导航栏和主内容区
   特性:
   可折叠导航栏
   响应式设计
   根据用户角色动态显示导航项
3. 病害识别模块 (Recognize.vue)
   功能:
   图片上传识别
   摄像头实时识别
   屏幕共享识别
   识别结果展示与标注框绘制
   识别建议推荐
   技术: Canvas绘图、MediaStream API
4. 标注与训练模块 (Annotation.vue)
   功能:
   数据集管理（创建/删除/下载）
   类别管理（新增/删除类别）
   图片标注（画框、保存YOLO格式）
   数据增强配置
   异步模型训练任务
   布局: 左右两列结构
   左列: 数据集与类别 + 增强与训练
   右列: 图片标注（画布区域）
5. 模型资产管理模块 (Models.vue)
   功能:
   模型列表查看
   模型上传（ONNX格式）
   模型切换/激活
   模型下载
   模型删除
6. 平台管理模块 (Admin.vue)
   功能 (仅管理员可用):
   用户管理（查看/禁用/删除）
   平台模型上传
   平台数据集导入
   增强脚本管理

API接口说明
所有API接口都在 src/api/index.js 中定义，当前使用 Mock数据（基于localStorage）：
认证API (authApi)
register(username, password) - 用户注册
login(username, password) - 用户登录
logout() - 用户登出
getSession() - 获取会话信息
识别API (predictApi)
recognize(imageFile, modelName, confidence, options) - 识别图片
getRecommendation(detections, datasetContext) - 获取识别建议
模型API (modelApi)
getList() - 获取模型列表
upload(name, onnxFile, labelsFile, metadataFile, isPublic, enableNow) - 上传模型
download(modelName) - 下载模型
delete(modelName) - 删除模型
select(modelName) - 切换活跃模型
train(datasetName, baseModel, epochs, imgsz, modelName) - 启动训练
getTaskStatus(taskId) - 查询训练状态
标注API (annotationApi)
getDatasets() - 获取数据集列表
createDataset(name, description, isPublic, template) - 创建数据集
getClasses(datasetName) - 获取类别列表
addClass(datasetName, className, knowledgeSuggestion) - 新增类别
uploadImages(datasetName, files) - 上传图片
getImages(datasetName) - 获取图片列表
getImageDetail(datasetName, imageName) - 获取图片详情和标注
saveAnnotation(datasetName, imageName, annotations) - 保存标注
augment(datasetName, augmentCount, trainRatio, seed) - 数据增强
管理API (adminApi)
getUsers() - 获取用户列表
setUserDisabled(userId, disabled) - 禁用/启用用户
deleteUser(userId) - 删除用户
getConsole() - 获取控制台信息
uploadPlatformModel(name, onnxFile, labelsFile) - 上传平台模型
uploadAugmentation(file, displayName, version, author, description, datasetType) - 上传增强脚本

注意事项
Mock数据: 当前所有API接口使用Mock数据，部署时需要替换为真实后端API
后端依赖: 项目需要后端服务运行在 http://localhost:8000
浏览器兼容性: 使用了现代浏览器特性（如backdrop-filter），建议使用Chrome/Edge
LocalStorage: 所有数据存储在浏览器本地，清除浏览器数据会丢失所有记录
文件上传: 图片文件通过 URL.createObjectURL() 创建临时URL，页面刷新后失效