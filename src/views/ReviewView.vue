<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Question {
    id: number
    file_name: string
    topic_type: string
    topic_index: number
    topic: string
    choose: Record<string, string>
    answer: string | string[]
    explain: string
}

interface ExamData {
    title: string
    description: string
    questions: Question[]
}

interface ShortcutKeys {
    prevQuestion: string
    nextQuestion: string
}

interface ReviewSettings {
    shortcuts: ShortcutKeys
}

const defaultShortcuts: ShortcutKeys = {
    prevQuestion: 'ArrowLeft',
    nextQuestion: 'ArrowRight'
}

const defaultSettings: ReviewSettings = {
    shortcuts: { ...defaultShortcuts }
}

const route = useRoute()
const router = useRouter()

const examData = ref<ExamData>({
    title: '背题训练',
    description: '浏览题目及其解析，加深知识点理解',
    questions: []
})

const currentIndex = ref(0)
const currentFileName = ref('')
const elapsedSeconds = ref(0)
const timerInterval = ref<number | null>(null)
const direction = ref<'forward' | 'backward'>('forward')

const settings = ref<ReviewSettings>({ ...defaultSettings })
const showSettingsModal = ref(false)
const activeSettingTab = ref<'shortcut'>('shortcut')
const editingShortcut = ref<keyof ShortcutKeys | null>(null)
const questionGridRef = ref<HTMLDivElement | null>(null)
const questionBtnRefs = ref<(HTMLButtonElement | undefined)[]>([])

onMounted(() => {
    loadSettings()
    loadQuestions()
    startTimer()
    window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    if (timerInterval.value) {
        clearInterval(timerInterval.value)
    }
    window.removeEventListener('keydown', handleKeydown)
})

function loadSettings() {
    try {
        const saved = localStorage.getItem('review_settings')
        if (saved) {
            const parsed = JSON.parse(saved)
            settings.value = { ...defaultSettings, ...parsed }
        }
    } catch (e) {
        console.error('Failed to load settings:', e)
    }
}

function saveSettings() {
    try {
        localStorage.setItem('review_settings', JSON.stringify(settings.value))
    } catch (e) {
        console.error('Failed to save settings:', e)
    }
}

function loadQuestions() {
    try {
        const dataStr = route.query.data as string
        if (dataStr) {
            const questions = JSON.parse(dataStr)
            examData.value.questions = questions
            examData.value.title = '背题训练'
            examData.value.description = `共 ${questions.length} 道题目`
            
            if (questions.length > 0 && questions[0].file_name) {
                currentFileName.value = questions[0].file_name
            } else {
                currentFileName.value = route.query.file_name as string || '未知文档'
            }
        }
    } catch (error) {
        console.error('加载题目失败:', error)
        router.push('/')
    }
}

