<script setup lang="ts">
import { ref, reactive, provide, onMounted, onUnmounted } from 'vue'
import { get, streamChatMessage, uploadFile, getTaskProgress, getJsonData, startVectorize } from '../api/chat'
import type { QuestionItem } from '../api/chat'
import { marked } from 'marked'
import FIleManagement from './FIleManagement.vue'
import ExerciseView from './ExerciseView.vue'
import StatisticsView from './StatisticsView.vue'
import TaskManager from './TaskManager.vue'
import VisionToDoc from './VisionToDoc.vue'
import UploadSuccessModal from './UploadSuccessModal.vue'
import LoadingModal from './LoadingModal.vue'
import JsonVerifyModal from './JsonVerifyModal.vue'

// 配置 marked 选项
marked.setOptions({
    gfm: true,
    breaks: true
})

// 将 Markdown 转换为 HTML
function renderMarkdown(content: string): string {
    try {
        return marked.parse(content) as string
    } catch (error) {
        console.error('Markdown 解析失败:', error)
        return content
    }
}

interface Document {
    id: string
    name: string
    type: string
    uploadTime: string
    vectorized?: boolean
    jsonCompleted?: boolean
}

function getFileIcon(type: string): string {
    const fileType = type.toLowerCase()
    if (fileType.includes('pdf')) return '📕'
    if (fileType.includes('doc') || fileType.includes('word')) return '📘'
    if (fileType.includes('xls') || fileType.includes('excel') || fileType.includes('sheet')) return '📗'
    if (fileType.includes('txt') || fileType.includes('text')) return '📄'
    if (fileType.includes('ppt') || fileType.includes('presentation')) return '📙'
    if (fileType.includes('jpg') || fileType.includes('jpeg') || fileType.includes('png') || fileType.includes('image')) return '🖼️'
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) return '📦'
    return '📁'
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

const STORAGE_KEYS = {
    CURRENT_VIEW: 'question_explain_current_view',
    SELECTED_DOCUMENT: 'question_explain_selected_document'
}

const currentView = ref('chat')
const documentList = ref<Document[]>([])
const showDocumentDropdown = ref(false)
const selectedDocument = ref<Document | null>(null)

function saveCurrentView() {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_VIEW, currentView.value)
    } catch (e) {
        console.error('保存当前视图失败:', e)
    }
}

function saveSelectedDocument() {
    try {
        if (selectedDocument.value) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_DOCUMENT, JSON.stringify(selectedDocument.value))
        } else {
            localStorage.removeItem(STORAGE_KEYS.SELECTED_DOCUMENT)
        }
    } catch (e) {
        console.error('保存选中文档失败:', e)
    }
}

function loadSavedState() {
    try {
        const savedView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW)
        if (savedView && ['chat', 'exercise', 'files', 'statistics', 'task', 'vision'].includes(savedView)) {
            currentView.value = savedView
        }

        const savedDoc = localStorage.getItem(STORAGE_KEYS.SELECTED_DOCUMENT)
        if (savedDoc) {
            const parsedDoc = JSON.parse(savedDoc)
            if (parsedDoc && parsedDoc.name) {
                selectedDocument.value = parsedDoc
            }
        }
    } catch (e) {
        console.error('加载保存状态失败:', e)
    }
}
const question = ref('')
const messages = ref<Message[]>([])
const isLoading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const showUploadModal = ref(false)
const uploadedFileName = ref('')
const uploadedFileSize = ref(0)
const uploadedFileType = ref('')
const chatError = ref('')
const scrollPosition = ref(0)
const chatMessagesRef = ref<HTMLElement | null>(null)

const taskProgressMap = reactive<Map<string, string>>(new Map())
const pollingIntervals = new Map<string, number>()

// 文件上传流程相关状态
const showLoadingModal = ref(false)
const loadingMessage = ref('')
const showJsonVerifyModal = ref(false)
const currentTaskId = ref('')
const jsonQuestions = ref<QuestionItem[]>([])
const currentUploadingFile = ref<{ name: string; type: string; size: number } | null>(null)

