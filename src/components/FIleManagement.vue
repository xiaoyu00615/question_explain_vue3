<script setup lang="ts">
    import { ref, onMounted, inject } from 'vue'
    import { get, deleteFile as deleteFileApi } from '../api/chat'
    import DeleteConfirmModal from './DeleteConfirmModal.vue'
    import DeleteResultModal from './DeleteResultModal.vue'

    interface FileItem {
        id: string
        name: string
        fileSize: number
        uploadTime: string
        chunkCount: number
        vectorized: boolean
        jsonCompleted: boolean
        progress?: string  // 进度信息
    }

    const fileList = ref<FileItem[]>([])
    const loading = ref(false)
    const hasLoaded = ref(false)  // 标记是否已经加载过
    
    // 删除确认模态窗口状态
    const showDeleteConfirm = ref(false)
    const fileToDelete = ref('')
    
    // 删除结果模态窗口状态
    const showDeleteResult = ref(false)
    const deleteResultSuccess = ref(false)
    const deleteResultMessage = ref('')
    const deleteResultFileName = ref('')

    // 从 App.vue 注入的进度 Map
    const taskProgressMap = inject<Map<string, string>>('taskProgressMap', new Map())
    
    // 从 HomeView 注入的删除文档方法
    const removeDocument = inject<(fileName: string) => void>('removeDocument', () => {})

    /**
     * 获取文件的进度信息
     */
    function getFileProgress(file: FileItem): string {
        // 如果有实时进度，使用实时进度
        if (taskProgressMap.has(file.id)) {
            return taskProgressMap.get(file.id) || ''
        }
        // 否则使用文件自身的进度
        return file.progress || ''
    }

    /**
     * 计算进度百分比
     */
    function getProgressPercentage(file: FileItem): number {
        const progress = getFileProgress(file)
        
        // 如果已完成
        if (file.vectorized && file.jsonCompleted) {
            return 100
        }
        
        // 根据进度文本估算百分比
        if (progress.includes('完成')) {
            return 100
        } else if (progress.includes('处理 json 文档块完成')) {
            return 90
        } else if (progress.includes('处理 json 文档块')) {
            return 70
        } else if (progress.includes('生成 json 块完成')) {
            return 60
        } else if (progress.includes('生成 json 块')) {
            return 40
        } else if (progress.includes('开始')) {
            return 20
        }
        
        // 默认进度
        if (file.jsonCompleted) return 80
        if (file.vectorized) return 50
        return 10
    }

    /**
     * 获取进度条颜色
     */
    function getProgressColor(file: FileItem): string {
        const percentage = getProgressPercentage(file)
        if (percentage === 100) return '#10b981'  // 绿色
        if (percentage >= 50) return '#3b82f6'    // 蓝色
        return '#f59e0b'                          // 橙色
    }

    /**
     * 加载文件列表（带缓存机制）
     * @param forceRefresh - 是否强制刷新（跳过缓存）
     */
    async function loadFileList(forceRefresh = false, maxRetries = 3, delay = 1000) {
        if (hasLoaded.value && !forceRefresh) {
            console.log('📦 使用缓存数据，跳过请求')
            return
        }

        let lastError = null
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                loading.value = true
                console.log(`开始加载文件列表 (尝试 ${attempt}/${maxRetries})...`)

                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('请求超时')), 10000)
                })

                const response = await Promise.race([
                    get<FileItem[]>('/data/file_list'),
                    timeoutPromise
                ])

                if (response.code === 200) {
                    fileList.value = response.data
                    hasLoaded.value = true
                    console.log('✅ 文件列表加载成功:', response.data)
                    return
                } else {
                    console.error('❌ 加载文件列表失败:', response.msg)
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, delay))
                        delay *= 2
                        continue
                    }
                    loadMockData()
                }
            } catch (error) {
                lastError = error
                console.error(`❌ 加载文件列表失败 (尝试 ${attempt}/${maxRetries}):`, error)
                
                if (attempt < maxRetries) {
                    console.log(`等待 ${delay}ms 后重试...`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    delay *= 2
                }
            } finally {
                loading.value = false
            }
        }
        
        console.error('文件列表加载失败，已达到最大重试次数:', lastError)
        console.log('📝 使用模拟数据')
        loadMockData()
    }

    /**
     * 刷新文件列表（强制重新加载）
     */
    function refreshFileList() {
        hasLoaded.value = false  // 清除缓存标记
        loadFileList(true)       // 强制刷新
    }

    /**
     * 加载模拟数据（当后端不可用时）
     */
    function loadMockData() {
        fileList.value = [
            {
                id: '1',
                name: '企业规章制度.pdf',
                fileSize: 1024 * 1024 * 2.5,
                uploadTime: '2024-01-15 14:30:25',
                chunkCount: 45,
                vectorized: true,
                jsonCompleted: true,
            },
            {
                id: '2',
                name: '员工手册.docx',
                fileSize: 1024 * 512,
                uploadTime: '2024-01-10 09:15:30',
                chunkCount: 23,
                vectorized: true,
                jsonCompleted: true,
            },
            {
                id: '3',
                name: '培训资料.xlsx',
                fileSize: 1024 * 1024 * 1.2,
                uploadTime: '2024-01-08 16:45:10',
                chunkCount: 31,
                vectorized: true,
                jsonCompleted: false,
                progress: '处理 json 文档块中'
            },
            {
                id: '4',
                name: '会议记录.txt',
                fileSize: 1024 * 64,
                uploadTime: '2024-01-05 11:20:45',
                chunkCount: 8,
                vectorized: false,
                jsonCompleted: false,
                progress: '开始生成 json 块'
            },
            {
                id: '5',
                name: '技术文档.pdf',
                fileSize: 1024 * 1024 * 5.8,
                uploadTime: '2024-01-03 08:55:00',
                chunkCount: 128,
                vectorized: true,
                jsonCompleted: true,
            },
        ]
        console.log('✅ 模拟数据加载完成')
    }

    /**
     * 显示删除确认模态窗口
     */
    function showDeleteConfirmModal(fileName: string) {
        fileToDelete.value = fileName
        showDeleteConfirm.value = true
    }

    /**
     * 取消删除
     */
    function handleDeleteCancel() {
        showDeleteConfirm.value = false
        fileToDelete.value = ''
    }

    /**
     * 确认删除
     */
    async function handleDeleteConfirm() {
        const fileName = fileToDelete.value
        showDeleteConfirm.value = false
        
        try {
            const response = await deleteFileApi(fileName)
            if (response.code === 200) {
                fileList.value = fileList.value.filter(f => f.name !== fileName)
                removeDocument(fileName)
                deleteResultSuccess.value = true
                deleteResultMessage.value = '文件已成功删除'
                deleteResultFileName.value = fileName
            } else {
                const errorMsg = response.msg || '删除失败'
                const isNotExist = errorMsg.includes('不存在') || errorMsg.includes('not found') || errorMsg.includes('未找到')
                
                if (isNotExist) {
                    fileList.value = fileList.value.filter(f => f.name !== fileName)
                    removeDocument(fileName)
                    deleteResultSuccess.value = false
                    deleteResultMessage.value = '文件不存在，已从列表中移除'
                    deleteResultFileName.value = fileName
                } else {
                    deleteResultSuccess.value = false
                    deleteResultMessage.value = errorMsg
                    deleteResultFileName.value = fileName
                }
            }
        } catch (error) {
            console.error('删除文件失败:', error)
            deleteResultSuccess.value = false
            deleteResultMessage.value = '删除失败，请稍后重试'
            deleteResultFileName.value = fileName
        }
        
        deleteResultFileName.value = fileName
        showDeleteResult.value = true
        fileToDelete.value = ''
    }

    /**
     * 关闭删除结果模态窗口
     */
    function handleDeleteResultClose() {
        showDeleteResult.value = false
        deleteResultMessage.value = ''
        deleteResultFileName.value = ''
    }

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    function getFileIcon(name: string): string {
        const ext = name.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'pdf': return '📕'
            case 'docx':
            case 'doc': return '📘'
            case 'xlsx':
            case 'xls': return '📗'
            case 'txt': return '📄'
            default: return '📁'
        }
    }

    onMounted(() => {
        loadFileList()
    })