function startTimer() {
    if (timerInterval.value) {
        clearInterval(timerInterval.value)
    }
    timerInterval.value = window.setInterval(() => {
        elapsedSeconds.value++
    }, 1000)
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const currentQuestion = computed(() => examData.value.questions[currentIndex.value] || null)
const totalQuestions = computed(() => examData.value.questions.length)
const progress = computed(() => ((currentIndex.value + 1) / totalQuestions.value) * 100)

const currentOptions = computed(() => {
    if (!currentQuestion.value) return []
    
    const question = currentQuestion.value
    const options = Object.entries(question.choose)
    
    if (question.topic_type === '判断题' && options.length === 0) {
        return [
            { key: 'A', value: '正确' },
            { key: 'B', value: '错误' }
        ]
    }
    
    return options.map(([key, value]) => ({ key, value }))
})

const correctAnswers = computed(() => {
    if (!currentQuestion.value) return []
    const answer = currentQuestion.value.answer
    return Array.isArray(answer) ? answer : [answer]
})

function prevQuestion() {
    if (currentIndex.value > 0) {
        direction.value = 'backward'
        currentIndex.value--
        scrollToQuestion(currentIndex.value)
    }
}

function nextQuestion() {
    if (currentIndex.value < totalQuestions.value - 1) {
        direction.value = 'forward'
        currentIndex.value++
        scrollToQuestion(currentIndex.value)
    }
}

function goToQuestion(index: number) {
    if (index >= 0 && index < totalQuestions.value) {
        direction.value = index > currentIndex.value ? 'forward' : 'backward'
        currentIndex.value = index
        scrollToQuestion(index)
    }
}

function scrollToQuestion(index: number) {
    const btn = questionBtnRefs.value[index]
    if (btn && questionGridRef.value) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
}

function goHome() {
    router.push('/')
}

function openSettingsModal() {
    showSettingsModal.value = true
}

function closeSettingsModal() {
    showSettingsModal.value = false
    editingShortcut.value = null
}

function applySettings() {
    saveSettings()
    closeSettingsModal()
}

function formatShortcut(key: string): string {
    if (key === 'ArrowLeft') return '←'
    if (key === 'ArrowRight') return '→'
    if (key === 'ArrowUp') return '↑'
    if (key === 'ArrowDown') return '↓'
    if (key === 'Enter') return 'Enter'
    if (key === 'Space') return 'Space'
    if (key === 'Escape') return 'Esc'
    return key.replace('+', ' + ')
}

function startEditShortcut(key: keyof ShortcutKeys) {
    editingShortcut.value = key
}

function handleShortcutKeydown(e: KeyboardEvent) {
    if (!editingShortcut.value) return

    if (e.key === 'Escape') {
        editingShortcut.value = null
        return
    }

    e.preventDefault()
    
    let newKey = ''
    if (e.ctrlKey || e.metaKey) {
        newKey += 'Ctrl+'
    }
    if (e.shiftKey) {
        newKey += 'Shift+'
    }
    if (e.altKey) {
        newKey += 'Alt+'
    }
    
    const keyName = e.key === ' ' ? 'Space' : e.key
    newKey += keyName
    
    if (editingShortcut.value && newKey.length > 0) {
        settings.value.shortcuts[editingShortcut.value] = newKey
        editingShortcut.value = null
    }
}

function getKeyCombo(e: KeyboardEvent): string {
    let combo = ''
    if (e.ctrlKey || e.metaKey) {
        combo += 'Ctrl+'
    }
    if (e.shiftKey) {
        combo += 'Shift+'
    }
    if (e.altKey) {
        combo += 'Alt+'
    }
    const keyName = e.key === ' ' ? 'Space' : e.key
    return combo + keyName
}

function handleKeydown(e: KeyboardEvent) {
    if (showSettingsModal.value && editingShortcut.value) {
        handleShortcutKeydown(e)
        return
    }

    const keyCombo = getKeyCombo(e)
    const shortcuts = settings.value.shortcuts

    if (keyCombo === shortcuts.prevQuestion) {
        e.preventDefault()
        prevQuestion()
    } else if (keyCombo === shortcuts.nextQuestion) {
        e.preventDefault()
        nextQuestion()
    }
}
</script>

<template>
    <div class="review-container">
        <header class="review-header">
            <div class="header-left">
                <button class="nav-btn back-btn" @click="goHome">
                    ← 返回首页
                </button>
                <div class="nav-divider"></div>
                <h1>{{ examData.title }}</h1>
                <div class="nav-divider"></div>
                <div class="document-name" v-if="currentFileName" :title="currentFileName">
                    📁 {{ currentFileName }}
                </div>
            </div>
            <div class="header-right">
                <div class="right-controls">
                    <button class="nav-btn settings-btn" @click="openSettingsModal">
                        ⚙️ 设置
                    </button>
                    <div class="timer">
                        <span class="timer-icon">⏱️</span>
                        <span class="timer-text">{{ formatTime(elapsedSeconds) }}</span>
                    </div>
                </div>
            </div>

            <div v-if="showSettingsModal" class="settings-modal-overlay" @click.self="closeSettingsModal">
                <div class="settings-modal">
                    <div class="modal-header">
                        <h3>⚙️ 设置</h3>
                        <button class="close-btn" @click="closeSettingsModal">✕</button>
                    </div>
                    <div class="modal-body">
                        <aside class="settings-sidebar">
                            <button 
                                class="sidebar-item active"
                                @click="activeSettingTab = 'shortcut'"
                            >
                                <span class="sidebar-icon">⌨️</span>
                                <span class="sidebar-text">快捷键设置</span>
                            </button>
                        </aside>
                        <main class="settings-content">
                            <div v-if="activeSettingTab === 'shortcut'" class="settings-panel">
                                <h4>快捷键设置</h4>
                                <p class="shortcut-tip">点击快捷键按钮可自定义修改</p>
                                <div class="settings-item">
                                    <span class="shortcut-label">上一题</span>
                                    <button 
                                        class="shortcut-key"
                                        :class="{ editing: editingShortcut === 'prevQuestion' }"
                                        @click="startEditShortcut('prevQuestion')"
                                    >{{ formatShortcut(settings.shortcuts.prevQuestion) }}</button>
                                </div>
                                <div class="settings-item">
                                    <span class="shortcut-label">下一题</span>
                                    <button 
                                        class="shortcut-key"
                                        :class="{ editing: editingShortcut === 'nextQuestion' }"
                                        @click="startEditShortcut('nextQuestion')"
                                    >{{ formatShortcut(settings.shortcuts.nextQuestion) }}</button>
                                </div>
                                <div v-if="editingShortcut" class="editing-hint">
                                    ⌨️ 请按下新的快捷键（按 Esc 取消）
                                </div>
                            </div>
                        </main>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" @click="closeSettingsModal">取消</button>
                        <button class="btn-confirm" @click="applySettings">保存设置</button>
                    </div>
                </div>
            </div>
        </header>

        <main class="review-main">
            <aside class="question-list">
                <div class="list-header">
                    <h3>题目列表</h3>
                    <span class="progress-text">{{ currentIndex + 1 }} / {{ totalQuestions }}</span>
                </div>
                <div ref="questionGridRef" class="question-grid">
                    <button
                        v-for="(q, index) in examData.questions"
                        :key="q.id"
                        :ref="(el) => { if (el) questionBtnRefs[index] = el as HTMLButtonElement }"
                        class="question-btn"
                        :class="{ active: currentIndex === index }"
                        @click="goToQuestion(index)"
                    >
                        {{ index + 1 }}
                    </button>
                </div>
            </aside>

            <section class="question-content">
                <transition :name="direction === 'forward' ? 'question-forward' : 'question-backward'" mode="out-in">
                    <div :key="currentIndex" class="question-card" v-if="currentQuestion">
                        <div class="question-header">
                            <span class="question-type">{{ currentQuestion.topic_type }}</span>
                            <span class="question-id">第 {{ currentQuestion.topic_index || (currentIndex + 1) }} 题</span>
                        </div>

                        <div class="question-text">
                            <p>{{ currentQuestion.topic }}</p>
                        </div>

                        <div class="options-list">
                            <div
                                v-for="option in currentOptions"
                                :key="option.key"
                                class="option-item"
                                :class="{ correct: correctAnswers.includes(option.key) }"
                            >
                                <span class="option-key">{{ option.key }}</span>
                                <span class="option-value">{{ option.value }}</span>
                                <span v-if="correctAnswers.includes(option.key)" class="correct-badge">✓</span>
                            </div>
                        </div>

                        <div class="answer-section">
                            <div class="answer-header">
                                <span class="answer-icon">🎯</span>
                                <span class="answer-title">正确答案</span>
                            </div>
                            <div class="answer-content">
                                <span class="answer-value">{{ correctAnswers.join(', ') }}</span>
                            </div>
                        </div>

                        <div class="explanation-section">
                            <div class="explanation-header">
                                <span class="explanation-icon">💡</span>
                                <span class="explanation-title">答案解析</span>
                            </div>
                            <div class="explanation-content">
                                <p>{{ currentQuestion.explain }}</p>
                            </div>
                        </div>

                        <div class="navigation-buttons">
                            <button
                                class="nav-btn"
                                :disabled="currentIndex === 0"
                                @click="prevQuestion"
                            >
                                ← 上一题
                            </button>
                            <button
                                v-if="currentIndex < totalQuestions - 1"
                                class="nav-btn"
                                @click="nextQuestion"
                            >
                                下一题 →
                            </button>
                            <button
                                v-else
                                class="nav-btn submit"
                                @click="goHome"
                            >
                                完成背题
                            </button>
                        </div>
                    </div>
                </transition>
            </section>
        </main>
    </div>
</template>

<style scoped>
.review-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    flex-direction: column;
}