// 提供共享的文档选择状态
provide('selectedDocument', selectedDocument)
provide('documentList', documentList)
provide('selectDocument', selectDocument)
provide('taskProgressMap', taskProgressMap)
provide('removeDocument', removeDocument)

function removeDocument(fileName: string) {
    const index = documentList.value.findIndex(doc => doc.name === fileName)
    if (index !== -1) {
        documentList.value.splice(index, 1)
        console.log('✅ 已从文档列表中移除:', fileName)
        
        if (selectedDocument.value && selectedDocument.value.name === fileName) {
            const firstDoc = documentList.value.length > 0 ? documentList.value[0] : null
            selectedDocument.value = firstDoc ?? null
            console.log('📄 已切换到:', selectedDocument.value?.name || '无文档')
        }
    }
}

onMounted(() => {
    loadSavedState()
    loadDocumentList()
})

onUnmounted(() => {
    stopAllPolling()
})

async function loadDocumentList(maxRetries = 3, delay = 1000) {
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await get<Document[]>('/data/file_list')
            if (response.code === 200) {
                documentList.value = response.data

                // 如果有保存的选中文档，尝试在列表中找到它
                if (selectedDocument.value && selectedDocument.value.name) {
                    const existingDoc = documentList.value.find(d => d.name === selectedDocument.value!.name)
                    if (existingDoc) {
                        // 更新为最新的文档数据
                        selectedDocument.value = existingDoc
                        console.log('✅ 恢复选中文档:', existingDoc.name)
                    } else if (documentList.value.length > 0) {
                        // 保存的文档不存在，选择第一个
                        const firstDoc = documentList.value[0]
                        if (firstDoc && firstDoc.name) {
                            selectedDocument.value = firstDoc
                            console.log('✅ 保存的文档不存在，选择第一个:', firstDoc.name)
                        }
                    } else {
                        // 没有文档了
                        selectedDocument.value = null
                    }
                } else if (documentList.value.length > 0) {
                    // 没有保存的选中文档，选择第一个
                    const firstDoc = documentList.value[0]
                    if (firstDoc && firstDoc.name) {
                        selectedDocument.value = firstDoc
                        console.log('✅ 自动选择第一个文档:', firstDoc.name)
                    }
                }

                return
            }
        } catch (error) {
            lastError = error
            console.error(`加载文档列表失败 (尝试 ${attempt}/${maxRetries}):`, error)

            if (attempt < maxRetries) {
                console.log(`等待 ${delay}ms 后重试...`)
                await new Promise(resolve => setTimeout(resolve, delay))
                delay *= 2 // 指数退避
            }
        }
    }

    console.error('文档列表加载失败，已达到最大重试次数:', lastError)
}

function toggleDocumentDropdown() {
    showDocumentDropdown.value = !showDocumentDropdown.value
    // 点击下拉菜单时也尝试刷新列表
    if (showDocumentDropdown.value) {
        loadDocumentList()
    }
}

function selectDocument(doc: Document) {
    selectedDocument.value = doc
    saveSelectedDocument()
    showDocumentDropdown.value = false
}

async function askQuestion() {
    // 清除之前的错误
    chatError.value = ''

    // 验证：必须选择文件
    if (!selectedDocument.value) {
        chatError.value = '请先选择文档'
        console.warn('❌ 未选择文档，无法发送消息')
        return
    }

    // 验证：问题不能为空
    if (!question.value.trim()) {
        chatError.value = '请输入问题'
        return
    }

    // 验证：不在加载中
    if (isLoading.value) return

    const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: question.value,
        timestamp: new Date()
    }
    messages.value.push(userMessage)

    const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
    }
    messages.value.push(assistantMessage)

    isLoading.value = true
    const userQuestion = question.value
    const fileName = selectedDocument.value.name
    question.value = ''

    try {
        console.log('📤 发送问题:', { question: userQuestion, file_name: fileName })
        // 发送消息时包含文件名
        for await (const chunk of streamChatMessage(userQuestion, fileName)) {
            assistantMessage.content += chunk
        }
    } catch (error) {
        console.error('❌ 提问失败:', error)
        assistantMessage.content = '抱歉，发生了错误，请稍后重试。'
    } finally {
        isLoading.value = false
    }
}

