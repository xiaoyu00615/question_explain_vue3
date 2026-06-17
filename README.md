# 在线答题练习系统

一个基于 Vue 3 + TypeScript 构建的在线答题练习平台，支持多种题型、自动评分、练习统计等功能。

## 功能特性

### 1. 视觉转文档
- 图片上传与拖拽排序
- AI 智能识别图片内容
- 支持导出为 Word、Markdown、TXT、HTML、JSON 等格式

### 2. 题目练习
- **多种题型支持**：单选题、多选题、判断题、填空题、简答题、综合应用题
- **练习模式**：全量练习、随机练习、背题训练、错题重做
- **即时反馈**：提交后立即显示正确答案和详细解析
- **AI 评阅**：简答题和综合应用题支持 AI 自动评分

### 3. JSON 数据校验
- 上传文件后自动 JSON 化处理
- 可视化编辑题目内容
- 支持添加、删除、修改题目
- 主题干支持（综合应用题）

### 4. 练习统计
- 练习记录管理
- 正确率统计图表
- 分数分布分析
- 知识点掌握度雷达图

### 5. 任务事务管理
- 任务添加、编辑、删除
- 紧急度分级（10级颜色标识）
- 重要度标记（星星评分）
- 实时进度跟踪
- 权重计算排序

## 技术栈

- **前端框架**：Vue 3.5
- **语言**：TypeScript
- **路由**：Vue Router 5
- **图表**：ECharts 6 + Vue-ECharts
- **构建工具**：Vite
- **代码规范**：ESLint + Oxlint

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 类型检查

```bash
npm run type-check
```

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
├── api/                 # API 接口封装
│   └── chat.ts
├── components/         # 公共组件
│   ├── charts/         # 图表组件
│   ├── icons/          # 图标组件
│   ├── AiReviewModal.vue
│   ├── ExerciseView.vue
│   ├── JsonVerifyModal.vue
│   ├── LoadingModal.vue
│   ├── RecentExercises.vue
│   ├── StatisticsView.vue
│   ├── TaskManager.vue
│   ├── VisionToDoc.vue
│   └── ...
├── views/              # 页面视图
│   ├── PracticeView.vue
│   └── ReviewView.vue
├── router/             # 路由配置
│   └── index.ts
├── App.vue             # 根组件
└── main.ts             # 入口文件
```

## 题目数据格式

```json
{
    "id": 1,
    "file_name": "文档名称.docx",
    "topic_type": "单选题",
    "topic_index": 1,
    "main_topic": "主题干内容（可选）",
    "topic": "题目内容",
    "choose": {
        "A": "选项A",
        "B": "选项B",
        "C": "选项C",
        "D": "选项D"
    },
    "answer": "A",
    "explain": "答案解析"
}
```

## 后端接口

系统需要以下后端接口支持：

| 接口 | 方法 | 功能 |
|------|------|------|
| `/data/upload` | POST | 文件上传 |
| `/data/vectorize/{task_id}` | POST | 向量化处理 |
| `/data/progress/{task_id}` | GET | 获取处理进度 |
| `/delete/visual_data` | DELETE | 删除视觉数据 |
| `/get/visual_data` | GET | 获取视觉数据 |

## License

Private - All Rights Reserved