.review-header {
    background: white;
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    position: relative;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.header-left h1 {
    font-size: 1.3rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
}

.nav-divider {
    width: 1px;
    height: 1.5rem;
    background: #e2e8f0;
}

.document-name {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #f97316, #ea580c);
    color: white;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 250px;
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
}

.header-right {
    display: flex;
    align-items: center;
}

.right-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.nav-btn {
    padding: 0.6rem 1.25rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: #475569;
    transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.nav-btn.back-btn {
    padding: 0.5rem 1rem;
}

.nav-btn.settings-btn {
    padding: 0.5rem 1rem;
    background: #f8fafc;
}

.timer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 8px;
    color: white;
    font-weight: 500;
}

.timer-icon {
    font-size: 1rem;
}

.timer-text {
    font-family: monospace;
    font-size: 1rem;
}

.review-main {
    flex: 1;
    display: flex;
    padding: 1.5rem;
    gap: 1.5rem;
    overflow: hidden;
    max-height: calc(100vh - 88px);
}

.question-list {
    width: 230px;
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 160px);
}

.list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e2e8f0;
}

.list-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #334155;
}

.progress-text {
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 500;
}

.question-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.4rem;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

.question-btn {
    aspect-ratio: 1;
    border: 2px solid #e2e8f0;
    background: white;
    border-radius: 8px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.question-btn:hover {
    border-color: #667eea;
    color: #667eea;
}

.question-btn.active {
    border-color: #667eea;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.question-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.question-forward-enter-active,
.question-forward-leave-active,
.question-backward-enter-active,
.question-backward-leave-active {
    transition: all 0.3s ease;
}

.question-forward-enter-from {
    opacity: 0;
    transform: translateX(30px);
}

.question-forward-leave-to {
    opacity: 0;
    transform: translateX(-30px);
}

.question-backward-enter-from {
    opacity: 0;
    transform: translateX(-30px);
}

.question-backward-leave-to {
    opacity: 0;
    transform: translateX(30px);
}

.question-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.question-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-shrink: 0;
}

.question-type {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    padding: 0.35rem 0.875rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
}

.question-id {
    font-size: 0.9rem;
    color: #64748b;
    padding: 0.35rem 0;
}

.question-text {
    font-size: 1.1rem;
    color: #1e293b;
    line-height: 1.7;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
}

.question-text p {
    margin: 0;
}

.options-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1.5rem;
    flex-shrink: 0;
}