</script>

<template>
    <div class="file-management">
        <div class="management-header">
            <div class="header-content">
                <h1>📁 文件管理</h1>
                <p class="subtitle">管理系统中的文档文件及其处理状态</p>
            </div>
            <button class="btn-refresh" @click="refreshFileList" :disabled="loading">
                🔄 刷新
            </button>
        </div>

        <div v-if="loading" class="loading">
            <span class="loading-spinner"></span>
            加载中...
        </div>

        <div v-else class="file-grid">
            <div v-for="file in fileList" :key="file.id" class="file-card">
                <div class="card-header">
                    <span class="file-icon">{{ getFileIcon(file.name) }}</span>
                    <h3 class="file-name" :title="file.name">{{ file.name }}</h3>
                </div>

                <div class="card-body">
                    <div class="info-row">
                        <span class="label">📦 文件大小：</span>
                        <span class="value">{{ formatFileSize(file.fileSize) }}</span>
                    </div>

                    <div class="info-row">
                        <span class="label">📅 上传时间：</span>
                        <span class="value">{{ file.uploadTime }}</span>
                    </div>

                    <div class="info-row">
                        <span class="label">🧩 分块数：</span>
                        <span class="value">{{ file.chunkCount }} 个</span>
                    </div>

                    <!-- 进度条 -->
                    <div class="progress-section">
                        <div class="progress-header">
                            <span class="progress-label">📊 处理进度</span>
                            <span class="progress-text">{{ getFileProgress(file) || '处理中...' }}</span>
                        </div>
                        <div class="progress-bar">
                            <div 
                                class="progress-fill" 
                                :style="{ 
                                    width: getProgressPercentage(file) + '%',
                                    backgroundColor: getProgressColor(file)
                                }"
                            ></div>
                        </div>
                        <div class="progress-percentage">{{ getProgressPercentage(file) }}%</div>
                    </div>

                    <div class="status-row">
                        <div class="status-item">
                            <span class="status-icon" :class="{ success: file.vectorized }">
                                {{ file.vectorized ? '✅' : '⏳' }}
                            </span>
                            <span class="status-text">
                                向量化 {{ file.vectorized ? '成功' : '处理中' }}
                            </span>
                        </div>

                        <div class="status-item">
                            <span class="status-icon" :class="{ success: file.jsonCompleted }">
                                {{ file.jsonCompleted ? '✅' : '⏳' }}
                            </span>
                            <span class="status-text">
                                JSON化 {{ file.jsonCompleted ? '完成' : '处理中' }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="card-footer">
                    <button class="btn-delete" @click="showDeleteConfirmModal(file.name)">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        </div>

        <div v-if="!loading && fileList.length === 0" class="empty-state">
            <span class="empty-icon">📂</span>
            <p>暂无文件</p>
        </div>

        <!-- 删除确认模态窗口 -->
        <DeleteConfirmModal
            :visible="showDeleteConfirm"
            :fileName="fileToDelete"
            @cancel="handleDeleteCancel"
            @confirm="handleDeleteConfirm"
        />

        <!-- 删除结果模态窗口 -->
        <DeleteResultModal
            :visible="showDeleteResult"
            :success="deleteResultSuccess"
            :message="deleteResultMessage"
            :fileName="deleteResultFileName"
            @close="handleDeleteResultClose"
        />
    </div>
</template>

<style scoped>
    .file-management {
        height: 100%;
        padding: 0.75rem;
        background: #f5f7fa;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        box-sizing: border-box;
    }

    .management-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: white;
        padding: 1.25rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .header-content {
        flex: 1;
    }

    .management-header h1 {
        font-size: 1.75rem;
        font-weight: 600;
        color: #2c3e50;
        margin: 0 0 0.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .subtitle {
        color: #7f8c8d;
        font-size: 1rem;
        margin: 0;
        line-height: 1.5;
    }

    .btn-refresh {
        padding: 0.75rem 1.25rem;
        background: #f8fafc;
        color: #667eea;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .btn-refresh:hover:not(:disabled) {
        background: #f1f5f9;
        border-color: #667eea;
        color: #667eea;
    }

    .btn-refresh:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3rem;
        color: #7f8c8d;
        font-size: 1.1rem;
    }

    .loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 0.75rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .file-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
        padding: 0.75rem;
        max-height: calc(100vh - 180px);
    }

    .file-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        width: 100%;
        min-width: 200px;
    }

    .file-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .card-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.25rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .file-icon {
        font-size: 1.75rem;
    }

    .file-name {
        font-size: 1rem;
        font-weight: 500;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
    }

    .card-body {
        padding: 1.25rem;
        flex: 0 1 auto;
    }

    .info-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f0f0f0;
    }

    .info-row:last-of-type {
        border-bottom: none;
    }

    .label {
        color: #7f8c8d;
        font-size: 0.9rem;
    }

    .value {
        color: #2c3e50;
        font-weight: 500;
        font-size: 0.9rem;
    }

    /* 进度条样式 */
    .progress-section {
        margin: 1rem 0;
        padding: 0.75rem;
        background: #f8fafc;
        border-radius: 8px;
    }

    .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .progress-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: #475569;
    }

    .progress-text {
        font-size: 0.8rem;
        color: #64748b;
    }

    .progress-bar {
        width: 100%;
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 0.5rem;
    }

    .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease, background-color 0.3s ease;
        position: relative;
    }

    .progress-fill::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0) 100%
        );
        animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }

    .progress-percentage {
        text-align: right;
        font-size: 0.85rem;
        font-weight: 600;
        color: #475569;
    }

    .status-row {
        display: flex;
        justify-content: space-around;
        padding: 0.75rem 0;
        margin-top: 0.5rem;
        border-top: 1px solid #f0f0f0;
    }

    .status-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .status-icon {
        font-size: 1.25rem;
        transition: all 0.3s ease;
    }

    .status-icon.success {
        animation: pulse 0.5s ease;
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
    }

    .status-text {
        font-size: 0.85rem;
        color: #7f8c8d;
    }

    .card-footer {
        padding: 1rem 1.25rem;
        border-top: 1px solid #f0f0f0;
        background: #fafafa;
        flex-shrink: 0;
    }

    .btn-delete {
        width: 100%;
        padding: 0.625rem;
        background: #fee2e2;
        color: #dc2626;
        border: none;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-delete:hover {
        background: #fecaca;
    }

    .empty-state {
        text-align: center;
        padding: 4rem 2rem;
        color: #7f8c8d;
    }

    .empty-icon {
        font-size: 4rem;
        display: block;
        margin-bottom: 1rem;
        opacity: 0.5;
    }

    .empty-state p {
        font-size: 1.1rem;
        margin: 0;
    }
</style>