<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface Task {
    id: string
    title: string
    description?: string
    dueDate?: string
    type: 'work' | 'study' | 'personal' | 'other'
    urgency: number // 1-10 紧急度
    importance: number // 1-5 重要度（星星数）
    status: 'pending' | 'overdue' | 'completed'
    createdAt: string
    completedAt?: string
}

const taskList = ref<Task[]>([])
const showModal = ref(false)
const showEditModal = ref(false)
const editingTask = ref<Task | null>(null)
const activeColumn = ref<string>('pending')

const newTask = ref<Partial<Task>>({
    title: '',
    description: '',
    dueDate: '',
    type: 'work',
    urgency: 5,
    importance: 3
})

// 用于实时刷新进度的时间戳
const currentTime = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

const taskTypes = [
    { value: 'work', label: '工作' },
    { value: 'study', label: '学习' },
    { value: 'personal', label: '个人' },
    { value: 'other', label: '其他' }
]

// 10级紧急度颜色（1级最紧急用红色，10级最不紧急用绿色）
const urgencyColors: Record<number, { color: string; bg: string; label: string }> = {
    1: { color: '#b91c1c', bg: '#fef2f2', label: '1级' },
    2: { color: '#dc2626', bg: '#fef2f2', label: '2级' },
    3: { color: '#ea580c', bg: '#fff7ed', label: '3级' },
    4: { color: '#f97316', bg: '#fff7ed', label: '4级' },
    5: { color: '#fbbf24', bg: '#fefce8', label: '5级' },
    6: { color: '#facc15', bg: '#fefce8', label: '6级' },
    7: { color: '#a3e635', bg: '#f7fee7', label: '7级' },
    8: { color: '#84cc16', bg: '#f7fee7', label: '8级' },
    9: { color: '#4ade80', bg: '#f0fdf4', label: '9级' },
    10: { color: '#22c55e', bg: '#f0fdf4', label: '10级' }
}

const STORAGE_KEY = 'task_manager_data'

// 计算权重（紧急度权重更高）
// 注意：紧急度1级最紧急（1天内），10级最不紧急（5月以上）
// 所以权重计算时需要反转：11 - urgency
function calculateWeight(urgency: number | undefined, importance: number | undefined): number {
    const u = typeof urgency === 'number' && urgency >= 1 && urgency <= 10 ? urgency : 5
    const i = typeof importance === 'number' && importance >= 1 && importance <= 5 ? importance : 3
    const urgencyWeight = (11 - u) * 10 // 1级=100, 10级=10
    const importanceWeight = i * 5      // 1星=5, 5星=25
    return urgencyWeight + importanceWeight
}

// 计算进度百分比（基于截止时间）
// 返回已消耗时间比例：0%表示刚开始，100%表示已超时
function calculateProgress(dueDate?: string, createdAt?: string): number {
    if (!dueDate) return 0 // 没有截止时间，始终显示0%
    
    const now = currentTime.value
    const due = new Date(dueDate)
    const start = createdAt ? new Date(createdAt) : now
    
    // 检查日期是否有效
    if (isNaN(due.getTime())) return 0
    if (isNaN(start.getTime())) return 0
    
    // 如果还没到创建时间（理论上不可能），返回0%
    if (now.getTime() <= start.getTime()) return 0
    
    // 如果已经超时，进度为100%（时间已全部耗尽）
    if (now.getTime() >= due.getTime()) return 100
    
    // 计算总时间和已消耗时间
    const totalTime = due.getTime() - start.getTime()
    const elapsedTime = now.getTime() - start.getTime()
    
    // 如果总时间为0或负数，返回100%
    if (totalTime <= 0) return 100
    
    // 计算已消耗时间百分比（从0%到100%）
    const elapsedPercent = (elapsedTime / totalTime) * 100
    
    return Math.min(100, Math.max(0, elapsedPercent))
}