.option-item {
    display: flex;
    align-items: center;
    padding: 0.875rem 1rem;
    background: #f8fafc;
    border: 2px solid transparent;
    border-radius: 10px;
    transition: all 0.2s;
}

.option-item.correct {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
}

.option-key {
    font-weight: 600;
    color: #475569;
    min-width: 24px;
    font-size: 0.95rem;
}

.option-value {
    flex: 1;
    color: #334155;
    font-size: 0.95rem;
    line-height: 1.5;
}

.correct-badge {
    color: #10b981;
    font-weight: bold;
    font-size: 1.1rem;
    margin-left: 0.5rem;
}

.answer-section {
    background: rgba(16, 185, 129, 0.1);
    border-radius: 10px;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
    flex-shrink: 0;
}

.answer-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.answer-icon {
    font-size: 1rem;
}

.answer-title {
    font-weight: 600;
    color: #059669;
    font-size: 0.95rem;
}

.answer-content {
    padding-left: 1.5rem;
}

.answer-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #059669;
}

.explanation-section {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 10px;
    padding: 1.25rem;
    margin-bottom: 1rem;
    flex-shrink: 0;
    height: 120px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 12px;
}

.explanation-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.explanation-icon {
    font-size: 1.1rem;
}

.explanation-title {
    font-weight: 600;
    color: #92400e;
    font-size: 0.95rem;
}

