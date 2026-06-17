/**
 * API 请求工具模块
 *
 * 本模块提供了与后端服务器通信的工具函数，包括：
 * 1. 通用 HTTP 请求方法（GET/POST/PUT/DELETE）
 * 2. 流式响应处理（用于 AI 对话的实时输出）
 * 3. 文件上传功能
 * 4. 任务进度查询
 * 5. 题库获取功能
 *
 * 后端服务地址: http://localhost:8001
 */

/**
 * API 基础地址
 * 后端服务器的基础 URL，所有请求都会基于此地址拼接
 */
const API_BASE_URL = 'http://localhost:8001'

/**
 * API 统一响应格式
 *
 * @typeParam T - 响应数据的类型
 */
interface ApiResponse<T = unknown> {
    /**
     * 状态码，200 表示成功
     */
    code: number;
    /**
     * 响应消息，成功时为 'success'，失败时为错误提示
     */
    msg: string;
    /**
     * 响应数据，具体类型由调用方传入
     */
    data: T;
}

/**
 * 发送 GET 请求
 *
 * @param path - 请求路径，如 '/api/users'
 * @param params - 查询参数，会被转换为 URL 参数字符串
 * @returns Promise 响应对象
 *
 * @example
 * ```typescript
 * const response = await get('/api/users', { page: '1' })
 * if (response.code === 200) {
 *     console.log(response.data)
 * }
 * ```
 */
async function get<T = unknown>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let url = `${API_BASE_URL}${path}`
    if (params) {
        const searchParams = new URLSearchParams(params)
        url = `${url}?${searchParams.toString()}`
    }
    const response = await fetch(url)
    return await response.json() as ApiResponse<T>
}

/**
 * 发送 POST 请求
 *
 * @param path - 请求路径，如 '/api/users'
 * @param data - 请求体数据，会被序列化为 JSON
 * @returns Promise 响应对象
 *
 * @example
 * ```typescript
 * const response = await post('/api/users', { name: '张三' })
 * if (response.code === 200) {
 *     console.log('创建成功')
 * }
 * ```
 */
async function post<T = unknown>(path: string, data: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    return await response.json() as ApiResponse<T>
}

/**
 * 发送 PUT 请求
 *
 * @param path - 请求路径，如 '/api/users/1'
 * @param data - 请求体数据，会被序列化为 JSON
 * @returns Promise 响应对象
 *
 * @example
 * ```typescript
 * const response = await put('/api/users/1', { name: '李四' })
 * if (response.code === 200) {
 *     console.log('更新成功')
 * }
 * ```
 */
async function put<T = unknown>(path: string, data: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    return await response.json() as ApiResponse<T>
}

/**
 * 发送 DELETE 请求
 *
 * @param path - 请求路径，如 '/api/users/1'
 * @returns Promise 响应对象
 *
 * @example
 * ```typescript
 * const response = await del('/api/users/1')
 * if (response.code === 200) {
 *     console.log('删除成功')
 * }
 * ```
 */
async function del<T = unknown>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
    })
    return await response.json() as ApiResponse<T>
}

/**
 * 流式对话请求（用于 AI 实时回答）
 *
 * 发送问题到后端，接收流式响应并逐段返回 AI 的回答内容
 *
 * @param question - 用户问题
 * @yields 每次 yield 返回一段 AI 回答的文本
 *
 * @example
 * ```typescript
 * // 在 Vue 组件中使用
 * let answer = ''
 * for await (const chunk of streamChatMessage('你好')) {
 *     answer += chunk
 *     // 实时更新 UI
 * }
 * ```
 */
async function* streamChatMessage(question: string, fileName?: string): AsyncGenerator<string> {
    // 构建请求体
    const requestBody: { question: string; file_name?: string } = { question }
    if (fileName) {
        requestBody.file_name = fileName
    }

    const response = await fetch(`${API_BASE_URL}/api/ask`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    })

    if (!response.body) {
        return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
            const content = parseLine(line)
            if (content) {
                yield content
            }
        }
    }

    // 处理剩余的缓冲区内容
    if (buffer) {
        const content = parseLine(buffer)
        if (content) {
            yield content
        }
    }
}