function triggerFileUpload() {
    fileInputRef.value?.click()
}

async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const fileType = file.name.split('.').pop()?.toLowerCase() || ''
    
    // 保存上传文件信息
    currentUploadingFile.value = {
        name: file.name,
        type: fileType,
        size: file.size
    }

    const metadata = {
        id: Date.now().toString(),
        name: file.name,
        type: fileType,
        fileSize: file.size,
        uploadTime: new Date().toISOString(),
        chunkCount: 0,
        vectorized: false,
        jsonCompleted: false
    }

    // 显示加载模态框
    showLoadingModal.value = true
    loadingMessage.value = '正在上传文件...'

    try {
        // 步骤1: 上传文件
        loadingMessage.value = '正在上传文件...'
        const uploadResponse = await uploadFile('/data/upload', file, metadata)
        
        if (uploadResponse.code !== 200) {
            throw new Error(uploadResponse.msg || '文件上传失败')
        }

        const taskId = (uploadResponse.data as { task_id: string }).task_id
        currentTaskId.value = taskId

        // 如果是JSON文件，直接解析并显示题目编辑页面
        if (fileType === 'json') {
            loadingMessage.value = '正在解析JSON文件...'
            try {
                const jsonContent = await file.text()
                jsonQuestions.value = JSON.parse(jsonContent)
                showLoadingModal.value = false
                showJsonVerifyModal.value = true
                return
            } catch (parseError) {
                throw new Error('JSON文件解析失败，请确保文件格式正确')
            }
        }

        // 非JSON文件，等待后台JSON化处理
        // 步骤2: 等待JSON化完成
        loadingMessage.value = '正在生成JSON数据...'
        await waitForJsonComplete(taskId)

        // 步骤3: 获取JSON数据
        loadingMessage.value = '正在获取JSON数据...'
        const jsonResponse = await getJsonData(taskId)
        
        if (jsonResponse.code !== 200) {
            throw new Error(jsonResponse.msg || '获取JSON数据失败')
        }

        jsonQuestions.value = jsonResponse.data
        showLoadingModal.value = false
        
        // 步骤4: 显示JSON验证模态框
        showJsonVerifyModal.value = true

    } catch (error) {
        console.error('文件上传流程失败:', error)
        loadingMessage.value = `上传失败: ${(error as Error).message}`
        // 3秒后关闭加载模态框
        setTimeout(() => {
            showLoadingModal.value = false
        }, 3000)
    } finally {
        input.value = ''
    }
}

/**
 * 等待JSON化完成
 */
async function waitForJsonComplete(taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const maxWaitTime = 15 * 60 * 1000 // 15分钟超时
        const startTime = Date.now()
        
        const checkProgress = async () => {
            try {
                const result = await getTaskProgress(taskId)
                taskProgressMap.set(taskId, result.progress)
                
                // 更新加载消息
                if (result.progress) {
                    loadingMessage.value = result.progress
                }

                // 检查是否完成
                if (result.file_status?.jsonCompleted) {
                    resolve()
                    return
                }

                // 检查是否超时
                if (Date.now() - startTime > maxWaitTime) {
                    reject(new Error('JSON化超时'))
                    return
                }

                // 继续轮询
                setTimeout(checkProgress, 2000)
                
            } catch (error) {
                reject(error)
            }
        }

        checkProgress()
    })
}

/**
 * 处理JSON验证确认
 */