// 计算剩余时间并格式化为 HH:MM:SS
function calculateRemainingTime(dueDate?: string): string {
    if (!dueDate) return '--:--:--'
    
    const now = currentTime.value
    const due = new Date(dueDate)
    
    // 检查日期是否有效
    if (isNaN(due.getTime())) return '--:--:--'
    
    // 计算剩余毫秒数
    const remainingMs = due.getTime() - now.getTime()
    
    // 如果已超时，返回负数或0
    if (remainingMs <= 0) return '00:00:00'
    
    // 转换为时分秒
    const totalSeconds = Math.floor(remainingMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// 获取进度条颜色
function getProgressColor(progress: number, urgency: number): string {
    if (progress <= 20) return '#ef4444'
    if (progress <= 40) return '#f97316'
    if (progress <= 60) return '#fbbf24'
    if (progress <= 80) return '#84cc16'
    return urgencyColors[urgency]?.color || '#22c55e'
}

// 获取紧急度颜色
function getUrgencyColor(urgency: number): string {
    return urgencyColors[urgency]?.color || '#64748b'
}

// 获取紧急度背景色
function getUrgencyBg(urgency: number): string {
    return urgencyColors[urgency]?.bg || '#f8fafc'
}

// 生成星星
function getStars(importance: number): string {
    return '★'.repeat(importance) + '☆'.repeat(5 - importance)
}

const pendingTasks = computed(() => {
    const now = new Date()
    return taskList.value
        .filter(task => task.status === 'pending' && (!task.dueDate || new Date(task.dueDate) >= now))
        .sort((a, b) => {
            const weightA = calculateWeight(a.urgency, a.importance)
            const weightB = calculateWeight(b.urgency, b.importance)
            return weightB - weightA
        })
})

const overdueTasks = computed(() => {
    const now = new Date()
    return taskList.value
        .filter(task => task.status === 'pending' && task.dueDate && new Date(task.dueDate) < now)
        .map(task => ({ ...task, status: 'overdue' as const }))
        .sort((a, b) => {
            const weightA = calculateWeight(a.urgency, a.importance)
            const weightB = calculateWeight(b.urgency, b.importance)
            return weightB - weightA
        })
})

const completedTasks = computed(() => {
    return taskList.value
        .filter(task => task.status === 'completed')
        .sort((a, b) => {
            if (a.completedAt && b.completedAt) {
                return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
            }
            return 0
        })
})

const pendingCount = computed(() => pendingTasks.value.length)
const overdueCount = computed(() => overdueTasks.value.length)
const completedCount = computed(() => completedTasks.value.length)

function loadTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            // 兼容旧数据格式
            taskList.value = parsed.map((task: any) => ({
                ...task,
                urgency: task.urgency || convertPriorityToUrgency(task.priority),
                importance: task.importance || convertImportance(task.importance)
            }))
        }
    } catch (error) {
        console.error('加载任务失败:', error)
    }
}

// 兼容旧数据转换
function convertPriorityToUrgency(priority: string): number {
    const map: Record<string, number> = {
        low: 2,
        medium: 5,
        high: 7,
        urgent: 9
    }
    return map[priority] || 5
}

function convertImportance(importance: string): number {
    const map: Record<string, number> = {
        low: 1,
        medium: 3,
        high: 5
    }
    return map[importance] || 3
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(taskList.value))
    } catch (error) {
        console.error('保存任务失败:', error)
    }
}

function generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function openAddModal() {
    // 设置默认截止时间为5小时后
    const now = new Date()
    const defaultDueDate = new Date(now.getTime() + 5 * 60 * 60 * 1000)
    
    // 格式化时间为本地时间格式
    const year = defaultDueDate.getFullYear()
    const month = String(defaultDueDate.getMonth() + 1).padStart(2, '0')
    const day = String(defaultDueDate.getDate()).padStart(2, '0')
    const hours = String(defaultDueDate.getHours()).padStart(2, '0')
    const minutes = String(defaultDueDate.getMinutes()).padStart(2, '0')
    
    const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`
    
    newTask.value = {
        title: '',
        description: '',
        dueDate: formattedDate,
        type: 'work',
        urgency: 5,
        importance: 3
    }
    showModal.value = true
}

function closeAddModal() {
    showModal.value = false
}

function addTask() {
    if (!newTask.value.title?.trim()) {
        alert('请输入任务标题')
        return
    }

    const task: Task = {
        id: generateId(),
        title: newTask.value.title.trim(),
        description: newTask.value.description?.trim() || '',
        dueDate: newTask.value.dueDate || '',
        type: newTask.value.type || 'work',
        urgency: newTask.value.urgency || 5,
        importance: newTask.value.importance || 3,
        status: 'pending',
        createdAt: new Date().toISOString()
    }

    taskList.value.push(task)
    saveTasks()
    closeAddModal()
}

function openEditModal(task: Task) {
    editingTask.value = { ...task }
    showEditModal.value = true
}

function closeEditModal() {
    showEditModal.value = false
    editingTask.value = null
}

function updateTask() {
    if (!editingTask.value || !editingTask.value.title?.trim()) {
        alert('请输入任务标题')
        return
    }

    const index = taskList.value.findIndex(t => t.id === editingTask.value!.id)
    if (index !== -1) {
        taskList.value[index] = { ...editingTask.value }
        saveTasks()
    }
    closeEditModal()
}

function deleteTask(taskId: string) {
    if (!confirm('确定要删除这个任务吗？')) {
        return
    }
    taskList.value = taskList.value.filter(t => t.id !== taskId)
    saveTasks()
}

function completeTask(taskId: string) {
    const task = taskList.value.find(t => t.id === taskId)
    if (task) {
        task.status = 'completed'
        task.completedAt = new Date().toISOString()
        saveTasks()
    }
}

function restoreTask(taskId: string) {
    const task = taskList.value.find(t => t.id === taskId)
    if (task) {
        task.status = 'pending'
        task.completedAt = undefined
        saveTasks()
    }
}

function getTaskTypeLabel(type: string): string {
    return taskTypes.find(t => t.value === type)?.label || '其他'
}

function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function setActiveColumn(column: string) {
    activeColumn.value = column
}

onMounted(() => {
    loadTasks()
    // 每秒钟更新当前时间，实现进度条实时刷新
    timer = setInterval(() => {
        currentTime.value = new Date()
    }, 1000)
})

onUnmounted(() => {
    // 清理定时器
    if (timer) {
        clearInterval(timer)
        timer = null
    }
})

watch(taskList, () => {
    saveTasks()
}, { deep: true })
</script>

<template>
    <div class="task-manager">
        <div class="task-header">
            <div class="header-content">
                <h1>任务事务管理</h1>
                <p class="subtitle">管理您的日常任务，跟踪进度和截止时间</p>
            </div>
            <div class="header-actions">
                <button class="btn-add" @click="openAddModal">
                    添加新任务
                </button>
            </div>
        </div>

        <div class="task-columns">
            <div 
                class="task-column"
                :class="{ 
                    'expanded': activeColumn === 'pending',
                    'collapsed': activeColumn !== 'pending' && activeColumn !== 'overdue'
                }"
                @click="setActiveColumn('pending')"
            >
                <div class="column-header pending-header">
                    <div class="column-title">
                        <h2>进行中</h2>
                        <span v-if="pendingCount > 0" class="badge">{{ pendingCount }}</span>
                    </div>
                    <div class="column-indicator"></div>
                </div>
                <div class="column-content">
                    <div v-if="pendingTasks.length === 0" class="empty-state">
                        <p>暂无进行中的任务</p>
                    </div>
                    <div v-else class="task-list">
                        <div 
                            v-for="task in pendingTasks.slice(0, activeColumn === 'pending' ? pendingTasks.length : 3)" 
                            :key="task.id" 
                            class="task-card"
                            :style="{ 
                                borderLeftColor: getUrgencyColor(task.urgency),
                                borderLeftWidth: '4px',
                                backgroundColor: getUrgencyBg(task.urgency)
                            }"
                            @click.stop
                        >
                            <div class="task-header-row">
                                <span class="urgency-badge" :style="{ backgroundColor: getUrgencyColor(task.urgency) }">
                                    紧急度: {{ task.urgency }}级
                                </span>
                                <span class="importance-stars" :style="{ color: getUrgencyColor(task.urgency) }">
                                    {{ getStars(task.importance) }}
                                </span>
                                <span class="weight-badge">
                                    权重: {{ calculateWeight(task.urgency, task.importance) }}
                                </span>
                            </div>
                            <div class="task-type-row">
                                <span class="label type-label">{{ getTaskTypeLabel(task.type) }}</span>
                                <span v-if="task.dueDate" class="task-due-badge">
                                    截止: {{ formatDate(task.dueDate) }}
                                </span>
                            </div>
                            <h3 class="task-title">{{ task.title }}</h3>
                            <p v-if="task.description" class="task-desc">{{ task.description }}</p>
                            
                            <div class="progress-section">
                                <div class="progress-header">
                                    <span class="progress-label">剩余时间</span>
                                    <span class="progress-time">{{ calculateRemainingTime(task.dueDate) }}</span>
                                </div>
                                <div class="progress-bar">
                                    <div 
                                        class="progress-fill" 
                                        :style="{ 
                                            width: calculateProgress(task.dueDate, task.createdAt) + '%',
                                            backgroundColor: getProgressColor(calculateProgress(task.dueDate, task.createdAt), task.urgency)
                                        }"
                                    ></div>
                                </div>
                            </div>
                            
                            <div class="task-actions">
                                <button class="btn-action btn-edit" @click="openEditModal(task)">编辑</button>
                                <button class="btn-action btn-complete" @click="completeTask(task.id)">完成</button>
                                <button class="btn-action btn-delete" @click="deleteTask(task.id)">删除</button>
                            </div>
                        </div>
                        <div v-if="pendingTasks.length > 3 && activeColumn !== 'pending'" class="expand-hint">
                            <span>点击展开查看全部 {{ pendingCount }} 个任务</span>
                        </div>
                    </div>
                </div>
            </div>

            <div 
                class="task-column"
                :class="{ 
                    'expanded': activeColumn === 'overdue',
                    'collapsed': activeColumn !== 'overdue' && activeColumn !== 'pending'
                }"
                @click="setActiveColumn('overdue')"
            >
                <div class="column-header overdue-header">
                    <div class="column-title">
                        <h2>已超时</h2>
                        <span v-if="overdueCount > 0" class="badge overdue-badge">{{ overdueCount }}</span>
                    </div>
                    <div class="column-indicator"></div>
                </div>
                <div class="column-content">
                    <div v-if="overdueTasks.length === 0" class="empty-state">
                        <p>太棒了！没有超时任务</p>
                    </div>
                    <div v-else class="task-list">
                        <div 
                            v-for="task in overdueTasks.slice(0, activeColumn === 'overdue' ? overdueTasks.length : 3)" 
                            :key="task.id" 
                            class="task-card overdue"
                            @click.stop
                        >
                            <div class="task-header-row">
                                <span class="overdue-badge">已超时</span>
                                <span class="urgency-badge" :style="{ backgroundColor: getUrgencyColor(task.urgency) }">
                                    紧急度: {{ task.urgency }}级
                                </span>
                                <span class="importance-stars" :style="{ color: getUrgencyColor(task.urgency) }">
                                    {{ getStars(task.importance) }}
                                </span>
                            </div>
                            <div class="task-type-row">
                                <span class="label type-label">{{ getTaskTypeLabel(task.type) }}</span>
                                <span v-if="task.dueDate" class="task-due-badge overdue-time">
                                    截止: {{ formatDate(task.dueDate) }}
                                </span>
                            </div>
                            <h3 class="task-title">{{ task.title }}</h3>
                            <p v-if="task.description" class="task-desc">{{ task.description }}</p>
                            
                            <div class="progress-section">
                                <div class="progress-header">
                                    <span class="progress-label overdue-text">已超时</span>
                                    <span class="progress-time overdue-text">00:00:00</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill overdue-fill" style="width: 100%"></div>
                                </div>
                            </div>
                            
                            <div class="task-actions">
                                <button class="btn-action btn-edit" @click="openEditModal(task)">编辑</button>
                                <button class="btn-action btn-complete" @click="completeTask(task.id)">完成</button>
                                <button class="btn-action btn-delete" @click="deleteTask(task.id)">删除</button>
                            </div>
                        </div>
                        <div v-if="overdueTasks.length > 3 && activeColumn !== 'overdue'" class="expand-hint">
                            <span>点击展开查看全部 {{ overdueCount }} 个任务</span>
                        </div>
                    </div>
                </div>
            </div>

            <div 
                class="task-column"
                :class="{ 
                    'expanded': activeColumn === 'completed',
                    'collapsed': activeColumn !== 'completed' && activeColumn !== 'pending' && activeColumn !== 'overdue'
                }"
                @click="setActiveColumn('completed')"
            >
                <div class="column-header completed-header">
                    <div class="column-title">
                        <h2>已完成</h2>
                        <span v-if="completedCount > 0" class="badge completed-badge">{{ completedCount }}</span>
                    </div>
                    <div class="column-indicator"></div>
                </div>
                <div class="column-content">
                    <div v-if="completedTasks.length === 0" class="empty-state">
                        <p>暂无已完成的任务</p>
                    </div>
                    <div v-else class="task-list">
                        <div 
                            v-for="task in completedTasks.slice(0, activeColumn === 'completed' ? completedTasks.length : 3)" 
                            :key="task.id" 
                            class="task-card completed"
                            @click.stop
                        >
                            <div class="task-header-row">
                                <span class="completed-badge">已完成</span>
                                <span class="importance-stars completed-stars">
                                    {{ getStars(task.importance) }}
                                </span>
                            </div>
                            <div class="task-type-row">
                                <span class="label type-label">{{ getTaskTypeLabel(task.type) }}</span>
                                <span v-if="task.completedAt" class="task-due-badge completed-time">
                                    完成: {{ formatDate(task.completedAt) }}
                                </span>
                            </div>
                            <h3 class="task-title">{{ task.title }}</h3>
                            <p v-if="task.description" class="task-desc">{{ task.description }}</p>
                            
                            <div class="progress-section">
                                <div class="progress-header">
                                    <span class="progress-label completed-text">已完成</span>
                                    <span class="progress-value completed-text">100%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill completed-fill" style="width: 100%"></div>
                                </div>
                            </div>
                            
                            <div class="task-actions">
                                <button class="btn-action btn-restore" @click="restoreTask(task.id)">恢复</button>
                                <button class="btn-action btn-delete" @click="deleteTask(task.id)">删除</button>
                            </div>
                        </div>
                        <div v-if="completedTasks.length > 3 && activeColumn !== 'completed'" class="expand-hint">
                            <span>点击展开查看全部 {{ completedCount }} 个任务</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click.self="closeAddModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>添加新任务</h3>
                    <button class="btn-close" @click="closeAddModal">X</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>任务标题 *</label>
                        <input 
                            v-model="newTask.title"
                            type="text"
                            placeholder="请输入任务标题"
                            class="form-input"
                        />
                    </div>
                    <div class="form-group">
                        <label>任务描述</label>
                        <textarea 
                            v-model="newTask.description"
                            placeholder="请输入任务描述（可选）"
                            class="form-textarea"
                            rows="3"
                        ></textarea>
                    </div>
                    <div class="form-group">
                        <label>截止时间</label>
                        <input 
                            v-model="newTask.dueDate"
                            type="datetime-local"
                            class="form-input"
                        />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>任务类型</label>
                            <select v-model="newTask.type" class="form-select">
                                <option v-for="type in taskTypes" :key="type.value" :value="type.value">
                                    {{ type.label }}
                                </option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>紧急度 (1-10级)</label>
                            <div class="urgency-slider">
                                <input 
                                    type="range" 
                                    v-model.number="newTask.urgency" 
                                    min="1" 
                                    max="10"
                                    class="slider"
                                />
                                <div class="urgency-display">
                                    <span 
                                        class="urgency-value"
                                        :style="{ color: getUrgencyColor(newTask.urgency || 5) }"
                                    >
                                        {{ newTask.urgency || 5 }}级
                                    </span>
                                    <span class="urgency-hint">({{ newTask.urgency && newTask.urgency >= 8 ? '5月以上' : newTask.urgency && newTask.urgency <= 2 ? '1天内' : '中等' }})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>重要度 (星星数量)</label>
                        <div class="importance-selector">
                            <button 
                                v-for="i in 5" 
                                :key="i"
                                type="button"
                                class="star-btn"
                                :class="{ active: newTask.importance === i }"
                                @click="newTask.importance = i"
                            >
                                {{ i <= (newTask.importance || 3) ? '★' : '☆' }}
                            </button>
                            <span class="importance-hint">{{ newTask.importance || 3 }}颗星</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" @click="closeAddModal">取消</button>
                    <button class="btn-submit" @click="addTask">添加任务</button>
                </div>
            </div>
        </div>

        <div v-if="showEditModal && editingTask" class="modal-overlay" @click.self="closeEditModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>编辑任务</h3>
                    <button class="btn-close" @click="closeEditModal">X</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>任务标题 *</label>
                        <input 
                            v-model="editingTask.title"
                            type="text"
                            placeholder="请输入任务标题"
                            class="form-input"
                        />
                    </div>
                    <div class="form-group">
                        <label>任务描述</label>
                        <textarea 
                            v-model="editingTask.description"
                            placeholder="请输入任务描述（可选）"
                            class="form-textarea"
                            rows="3"
                        ></textarea>
                    </div>
                    <div class="form-group">
                        <label>截止时间</label>
                        <input 
                            v-model="editingTask.dueDate"
                            type="datetime-local"
                            class="form-input"
                        />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>任务类型</label>
                            <select v-model="editingTask.type" class="form-select">
                                <option v-for="type in taskTypes" :key="type.value" :value="type.value">
                                    {{ type.label }}
                                </option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>紧急度 (1-10级)</label>
                            <div class="urgency-slider">
                                <input 
                                    type="range" 
                                    v-model.number="editingTask.urgency" 
                                    min="1" 
                                    max="10"
                                    class="slider"
                                />
                                <div class="urgency-display">
                                    <span 
                                        class="urgency-value"
                                        :style="{ color: getUrgencyColor(editingTask.urgency) }"
                                    >
                                        {{ editingTask.urgency }}级
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>重要度 (星星数量)</label>
                        <div class="importance-selector">
                            <button 
                                v-for="i in 5" 
                                :key="i"
                                type="button"
                                class="star-btn"
                                :class="{ active: editingTask.importance === i }"
                                @click="editingTask.importance = i"
                            >
                                {{ i <= editingTask.importance ? '★' : '☆' }}
                            </button>
                            <span class="importance-hint">{{ editingTask.importance }}颗星</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" @click="closeEditModal">取消</button>
                    <button class="btn-submit" @click="updateTask">保存修改</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.task-manager {
    padding: 1.5rem;
    height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
}

.task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    flex-shrink: 0;
}

.task-header h1 {
    font-size: 1.4rem;
    color: #1e293b;
    margin-bottom: 0.25rem;
}

.subtitle {
    color: #64748b;
    font-size: 0.85rem;
}

.btn-add {
    padding: 0.65rem 1.25rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.task-columns {
    display: flex;
    gap: 1rem;
    flex: 1;
    overflow: hidden;
}

.task-column {
    flex: 1;
    min-width: 280px;
    max-width: 100%;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
}

.task-column.expanded {
    flex: 2.5;
    min-width: 400px;
    border-color: #667eea;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
}

.task-column.collapsed {
    flex: 0.8;
    min-width: 200px;
}

.task-column:hover {
    border-color: #e2e8f0;
}

.task-column.expanded:hover {
    border-color: #667eea;
}

.column-header {
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 12px 12px 0 0;
}

.column-header.pending-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.column-header.overdue-header {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.column-header.completed-header {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.column-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.column-title h2 {
    font-size: 0.95rem;
    color: white;
    font-weight: 500;
}

.badge {
    background: rgba(255, 255, 255, 0.3);
    color: white;
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
}

.overdue-badge {
    background: #fee2e2;
    color: #dc2626;
}

.completed-badge {
    background: #dcfce7;
    color: #059669;
}

.column-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    transition: all 0.3s;
}

.task-column.expanded .column-indicator {
    width: 16px;
    height: 16px;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.column-content {
    flex: 1;
    padding: 0.75rem;
    overflow-y: auto;
    overflow-x: hidden;
}

.empty-state {
    text-align: center;
    padding: 2rem 1rem;
    color: #94a3b8;
    font-size: 0.85rem;
}

.task-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.task-card {
    padding: 0.875rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    cursor: default;
    transition: all 0.2s;
}

.task-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.task-card.overdue {
    background: #fef2f2;
    border-color: #fecaca;
}

.task-card.completed {
    background: #f0fdf4;
    border-color: #bbf7d0;
    opacity: 0.85;
}

.task-card.completed .task-title {
    text-decoration: line-through;
    color: #64748b;
}

.task-header-row {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
}

.urgency-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
}

.importance-stars {
    font-size: 0.9rem;
    letter-spacing: 1px;
}

.weight-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    background: #667eea;
    color: white;
}

.overdue-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    background: #ef4444;
    color: white;
}

.completed-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    background: #10b981;
    color: white;
}

.completed-stars {
    color: #10b981;
}

.task-type-row {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
}

.label {
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 500;
}

.type-label {
    background: #f1f5f9;
    color: #64748b;
}

.task-due-badge {
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.65rem;
    background: #f1f5f9;
    color: #64748b;
}

.task-due-badge.overdue-time {
    background: #fee2e2;
    color: #dc2626;
}

.task-due-badge.completed-time {
    background: #dcfce7;
    color: #059669;
}

.task-title {
    font-size: 0.9rem;
    color: #1e293b;
    margin-bottom: 0.35rem;
    font-weight: 500;
}

.task-desc {
    color: #64748b;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.progress-section {
    margin-bottom: 0.5rem;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
}

.progress-label {
    font-size: 0.7rem;
    color: #64748b;
}

.progress-value {
    font-size: 0.7rem;
    font-weight: 600;
    color: #64748b;
}

.progress-time {
    font-size: 0.8rem;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    color: #667eea;
    letter-spacing: 0.5px;
}

.progress-bar {
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.overdue-fill {
    background: linear-gradient(90deg, #ef4444, #dc2626);
}

.completed-fill {
    background: linear-gradient(90deg, #10b981, #059669);
}

.overdue-text {
    color: #ef4444;
}

.completed-text {
    color: #10b981;
}

.task-actions {
    display: flex;
    gap: 0.35rem;
}

.btn-action {
    padding: 0.3rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-edit {
    background: #e0e7ff;
    color: #4338ca;
}

.btn-edit:hover {
    background: #c7d2fe;
}

.btn-complete {
    background: #dcfce7;
    color: #16a34a;
}

.btn-complete:hover {
    background: #bbf7d0;
}

.btn-delete {
    background: #fee2e2;
    color: #dc2626;
}

.btn-delete:hover {
    background: #fecaca;
}

.btn-restore {
    background: #fef3c7;
    color: #d97706;
}

.btn-restore:hover {
    background: #fde68a;
}

.expand-hint {
    text-align: center;
    padding: 0.75rem;
    color: #667eea;
    font-size: 0.75rem;
    cursor: pointer;
    background: #f0f5ff;
    border-radius: 6px;
    margin-top: 0.25rem;
}

.expand-hint:hover {
    background: #e0e7ff;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
    font-size: 1.1rem;
    color: #1e293b;
}

.btn-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
}

.btn-close:hover {
    color: #334155;
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
}

.form-group {
    margin-bottom: 1.25rem;
}

.form-group label {
    display: block;
    font-size: 0.9rem;
    color: #475569;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.form-input,
.form-textarea,
.form-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
    resize: vertical;
    min-height: 80px;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.urgency-slider {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.slider {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: #e2e8f0;
    outline: none;
    -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #667eea;
    cursor: pointer;
}

.urgency-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.urgency-value {
    font-size: 0.9rem;
    font-weight: 600;
}

.urgency-hint {
    font-size: 0.75rem;
    color: #94a3b8;
}

.importance-selector {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.star-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #cbd5e1;
    transition: all 0.2s;
    padding: 0.25rem;
}

.star-btn.active,
.star-btn:hover {
    color: #fbbf24;
}

.importance-hint {
    margin-left: 0.75rem;
    font-size: 0.85rem;
    color: #64748b;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid #e2e8f0;
}

.btn-cancel,
.btn-submit {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-cancel {
    background: #f1f5f9;
    color: #475569;
}

.btn-cancel:hover {
    background: #e2e8f0;
}

.btn-submit {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-submit:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

@media (max-width: 768px) {
    .task-manager {
        padding: 1rem;
        height: auto;
        min-height: calc(100vh - 80px);
    }

    .task-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }

    .btn-add {
        width: 100%;
    }

    .task-columns {
        flex-direction: column;
        gap: 1rem;
        overflow: visible;
    }

    .task-column {
        min-width: auto;
        max-width: 100%;
    }

    .task-column.expanded,
    .task-column.collapsed {
        flex: 1;
        min-width: auto;
    }

    .form-row {
        grid-template-columns: 1fr;
    }
}
</style>