/**
 * 解析一行流式响应数据
 *
 * 支持多种数据格式：
 * 1. JSON 格式：{"code": 200, "chunk": "内容"} 或 {"data": "内容"}
 * 2. 纯文本格式：直接返回文本
 *
 * @param line - 原始响应行
 * @returns 解析出的内容，如果解析失败返回 null
 *
 * @internal
 */
function parseLine(line: string): string | null {
    try {
        const trimmed = line.trim()

        if (!trimmed) {
            return null
        }

        // 支持多种常见格式
        try {
            const data = JSON.parse(trimmed)

            // 优先查找 chunk 字段（后端实际使用的字段）
            if (data.chunk !== undefined && data.chunk !== null) {
                return String(data.chunk)
            }

            // 兼容其他常见格式
            if (data.data) {
                return String(data.data)
            }
            if (data.answer) {
                return String(data.answer)
            }
            if (data.content) {
                return String(data.content)
            }
        } catch {
            // 如果 JSON 解析失败，尝试直接使用文本
        }

        return trimmed || null
    } catch {
        return null
    }
}

export { get, post, put, del, streamChatMessage, uploadFile, getTaskProgress, deleteFile, getQuestionBank, addExerciseRecord, getExerciseRecords, deleteExerciseRecord, getJsonData, startVectorize, aiReview }
export type { ApiResponse, ExerciseRecord, QuestionItem, AIReviewResponse }

// ==========================================
// 文件上传相关类型定义
// ==========================================

/**
 * 文件元数据接口
 */
interface FileMetadata {
    id: string | number
    name: string
    type: string
    fileSize: number
    uploadTime: string
    chunkCount: number
    vectorized: boolean
    jsonCompleted: boolean
}

/**
 * 上传文件到服务器
 *
 * 使用 FormData 同时传递文件和 JSON 元数据
 *
 * @param endpoint - 上传接口路径，如 '/data/upload'
 * @param file - 要上传的文件对象（File 类型）
 * @param metadata - 文件元数据信息
 * @returns Promise 响应对象
 *
 * @example
 * ```typescript
 * const fileInput = document.querySelector('input[type="file"]')
 * const file = fileInput.files[0]
 *
 * const metadata = {
 *     id: 1,
 *     name: file.name,
 *     type: 'pdf',
 *     fileSize: file.size,
 *     uploadTime: new Date().toISOString(),
 *     chunkCount: 10,
 *     vectorized: false,
 *     jsonCompleted: false
 * }
 *
 * const response = await uploadFile('/data/upload', file, metadata)
 * if (response.code === 200) {
 *     console.log('文件上传成功')
 * }
 * ```
 */
async function uploadFile(
    endpoint: string,
    file: File,
    metadata: FileMetadata
): Promise<ApiResponse> {
    // 创建 FormData 对象
    const formData = new FormData()

    // 添加文件到 FormData
    formData.append('file', file)

    // 添加文件元数据为 JSON 字符串
    formData.append('metadata', JSON.stringify(metadata))

    // 发送请求
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
        // 注意：不要设置 Content-Type，让浏览器自动设置（包含 boundary）
    })

    return await response.json() as ApiResponse
}

/**
 * 任务进度响应接口
 */
interface TaskProgressResponse {
    task_id: string
    progress: string
    file_status?: {
        vectorized: boolean
        jsonCompleted: boolean
        name: string
    }
}

/**
 * 获取任务处理进度
 *
 * @param taskId - 任务 ID
 * @returns Promise 进度响应对象
 *
 * @example
 * ```typescript
 * const progress = await getTaskProgress('12345')
 * console.log(progress.progress) // "开始生成 json 块"
 * ```
 */