async function handleJsonVerifyConfirm(questions: QuestionItem[]) {
    showJsonVerifyModal.value = false
    
    // 显示加载模态框，开始向量化
    showLoadingModal.value = true
    loadingMessage.value = '正在触发向量化...'

    try {
        // 步骤1: 触发向量化（传递修改后的题目数据）
        const vectorizeResponse = await startVectorize(currentTaskId.value, questions)
        if (vectorizeResponse.code !== 200) {
            throw new Error(vectorizeResponse.msg || '触发向量化失败')
        }

        // 步骤2: 等待向量化完成
        loadingMessage.value = '正在进行向量化处理...'
        await waitForVectorizeComplete(currentTaskId.value)

        // 完成
        loadingMessage.value = '向量化完成！'
        
        // 刷新文件列表
        await loadDocumentList()

        // 显示成功模态框
        if (currentUploadingFile.value) {
            uploadedFileName.value = currentUploadingFile.value.name
            uploadedFileSize.value = currentUploadingFile.value.size
            uploadedFileType.value = currentUploadingFile.value.type
        }
        showUploadModal.value = true

    } catch (error) {
        console.error('向量化失败:', error)
        loadingMessage.value = `向量化失败: ${(error as Error).message}`
    } finally {
        // 3秒后关闭加载模态框
        setTimeout(() => {
            showLoadingModal.value = false
        }, 3000)
        
        // 重置状态
        currentTaskId.value = ''
        jsonQuestions.value = []
        currentUploadingFile.value = null
    }
}

/**
 * 等待向量化完成
 */
async function waitForVectorizeComplete(taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const maxWaitTime = 10 * 60 * 1000 // 10分钟超时
        const startTime = Date.now()
        
        const checkProgress = async () => {
            try {
                const result = await getTaskProgress(taskId)
                taskProgressMap.set(taskId, result.progress)
                
                // 更新加载消息
                if (result.progress) {
                    loadingMessage.value = result.progress
                }

                // 检查是否完成
                if (result.file_status?.vectorized) {
                    resolve()
                    return
                }

                // 检查是否超时
                if (Date.now() - startTime > maxWaitTime) {
                    reject(new Error('向量化超时'))
                    return
                }

                // 继续轮询
                setTimeout(checkProgress, 2000)
                
            } catch (error) {
                reject(error)
            }
        }

        checkProgress()
    })
}

/**
 * 关闭JSON验证模态框
 */
function closeJsonVerifyModal() {
    showJsonVerifyModal.value = false
    jsonQuestions.value = []
    currentTaskId.value = ''
    currentUploadingFile.value = null
}

function startProgressPolling(taskId: string) {
    if (pollingIntervals.has(taskId)) {
        return
    }

    const pollProgress = async () => {
        try {
            const result = await getTaskProgress(taskId)
            taskProgressMap.set(taskId, result.progress)

            if (result.file_status) {
                const { vectorized, jsonCompleted, name } = result.file_status

                const fileIndex = documentList.value.findIndex(f => f.name === name)
                if (fileIndex !== -1) {
                    const existingFile = documentList.value[fileIndex]
                    if (existingFile) {
                        documentList.value[fileIndex] = {
                            id: existingFile.id,
                            name: existingFile.name,
                            type: existingFile.type,
                            uploadTime: existingFile.uploadTime,
                            vectorized,
                            jsonCompleted
                        }
                        console.log(`✅ 文件状态更新:`, {
                            name,
                            vectorized,
                            jsonCompleted
                        })
                    }
                } else {
                    console.log(`⚠️ 未找到文件: ${name}，重新加载文件列表`)
                    loadDocumentList()
                }
            }

            if (result.progress.includes('完成') || result.progress.includes('成功')) {
                stopProgressPolling(taskId)
                loadDocumentList()
            }
        } catch (error) {
            console.error('获取进度失败:', error)
            stopProgressPolling(taskId)
        }
    }

    pollProgress()

    const intervalId = window.setInterval(pollProgress, 2000)
    pollingIntervals.set(taskId, intervalId)
}

function stopProgressPolling(taskId: string) {
    const intervalId = pollingIntervals.get(taskId)
    if (intervalId) {
        window.clearInterval(intervalId)
        pollingIntervals.delete(taskId)
    }
    taskProgressMap.delete(taskId)
}