.explanation-content {
    color: #78350f;
    line-height: 1.6;
}

.explanation-content p {
    margin: 0;
    font-size: 0.95rem;
}

.navigation-buttons {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: auto;
    flex-shrink: 0;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
}

.navigation-buttons .nav-btn {
    padding: 0.75rem 1.75rem;
    font-size: 0.95rem;
}

.navigation-buttons .nav-btn.submit {
    background: linear-gradient(135deg, #667eea, #764ba2);
    border: none;
    color: white;
}

.navigation-buttons .nav-btn.submit:hover:not(:disabled) {
    background: linear-gradient(135deg, #5a6fd6, #6b46c1);
}

.settings-modal-overlay {
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

.settings-modal {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    height: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.settings-modal .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
    flex-shrink: 0;
}

.settings-modal .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
}

.settings-modal .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
    padding: 0.25rem;
    border-radius: 6px;
    transition: background 0.2s;
}

.settings-modal .close-btn:hover {
    background: #f1f5f9;
    color: #334155;
}

.settings-modal .modal-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.settings-sidebar {
    width: 140px;
    background: #f8fafc;
    border-right: 1px solid #e2e8f0;
    padding: 1rem 0;
    flex-shrink: 0;
}

.sidebar-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: none;
    background: none;
    cursor: pointer;
    color: #64748b;
    font-size: 0.9rem;
    transition: all 0.2s;
    text-align: left;
}

.sidebar-item:hover {
    background: #f1f5f9;
    color: #334155;
}

.sidebar-item.active {
    background: #667eea;
    color: white;
}

.sidebar-icon {
    font-size: 1rem;
}

.sidebar-text {
    flex: 1;
}

.settings-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
}

.settings-panel h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e2e8f0;
}

.settings-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.875rem 0;
    color: #475569;
    font-size: 0.95rem;
    border-bottom: 1px solid #f1f5f9;
}

.settings-item:last-child {
    border-bottom: none;
}

.shortcut-label {
    color: #475569;
    font-size: 0.95rem;
}

.shortcut-key {
    padding: 0.3rem 0.75rem;
    background: #f1f5f9;
    border-radius: 6px;
    font-family: monospace;
    font-size: 0.85rem;
    color: #64748b;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.2s;
}

.shortcut-key:hover {
    background: #e2e8f0;
}

.shortcut-key.editing {
    background: #667eea;
    color: white;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0%, 100% {
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
    }
    50% {
        box-shadow: 0 0 0 6px rgba(102, 126, 234, 0.2);
    }
}

.shortcut-tip {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0 0 1rem;
}

.editing-hint {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #fef3c7;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #b45309;
    text-align: center;
}

.settings-modal .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #fafafa;
    flex-shrink: 0;
}

.settings-modal .btn-cancel,
.settings-modal .btn-confirm {
    padding: 0.6rem 1.5rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.settings-modal .btn-cancel {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;
}

.settings-modal .btn-cancel:hover {
    background: #f8fafc;
}

.settings-modal .btn-confirm {
    background: #667eea;
    border: none;
    color: white;
}

.settings-modal .btn-confirm:hover {
    background: #5a6fd6;
}
</style>