async function getTaskProgress(taskId: string): Promise<TaskProgressResponse> {
    const response = await fetch(`${API_BASE_URL}/task/progress/${taskId}`)
    return await response.json() as TaskProgressResponse
}

/**
 * 删除文件
 */
async function deleteFile(fileName: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/file/delete?file_name=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
    })
    return await response.json() as ApiResponse
}

/**
 * 题目数据结构接口
 */
interface QuestionItem {
    id: number
    file_name: string
    topic_type: string
    topic_index: number
    topic: string
    choose?: {
        [key: string]: string
    }
    answer: string | string[]
    explain: string
}

/**
 * 获取题库题目
 *
 * 根据文件名从后端获取对应的练习题目
 *
 * @param fileName - 文件名称
 * @returns Promise 题目列表
 *
 * @example
 * ```typescript
 * const questions = await getQuestionBank('文档名称.docx')
 * if (questions.code === 200) {
 *     console.log('题目列表:', questions.data)
 * }
 * ```
 */
async function getQuestionBank(fileName: string, topicNum: string = "all"): Promise<ApiResponse<QuestionItem[]>> {
    const formData = new FormData()
    formData.append('file_name', fileName)
    formData.append('topic_num', topicNum)
    
    const response = await fetch(`${API_BASE_URL}/practice/question_bank`, {
        method: 'POST',
        body: formData
    })
    return await response.json() as ApiResponse<QuestionItem[]>
}

// ==========================================
// 使用示例
// ==========================================
/*
// 1. 获取文档列表
const docListResponse = await get('/data/file_list')
if (docListResponse.code === 200) {
    console.log('文档列表:', docListResponse.data)
}

// 2. 流式对话
let fullAnswer = ''
for await (const chunk of streamChatMessage('你好')) {
    fullAnswer += chunk
    console.log('实时回答:', fullAnswer)
}

// 3. 创建资源
const createResponse = await post('/api/some-resource', { name: '测试' })
if (createResponse.code === 200) {
    console.log('创建成功')
}

// 4. 更新资源
const updateResponse = await put('/api/some-resource/1', { name: '新名称' })
if (updateResponse.code === 200) {
    console.log('更新成功')
}

// 5. 删除资源
const deleteResponse = await del('/api/some-resource/1')
if (deleteResponse.code === 200) {
    console.log('删除成功')
}

// 6. 上传文件
const file = document.querySelector('input[type="file"]').files[0]
const metadata = {
    id: Date.now(),
    name: file.name,
    type: 'pdf',
    fileSize: file.size,
    uploadTime: new Date().toISOString(),
    chunkCount: 0,
    vectorized: false,
    jsonCompleted: false
}
const uploadResponse = await uploadFile('/data/upload', file, metadata)
if (uploadResponse.code === 200) {
    console.log('上传成功')
}

// 7. 查询任务进度
const progress = await getTaskProgress('task_123')
console.log('当前进度:', progress.progress)

// 8. 获取题库题目
const questionBank = await getQuestionBank('文档名称.docx')
if (questionBank.code === 200) {
    console.log('题目列表:', questionBank.data)
}
*/

// ==========================================
// 练习记录相关类型定义和接口
// ==========================================

interface AIReviewResponse {
    ai_score: number
    comment: string
    losePointReason: string
}

interface ExerciseGrades {
    topic_true_num: number
    totalQuestions: number
    topic_false_num: number
    topic_null_num: number
    answer_total_time: number
    accuracy_raet: number
    average_answer_time: number
    createTime: string
}

interface ExerciseRecord {
    id: string
    file_name: string
    content: Array<{
        id: number
        topic: string
        topic_type: string
        answer: string | string[]
        userAnswer?: string
        choose?: Record<string, string>
        has_choose_true?: boolean | null
        answer_time?: number
        answer_time_str?: string
    }>
    grades: ExerciseGrades & {
        average_answer_time?: number
    }
    ai_evaluation?: string
}