function stopAllPolling() {
    pollingIntervals.forEach((intervalId) => {
        window.clearInterval(intervalId)
    })
    pollingIntervals.clear()
    taskProgressMap.clear()
}

function closeUploadModal() {
    showUploadModal.value = false
}

function handleUploadConfirm() {
    showUploadModal.value = false
    loadDocumentList()
}

function switchView(view: string) {
    // 保存当前滚动位置
    if (currentView.value === 'chat' && chatMessagesRef.value) {
        scrollPosition.value = chatMessagesRef.value.scrollTop
    }

    currentView.value = view
    saveCurrentView()

    // 如果切换到聊天页面，恢复滚动位置
    if (view === 'chat') {
        setTimeout(() => {
            if (chatMessagesRef.value) {
                chatMessagesRef.value.scrollTop = scrollPosition.value
            }
        }, 100)
    }
}
</script>

<template>
    <div class="sidebar-header">
        <h1 class="logo">📚 AI问答系统</h1>
    </div>
    <div class="app-container">

        <!-- 左侧固定菜单栏 -->
        <aside class="sidebar">
            <nav class="sidebar-nav">
                <button
                    class="nav-item"
                    :class="{ active: currentView === 'chat' }"
                    @click="switchView('chat')"
                >
                    💬 AI 聊天解答
                </button>
                <button
                    class="nav-item"
                    :class="{ active: currentView === 'exercise' }"
                    @click="switchView('exercise')"
                >
                    📝 题目作答练习
                </button>
                <button
                    class="nav-item"
                    :class="{ active: currentView === 'files' }"
                    @click="switchView('files')"
                >
                    📁 文件管理
                </button>
                <button
                    class="nav-item"
                    :class="{ active: currentView === 'statistics' }"
                    @click="switchView('statistics')"
                >
                    📊 练习统计
                </button>
                <button
                    class="nav-item"
                    :class="{ active: currentView === 'task' }"
                    @click="switchView('task')"
                >
                    📋 任务管理
                </button>
                <button
                    class="nav-item"
                    :class="{ active: currentView === 'vision' }"
                    @click="switchView('vision')"
                >
                    📷 视觉转文档
                </button>
            </nav>
        </aside>

        <!-- 右侧主内容区 -->
        <main class="main-content">
            <div v-if="currentView === 'chat'" class="chat-view">
                <div class="view-header">
                    <h2>💬 AI 聊天解答</h2>
                    <p>基于文档的智能问答系统</p>
                </div>

                <div class="chat-function-menu">
                    <button class="function-item" @click="triggerFileUpload">
                        📁 上传文件
                    </button>
                    <div class="dropdown-container">
                        <button class="function-item" @click="toggleDocumentDropdown">
                            📄 {{ selectedDocument ? selectedDocument.name.slice(0, 6) + '...' : '选择文档' }} ({{ documentList.length }}) ▼
                        </button>
                        <div v-if="showDocumentDropdown" class="dropdown-menu">
                            <div class="dropdown-header">
                                共 {{ documentList.length }} 个文档
                            </div>
                            <div v-for="doc in documentList" :key="doc.id" class="dropdown-item" @click="selectDocument(doc)">
                                <span class="file-icon">{{ getFileIcon(doc.type) }}</span>
                                <span class="file-name" :title="doc.name">{{ doc.name }}</span>
                            </div>
                            <div v-if="documentList.length === 0" class="dropdown-empty">
                                暂无文档
                            </div>
                        </div>
                    </div>
                    <button class="function-item">
                        ⚙️ 其它
                    </button>
                    <button class="function-item">
                        🤖 大模型配置
                    </button>
                </div>

                <div class="chat-container">
                    <div class="chat-messages" ref="chatMessagesRef">
                        <input
                            ref="fileInputRef"
                            type="file"
                            class="hidden-input"
                            accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.json"
                            @change="handleFileUpload"
                        >
                        <div v-if="messages.length === 0" class="empty-chat">
                            <p>👋 开始您的AI问答之旅</p>
                            <p class="hint">在下方输入您的问题，AI将为您提供智能解答</p>
                        </div>
                        <div
                            v-for="message in messages"
                            :key="message.id"
                            class="message"
                            :class="message.role"
                        >
                            <div class="message-avatar">
                                {{ message.role === 'user' ? '👤' : '🤖' }}
                            </div>
                            <div class="message-content">
                                <!-- AI 助手的回复使用 Markdown 渲染 -->
                                <div v-if="message.role === 'assistant'" class="message-text markdown-content" v-html="renderMarkdown(message.content)"></div>
                                <!-- 用户的消息保持原样 -->
                                <div v-else class="message-text">{{ message.content }}</div>
                                <div v-if="isLoading && message.role === 'assistant' && message.content === ''" class="loading-indicator">
                                    <span class="loading-dot"></span>
                                    <span class="loading-dot"></span>
                                    <span class="loading-dot"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="chat-input">
                        <!-- 错误提示 -->
                        <div v-if="chatError" class="chat-error">
                            ⚠️ {{ chatError }}
                        </div>

                        <textarea
                            v-model="question"
                            :placeholder="selectedDocument ? '请输入您的问题...' : '请先选择文档'"
                            @keydown.enter.exact.prevent="askQuestion"
                            rows="3"
                        ></textarea>
                        <button
                            class="send-btn"
                            :disabled="!question.trim() || isLoading || !selectedDocument"
                            @click="askQuestion"
                        >
                            发送
                        </button>
                    </div>
                </div>
            </div>

            <FIleManagement v-else-if="currentView === 'files'" />
            <ExerciseView v-else-if="currentView === 'exercise'" />
            <StatisticsView v-else-if="currentView === 'statistics'" />
            <TaskManager v-else-if="currentView === 'task'" />
            <VisionToDoc v-else-if="currentView === 'vision'" />
        </main>

        <UploadSuccessModal
            :visible="showUploadModal"
            :fileName="uploadedFileName"
            :fileSize="uploadedFileSize"
            :fileType="uploadedFileType"
            @close="closeUploadModal"
            @confirm="handleUploadConfirm"
        />

        <!-- 加载中模态框 -->
        <LoadingModal
            :visible="showLoadingModal"
            :message="loadingMessage"
            :showCancel="false"
        />

        <!-- JSON验证模态框 -->
        <JsonVerifyModal
            :visible="showJsonVerifyModal"
            :questions="jsonQuestions"
            :fileName="currentUploadingFile?.name || ''"
            @close="closeJsonVerifyModal"
            @confirm="handleJsonVerifyConfirm"
        />
    </div>
</template>

<style scoped>
.sidebar-header {
    height: 100px;
    padding: 0 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
}

.logo {
    font-size: 2rem;
    font-weight: 600;
    margin: 0;
}

.app-container {
    display: flex;
    height: calc(100vh - 100px);
    width: 100vw;
    overflow: hidden;
    background: #f5f7fa;
}

/* 左侧菜单栏 */
.sidebar {
    width: 220px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.05);
}

.sidebar-nav {
    padding: 0.75rem;
    border-bottom: 1px solid #e2e8f0;
}

.nav-item {
    width: 100%;
    padding: 0.875rem 1rem;
    margin-bottom: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.nav-item:hover {
    background: #f1f5f9;
    color: #667eea;
}

.nav-item.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 500;
}

.sidebar-section {
    padding: 1rem;
    flex: 1;
    overflow-y: auto;
}

.section-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    margin-bottom: 1rem;
}

.menu-item {
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.menu-item:hover {
    background: #f1f5f9;
    border-color: #667eea;
    color: #667eea;
}

.dropdown-container {
    position: relative;
}

.dropdown-menu {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    margin-top: 0.5rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
}

.dropdown-header {
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
}

.dropdown-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s ease;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.dropdown-item:hover {
    background: #f1f5f9;
}

.file-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
}