interface ExerciseRecordData {
    id: string
    file_name: string
    content: Array<{
        id: number
        topic: string
        topic_type: string
        answer: string | string[]
        userAnswer?: string
        choose?: Record<string, string>
        has_choose_true?: boolean | null
        answer_time?: number
        answer_time_str?: string
    }>
    grades: ExerciseGrades & {
        average_answer_time?: number
    }
    ai_evaluation?: string
}

async function addExerciseRecord(data: ExerciseRecordData): Promise<ApiResponse> {
    const formData = new FormData()
    formData.append('fun', 'add')
    formData.append('data', JSON.stringify(data))
    
    const response = await fetch(`${API_BASE_URL}/data/exercise_record`, {
        method: 'POST',
        body: formData
    })
    return await response.json() as ApiResponse
}

async function getExerciseRecords(): Promise<ApiResponse<ExerciseRecord[]>> {
    const formData = new FormData()
    formData.append('fun', 'get')
    formData.append('data', '{}')  // 后端需要 data 字段，传递空对象
    
    const response = await fetch(`${API_BASE_URL}/data/exercise_record`, {
        method: 'POST',
        body: formData
    })
    return await response.json() as ApiResponse<ExerciseRecord[]>
}

async function deleteExerciseRecord(data: unknown): Promise<ApiResponse> {
    const formData = new FormData()
    formData.append('fun', 'delete')
    formData.append('data', JSON.stringify(data))
    
    const response = await fetch(`${API_BASE_URL}/data/exercise_record`, {
        method: 'POST',
        body: formData
    })
    return await response.json() as ApiResponse
}

// ==========================================
// 文件上传流程相关接口
// ==========================================

/**
 * 获取已生成的JSON数据（用于前端校验）
 * 
 * @param taskId - 任务ID
 * @returns Promise JSON数据响应
 */
async function getJsonData(taskId: string): Promise<ApiResponse<QuestionItem[]>> {
    const response = await fetch(`${API_BASE_URL}/data/json/${taskId}`)
    return await response.json() as ApiResponse<QuestionItem[]>
}

/**
 * 触发向量化任务
 * 
 * 用户确认JSON无误后，手动触发向量化
 * 
 * @param taskId - 任务ID
 * @param metadata - 修改后的题目数据
 * @returns Promise 响应对象
 */
async function startVectorize(taskId: string, metadata?: any): Promise<ApiResponse> {
    const formData = new FormData()
    // 确保始终添加 metadata 字段（后端要求必填）
    formData.append('meta_data', metadata ? JSON.stringify(metadata) : '[]')
    
    const response = await fetch(`${API_BASE_URL}/data/vectorize/${taskId}`, {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    })
    return await response.json() as ApiResponse
}

/**
 * AI评阅接口
 * 
 * 对简答题进行AI评阅，返回评阅分数、评语和扣分原因
 * 
 * @param score - 当前题目的分值
 * @param topic - 题目内容
 * @param origin_answer - 原始参考答案
 * @param user_answer - 用户输入的答案
 * @returns Promise 包含AI评阅结果的响应对象
 * 
 * @example
 * ```typescript
 * const result = await aiReview(10, '简述计算机维护要点', '正确答案...', '用户答案...')
 * console.log(result.data.ai_score) // AI打的分数
 * console.log(result.data.comment) // 简短评语
 * console.log(result.data.losePointReason) // 扣分原因
 * ```
 */
async function aiReview(
    score: number,
    topic: string,
    origin_answer: string,
    user_answer: string
): Promise<ApiResponse<AIReviewResponse>> {
    const data = {
        score,
        topic,
        origin_answer,
        user_answer
    }
    
    const response = await fetch(`${API_BASE_URL}/ai/review`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    return await response.json() as ApiResponse<AIReviewResponse>
}