.file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #334155;
}

.dropdown-empty {
    padding: 1rem;
    text-align: center;
    color: #94a3b8;
    font-size: 0.85rem;
}

/* 右侧主内容区 */
.main-content {
    flex: 1;
    overflow: hidden;
    background: #f5f7fa;
}

.chat-view,
.exercise-view,
.files-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    box-sizing: border-box;
    gap: 0.75rem;
}

.view-header {
    background: white;
    padding: 1.25rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.view-header h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.view-header p {
    color: #7f8c8d;
    font-size: 1rem;
    margin: 0;
    line-height: 1.5;
}

.chat-function-menu {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.function-item {
    padding: 0.75rem 1.25rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.function-item:hover {
    background: #f1f5f9;
    border-color: #667eea;
    color: #667eea;
}

.chat-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    min-height: 0;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    background: #fafbfc;
}

.hidden-input {
    display: none;
}

.empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
    text-align: center;
}

.empty-chat p {
    font-size: 1.25rem;
    margin: 0.5rem 0;
}

.empty-chat .hint {
    font-size: 0.9rem;
    color: #94a3b8;
}

.message {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.message.user {
    flex-direction: row-reverse;
}

.message-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
}

.message.assistant .message-avatar {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.message-content {
    max-width: 70%;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.message.user .message-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
    background: white;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    border-bottom-left-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.message-text {
    min-height: 1.6rem;
    line-height: 1.6;
}

/* Markdown 内容样式 */
.markdown-content {
    font-size: 0.95rem;
    color: #333;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
    color: #1e293b;
}

.markdown-content h1 { font-size: 1.5rem; }
.markdown-content h2 { font-size: 1.3rem; }
.markdown-content h3 { font-size: 1.15rem; }
.markdown-content h4 { font-size: 1rem; }

.markdown-content p {
    margin: 0.8em 0;
    line-height: 1.7;
}

.markdown-content ul,
.markdown-content ol {
    margin: 0.8em 0;
    padding-left: 1.5em;
}

.markdown-content li {
    margin: 0.4em 0;
    line-height: 1.6;
}

.markdown-content code {
    background: #f1f5f9;
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    color: #e74c3c;
}

.markdown-content pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 1em;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
}

.markdown-content pre code {
    background: transparent;
    color: inherit;
    padding: 0;
}

.markdown-content blockquote {
    border-left: 4px solid #667eea;
    margin: 1em 0;
    padding: 0.5em 1em;
    background: #f8fafc;
    color: #64748b;
}

.markdown-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
}

.markdown-content th,
.markdown-content td {
    border: 1px solid #e2e8f0;
    padding: 0.5em;
    text-align: left;
}

.markdown-content th {
    background: #f8fafc;
    font-weight: 600;
}

.markdown-content strong {
    font-weight: 600;
    color: #1e293b;
}

.markdown-content em {
    font-style: italic;
}

.markdown-content a {
    color: #667eea;
    text-decoration: none;
}

.markdown-content a:hover {
    text-decoration: underline;
}

.markdown-content hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 1.5em 0;
}

.loading-indicator {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    margin-top: 0.5rem;
}

.loading-dot {
    width: 8px;
    height: 8px;
    background: #667eea;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
}

.message.user .loading-dot {
    background: white;
}

.loading-dot:nth-child(1) {
    animation-delay: -0.32s;
}

.loading-dot:nth-child(2) {
    animation-delay: -0.16s;
}

@keyframes bounce {
    0%, 80%, 100% {
        transform: scale(0);
    }
    40% {
        transform: scale(1);
    }
}

.chat-input {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    background: white;
    border-top: 1px solid #e2e8f0;
}

.chat-input textarea {
    flex: 1;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    font-size: 1rem;
    resize: none;
    font-family: inherit;
    transition: border-color 0.2s ease;
}

.chat-input textarea:focus {
    outline: none;
    border-color: #667eea;
}

.chat-error {
    padding: 0.5rem 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
}

.send-btn {
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.send-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
