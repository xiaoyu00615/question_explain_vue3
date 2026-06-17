<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addExerciseRecord, aiReview } from '../api/chat'
import SubmitModal from '../components/SubmitModal.vue'
import AiReviewModal from '../components/AiReviewModal.vue'

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
    duration: number
    test_type: string
    questions: Question[]
}

const route = useRoute()
const router = useRouter()

const mockQuestions: Question[] = [
    {
        "id": 1,
        "file_name": "信息通信网络运行管理员职业技能等级认定（四级） 理论考试复习资料.docx",
        "topic_type": "单选题",
        "topic_index": 1,
        "topic": "关于数据交换，下列叙述不正确的是 ( )。",
        "choose": {
            "A": "线路交换面向连接",
            "B": "分组交换比报文交换具有更好的网络响应速度",
            "C": "报文交换无存储转发过程",
            "D": "分组交换有存储转发过程"
        },
        "answer": "C",
        "explain": "解析：报文交换必须经过存储转发，所以 C 说法错误。线路交换：面向连接，独占线路；报文交换：存储转发，延迟大；分组交换：拆分小包转发，响应更快。"
    },
    {
        "id": 2,
        "file_name": "信息通信网络运行管理员职业技能等级认定（四级） 理论考试复习资料.docx",
        "topic_type": "判断题",
        "topic_index": 2,
        "topic": "计算机断电后，内存RAM中的数据会全部丢失。",
        "choose": {},
        "answer": "A",
        "explain": "解析：RAM是随机存取存储器，属于易失性存储，断电后数据会全部丢失。"
    },
    {
        "id": 3,
        "file_name": "信息通信网络运行管理员职业技能等级认定（四级） 理论考试复习资料.docx",
        "topic_type": "多选题",
        "topic_index": 3,
        "topic": "计算机的主要性能指标包括（）",
        "choose": {
            "A": "主频",
            "B": "字长",
            "C": "内存容量",
            "D": "外观颜色"
        },
        "answer": ["A", "B", "C"],
        "explain": "解析：主频决定CPU运算速度，字长影响数据处理精度，内存容量决定同时运行程序的能力；外观颜色不影响性能。"
    },
    {
        "id": 4,
        "file_name": "信息通信网络运行管理员职业技能等级认定（四级） 理论考试复习资料.docx",
        "topic_type": "填空题",
        "topic_index": 4,
        "topic": "计算机系统由______系统和______系统两大部分组成。",
        "choose": {},
        "answer": ["硬件", "软件"],
        "explain": "解析：计算机系统由硬件系统（如CPU、内存、I/O设备等物理部件）和软件系统（如操作系统、应用软件等程序和数据）组成，两者协同工作才能发挥计算机的功能。"
    },
    {
        "id": 5,
        "file_name": "信息通信网络运行管理员职业技能等级认定（四级） 理论考试复习资料.docx",
        "topic_type": "简答题",
        "topic_index": 5,
        "topic": "简述计算机日常维护与保养的基本要点。",
        "choose": {},
        "answer": "保持清洁：定期清理机箱内部（CPU散热器、风扇、电源）和外设（键盘、鼠标、显示器）的灰尘，防止积尘影响散热和电路安全。优化散热通风：将主机放置在通风良好处，避免堵塞进出风口；可适当使用散热底座（笔记本）；检查风扇运转是否正常。软件系统维护：定期更新操作系统和驱动程序；清理临时文件与无用注册表；卸载不常用软件；整理磁盘碎片（机械硬盘）或优化SSD（不进行碎片整理）。数据备份：定期将重要文件备份到外部存储或云端，防止硬盘故障或病毒导致数据丢失。安全防护：安装可靠杀毒软件并更新病毒库；不随意打开未知链接或下载可疑程序；启用防火墙。",
        "explain": "解析：计算机在日常使用中，硬件会老化、积尘，软件会产生垃圾文件、注册表冗余，还会面临病毒、误操作等风险。因此，定期维护保养能延长寿命、提升稳定性、保障数据安全。"
    }
]

const mockExamData: ExamData = {
    title: '题库练习',
    description: '信息通信网络运行管理员职业技能等级认定（四级）理论考试复习',
    duration: 30,
    test_type: '全量练习',
    questions: mockQuestions
}

const examData = ref<ExamData>(mockExamData)
const currentFileName = ref('')
const currentIndex = ref(0)
const selectedAnswers = ref<Map<number, string | string[]>>(new Map())
const confirmedQuestions = ref<Set<number>>(new Set())
const isSubmitted = ref(false)
const showResult = ref(false)
const showExplanation = ref(false)
const textAnswer = ref('')

// 记录每道题的开始答题时间
const questionStartTime = ref<Map<number, number>>(new Map())
// 记录每道题的答题时间（秒）
const questionAnswerTime = ref<Map<number, number>>(new Map())
const elapsedSeconds = ref(0)
const timerInterval = ref<number | null>(null)
const hasSavedRecord = ref(false)
const isSaving = ref(false)
const showSubmitModal = ref(false)
const submitModalStatus = ref<'loading' | 'success' | 'error'>('loading')

interface AIReviewResult {
    ai_score: number
    comment: string
    losePointReason: string
}

const aiReviewResults = ref<Map<number, AIReviewResult>>(new Map())
const isAiReviewing = ref(false)
const showAiReviewModal = ref(false)
// 综合应用题独立存储答案的 Map
const comprehensiveAnswers = ref<Map<number, string>>(new Map())
// 当前综合应用题的答案
const currentComprehensiveAnswer = ref('')
const aiReviewModalRef = ref<InstanceType<typeof AiReviewModal> | null>(null)
const currentAiReviewQuestionId = ref<number | null>(null)
const submitModalMessage = ref('正在保存练习记录...')
interface ShortcutKeys {
    prevQuestion: string
    nextQuestion: string
    confirmAnswer: string
    submitExam: string
    openSettings: string
}

interface ExamSettings {
    autoNextQuestion: boolean
    correctDelay: number
    wrongDelay: number
    showExplanation: boolean
    soundEnabled: boolean
    shortcuts: ShortcutKeys
}

const defaultShortcuts: ShortcutKeys = {
    prevQuestion: 'ArrowLeft',
    nextQuestion: 'ArrowRight',
    confirmAnswer: 'Enter',
    submitExam: 'Ctrl+Enter',
    openSettings: 'Ctrl+S'
}

const defaultSettings: ExamSettings = {
    autoNextQuestion: true,
    correctDelay: 5,
    wrongDelay: 8,
    showExplanation: true,
    soundEnabled: true,
    shortcuts: { ...defaultShortcuts }
}

const settings = ref<ExamSettings>({ ...defaultSettings })
const showSettingsModal = ref(false)
const activeSettingTab = ref<'answer' | 'shortcut' | 'sound'>('answer')
const selectedOptionIndex = ref(0)
const direction = ref<'forward' | 'backward'>('forward')
const editingShortcut = ref<keyof ShortcutKeys | null>(null)
const questionGridRef = ref<HTMLDivElement | null>(null)
const questionBtnRefs = ref<(HTMLButtonElement | undefined)[]>([])
const textInputRef = ref<HTMLTextAreaElement | null>(null)
let autoNextTimer: ReturnType<typeof setTimeout> | null = null

function loadSettings() {
    try {
        const saved = localStorage.getItem('exam_settings')
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
        localStorage.setItem('exam_settings', JSON.stringify(settings.value))
    } catch (e) {
        console.error('Failed to save settings:', e)
    }
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

function openSettingsModal() {
    showSettingsModal.value = true
}

function closeSettingsModal() {
    showSettingsModal.value = false
}

function applySettings() {
    saveSettings()
    closeSettingsModal()
}

function clearAutoNextTimer() {
    if (autoNextTimer) {
        clearTimeout(autoNextTimer)
        autoNextTimer = null
    }
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

const isCurrentQuestionConfirmed = computed(() => {
    const qid = currentQuestion.value?.id
    return qid !== undefined && confirmedQuestions.value.has(qid)
})

const confirmedCount = computed(() => confirmedQuestions.value.size)

const hasValidAnswer = computed(() => {
    const question = currentQuestion.value
    if (!question) return false
    
    // 填空题和简答题检查文本输入
    if (question.topic_type === '填空题' || question.topic_type === '简答题') {
        return textAnswer.value.trim().length > 0
    }
    
    // 综合应用题使用独立的答案
    if (question.topic_type === '综合应用题') {
        return currentComprehensiveAnswer.value.trim().length > 0
    }
    
    // 选择题检查选中的答案
    const answer = selectedAnswers.value.get(question.id)
    if (Array.isArray(answer)) {
        return answer.length > 0
    }
    return !!answer
})

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function selectAnswer(answer: string | string[]) {
    if (isCurrentQuestionConfirmed.value) return

    const question = currentQuestion.value
    if (!question) return

    const qid = question.id
    const type = question.topic_type

    // 如果是第一次选择这道题，记录开始时间
    if (!questionStartTime.value.has(qid)) {
        questionStartTime.value.set(qid, Date.now())
    }

    if (type === '多选题') {
        const current = (selectedAnswers.value.get(qid) as string[]) || []
        if (Array.isArray(answer)) {
            selectedAnswers.value.set(qid, [...current, ...answer])
        } else if (current.includes(answer)) {
            selectedAnswers.value.set(qid, current.filter(a => a !== answer))
        } else {
            selectedAnswers.value.set(qid, [...current, answer])
        }
    } else {
        selectedAnswers.value.set(qid, answer)
    }
}

function isSelected(optionKey: string): boolean {
    const question = currentQuestion.value
    if (!question) return false

    const answer = selectedAnswers.value.get(question.id)
    if (Array.isArray(answer)) {
        return answer.includes(optionKey)
    }
    return answer === optionKey
}

function formatCorrectAnswer(answer: string | string[] | undefined): string {
    if (!answer) return '无'
    
    if (Array.isArray(answer)) {
        return answer.join('、')
    }
    
    return answer
}

function isCorrect(): boolean {
    const question = currentQuestion.value
    if (!question) return false

    const userAnswer = selectedAnswers.value.get(question.id)
    if (!userAnswer) return false

    // 填空题处理：支持多种答案格式
    if (question.topic_type === '填空题') {
        const correctAnswer = question.answer
        const userInput = typeof userAnswer === 'string' ? userAnswer.trim() : userAnswer
        
        // 如果标准答案是数组
        if (Array.isArray(correctAnswer)) {
            // 用户答案是字符串，按逗号分割后比较
            if (typeof userInput === 'string') {
                const userAnswers = userInput.split(/[,，、]/).map(s => s.trim()).filter(s => s)
                // 检查每个用户答案是否在标准答案中
                return userAnswers.length > 0 && userAnswers.every(a => 
                    correctAnswer.some(c => c.trim().toLowerCase() === a.toLowerCase())
                )
            }
            // 用户答案是数组
            if (Array.isArray(userInput)) {
                return correctAnswer.length === userInput.length &&
                    correctAnswer.every(a => 
                        userInput.some(u => u.trim().toLowerCase() === a.trim().toLowerCase())
                    )
            }
        }
        
        // 标准答案是字符串
        if (typeof correctAnswer === 'string') {
            const userStr = typeof userInput === 'string' ? userInput : userInput.join(',')
            return userStr.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
        }
    }

    // 简答题和综合应用题处理：使用AI评阅分数判断
    if (question.topic_type === '简答题' || question.topic_type === '综合应用题') {
        const aiResult = aiReviewResults.value.get(question.id)
        if (aiResult) {
            // AI评分 >= 题目分值的70%即为正确
            const threshold = pointsPerQuestion.value * 0.7
            return aiResult.ai_score >= threshold
        }
        return false
    }

    // 选择题处理
    if (Array.isArray(question.answer)) {
        if (Array.isArray(userAnswer)) {
            return question.answer.length === userAnswer.length &&
                question.answer.every(a => userAnswer.includes(a))
        }
        return false
    }
    return userAnswer === question.answer
}

function prevQuestion() {
    if (currentIndex.value > 0) {
        saveCurrentTextAnswer(currentIndex.value)
        const newIndex = currentIndex.value - 1
        direction.value = 'backward'
        currentIndex.value = newIndex
        
        // 记录新题目的开始时间（对所有题型有效）
        const newQuestion = examData.value.questions[newIndex]
        if (newQuestion && !questionStartTime.value.has(newQuestion.id)) {
            questionStartTime.value.set(newQuestion.id, Date.now())
        }
        
        updateExplanation()
        scrollToQuestion(newIndex)
        loadTextAnswer(newIndex)
        focusTextInputDelayed()
    }
}

function nextQuestion() {
    clearAutoNextTimer()
    if (currentIndex.value < totalQuestions.value - 1) {
        saveCurrentTextAnswer(currentIndex.value)
        const newIndex = currentIndex.value + 1
        direction.value = 'forward'
        currentIndex.value = newIndex
        
        // 记录新题目的开始时间（对所有题型有效）
        const newQuestion = examData.value.questions[newIndex]
        if (newQuestion && !questionStartTime.value.has(newQuestion.id)) {
            questionStartTime.value.set(newQuestion.id, Date.now())
        }
        
        updateExplanation()
        resetSelectedOptionIndex()
        scrollToQuestion(newIndex)
        loadTextAnswer(newIndex)
        focusTextInputDelayed()
    }
}

function goToQuestion(index: number) {
    clearAutoNextTimer()
    if (index >= 0 && index < totalQuestions.value) {
        saveCurrentTextAnswer(currentIndex.value)
        direction.value = index > currentIndex.value ? 'forward' : 'backward'
        currentIndex.value = index
        
        // 记录新题目的开始时间（对所有题型有效）
        const newQuestion = examData.value.questions[index]
        if (newQuestion && !questionStartTime.value.has(newQuestion.id)) {
            questionStartTime.value.set(newQuestion.id, Date.now())
        }
        
        updateExplanation()
        resetSelectedOptionIndex()
        scrollToQuestion(index)
        loadTextAnswer(index)
        // 使用 requestAnimationFrame 确保在浏览器渲染完成后再聚焦
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                focusCurrentTextInput()
            })
        })
    }
}

// 聚焦到当前显示的文本输入框（不滚动页面）
function focusCurrentTextInput() {
    const questionContent = document.querySelector('.question-content') as HTMLElement
    if (!questionContent) return
    
    const cards = questionContent.querySelectorAll('.question-card')
    let currentTextarea: HTMLTextAreaElement | null = null
    
    for (const card of cards) {
        const style = window.getComputedStyle(card)
        if (style.opacity !== '0' && style.display !== 'none') {
            currentTextarea = card.querySelector('.fill-blank-textarea, .essay-textarea') as HTMLTextAreaElement
            if (currentTextarea) break
        }
    }
    
    if (currentTextarea) {
        // 只聚焦，不滚动页面
        currentTextarea.focus({ preventScroll: true })
        const length = currentTextarea.value.length
        currentTextarea.setSelectionRange(length, length)
    }
}

// transition 动画完成后的回调
function onQuestionEnter() {
    const question = currentQuestion.value
    if (question && (question.topic_type === '填空题' || question.topic_type === '简答题' || question.topic_type === '综合应用题')) {
        focusCurrentTextInput()
    }
}

function scrollToQuestion(index: number) {
    const btn = questionBtnRefs.value[index]
    if (btn && questionGridRef.value) {
        // 只在题目列表区域内滚动，不影响主页面
        questionGridRef.value.scrollTo({
            top: btn.offsetTop - questionGridRef.value.offsetTop - questionGridRef.value.clientHeight / 2 + btn.clientHeight / 2,
            behavior: 'smooth'
        })
    }
}

function updateExplanation() {
    const qid = currentQuestion.value?.id
    showExplanation.value = settings.value.showExplanation && qid !== undefined && confirmedQuestions.value.has(qid)
}

function confirmAnswer() {
    const qid = currentQuestion.value?.id
    if (qid === undefined) return

    const question = currentQuestion.value
    if (!question) return

    // 处理填空题和简答题
    if (question.topic_type === '填空题' || question.topic_type === '简答题') {
        if (!textAnswer.value.trim()) {
            alert('请先输入答案！')
            return
        }
        // 保存文本答案
        selectedAnswers.value.set(qid, textAnswer.value.trim())
    } else if (question.topic_type === '综合应用题') {
        // 综合应用题处理
        if (!currentComprehensiveAnswer.value.trim()) {
            alert('请先输入答案！')
            return
        }
    } else {
        // 选择题处理
        const userAnswer = selectedAnswers.value.get(qid)
        if (!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)) {
            alert('请先选择答案！')
            return
        }
    }

    // 记录答题时间
    const startTime = questionStartTime.value.get(qid)
    if (startTime) {
        const answerTime = (Date.now() - startTime) / 1000 // 转换为秒
        questionAnswerTime.value.set(qid, answerTime)
    } else {
        // 如果没有记录开始时间，设置为0
        questionAnswerTime.value.set(qid, 0)
    }

    // 对于填空题、简答题和综合应用题，先保存当前输入的文本答案
    if (question.topic_type === '填空题' || question.topic_type === '简答题') {
        selectedAnswers.value.set(qid, textAnswer.value.trim())
    } else if (question.topic_type === '综合应用题') {
        // 综合应用题使用独立的答案存储
        comprehensiveAnswers.value.set(qid, currentComprehensiveAnswer.value.trim())
        selectedAnswers.value.set(qid, currentComprehensiveAnswer.value.trim())
    }
    
    confirmedQuestions.value.add(qid)
    
    // 对于简答题和综合应用题，显示AI评阅模态框，不立即显示答案解析
    if (question.topic_type === '简答题' || question.topic_type === '综合应用题') {
        currentAiReviewQuestionId.value = qid
        showAiReviewModal.value = true
        showExplanation.value = false
        performAiReview(qid, question)
        return
    }
    
    // 非简答题，立即显示答案解析
    showExplanation.value = settings.value.showExplanation

    // 自动跳转到下一题（非简答题）
    if (settings.value.autoNextQuestion && currentIndex.value < totalQuestions.value - 1) {
        const delay = isCorrect() ? settings.value.correctDelay * 1000 : settings.value.wrongDelay * 1000
        clearAutoNextTimer()
        autoNextTimer = setTimeout(() => {
            nextQuestion()
        }, delay)
    }
}

async function performAiReview(qid: number, question: Question) {
    isAiReviewing.value = true
    
    try {
        // 综合应用题使用独立的答案存储
        const userAnswer = question.topic_type === '综合应用题'
            ? String(comprehensiveAnswers.value.get(qid) || currentComprehensiveAnswer.value || '')
            : String(selectedAnswers.value.get(qid) || '')
        const originAnswer = String(question.answer)
        
        const response = await aiReview(
            pointsPerQuestion.value,
            question.topic,
            originAnswer,
            userAnswer
        )
        
        if (response.code === 200 && response.data) {
            aiReviewResults.value.set(qid, response.data)
            // 更新模态框显示评阅结果
            aiReviewModalRef.value?.setResult(response.data)
            // AI评阅完成后立即显示答案解析
            showExplanation.value = settings.value.showExplanation
        } else {
            aiReviewModalRef.value?.setError()
        }
    } catch (error) {
        console.error('AI评阅失败:', error)
        aiReviewModalRef.value?.setError()
    } finally {
        isAiReviewing.value = false
    }
}

function handleAiReviewModalClose() {
    showAiReviewModal.value = false
    currentAiReviewQuestionId.value = null
    
    // AI评阅完成后显示答案解析
    showExplanation.value = settings.value.showExplanation
    
    // 关闭模态框后开始计时跳转下一题
    if (settings.value.autoNextQuestion && currentIndex.value < totalQuestions.value - 1) {
        const delay = settings.value.correctDelay * 1000
        clearAutoNextTimer()
        autoNextTimer = setTimeout(() => {
            nextQuestion()
        }, delay)
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

function stopTimer() {
    if (timerInterval.value) {
        clearInterval(timerInterval.value)
        timerInterval.value = null
    }
}

function goHome() {
    router.push('/')
}

const score = computed(() => {
    let total = 0
    examData.value.questions.forEach(q => {
        if (!confirmedQuestions.value.has(q.id)) return
        
        const userAnswer = selectedAnswers.value.get(q.id)
        if (q.topic_type === '多选题') {
            if (Array.isArray(q.answer) && Array.isArray(userAnswer)) {
                if (q.answer.length === userAnswer.length &&
                    q.answer.every(a => userAnswer.includes(a))) {
                    total++
                }
            }
        } else {
            if (userAnswer === q.answer) {
                total++
            }
        }
    })
    return total
})

const accuracy = computed(() => {
    // 使用总题目数计算正确率
    if (totalQuestions.value === 0) return 0
    return Math.round((score.value / totalQuestions.value) * 100)
})

const pointsPerQuestion = computed(() => {
    if (totalQuestions.value === 0) return 0
    return 100 / totalQuestions.value
})

const pointsPerQuestionDisplay = computed(() => {
    return pointsPerQuestion.value.toFixed(1)
})

function getQuestionScore(questionId: number): number {
    const q = examData.value.questions.find(q => q.id === questionId)
    if (!q || !confirmedQuestions.value.has(questionId)) return 0
    
    const userAnswer = selectedAnswers.value.get(questionId)
    if (!userAnswer) return -pointsPerQuestion.value
    
    if (q.topic_type === '多选题') {
        if (Array.isArray(q.answer) && Array.isArray(userAnswer)) {
            if (q.answer.length === userAnswer.length &&
                q.answer.every(a => userAnswer.includes(a))) {
                return pointsPerQuestion.value
            }
        }
    } else if (q.topic_type === '填空题') {
        // 填空题：正确答案可能是数组，需要特殊处理
        const correctAnswer = Array.isArray(q.answer) ? q.answer.join('、') : String(q.answer)
        const userAnswerStr = String(userAnswer)
        
        // 支持多种分隔符比较：逗号、顿号、空格，不考虑顺序
        const normalizeAnswer = (s: string) => {
            return s.replace(/[,，、\s]+/g, ',').replace(/^\s+|\s+$/g, '').split(',').sort().join(',')
        }
        
        if (normalizeAnswer(userAnswerStr) === normalizeAnswer(correctAnswer)) {
            return pointsPerQuestion.value
        }
    } else if (q.topic_type === '简答题' || q.topic_type === '综合应用题') {
        // 简答题和综合应用题：使用AI评阅分数判断
        // 如果AI评分 >= 题目分值的70%，视为正确，显示AI评分
        // 如果AI评分 > 0但 < 70%，显示AI评分（仍为正分）
        // 如果AI评分为0，显示负分（扣题目分值）
        const aiResult = aiReviewResults.value.get(questionId)
        if (aiResult) {
            if (aiResult.ai_score > 0) {
                return aiResult.ai_score
            } else {
                return -pointsPerQuestion.value
            }
        }
    } else {
        // 单选题、判断题
        if (userAnswer === q.answer) {
            return pointsPerQuestion.value
        }
    }
    return -pointsPerQuestion.value
}

const currentQuestionScore = computed(() => {
    const qid = currentQuestion.value?.id
    if (qid === undefined) return null
    return getQuestionScore(qid)
})

const currentAiReviewResult = computed(() => {
    const qid = currentQuestion.value?.id
    if (qid === undefined) return null
    return aiReviewResults.value.get(qid) || null
})

async function submitExam() {
    showResult.value = true
    isSubmitted.value = true
    stopTimer()
    
    // 避免重复保存
    if (hasSavedRecord.value) {
        return
    }
    
    // 显示模态框
    showSubmitModal.value = true
    submitModalStatus.value = 'loading'
    submitModalMessage.value = '正在保存练习记录...'
    
    // 保存练习记录
    try {
        isSaving.value = true
        
        // 计算总题目数
        const total = examData.value.questions.length
        
        // 计算各项统计数据
        let topicTrueNum = 0  // 答对的题目数
        let topicFalseNum = 0 // 答错的题目数
        let topicNullNum = 0  // 未答的题目数
        let totalAnswerTime = 0 // 答题总时长
        
        examData.value.questions.forEach(q => {
            const userAnswer = selectedAnswers.value.get(q.id)
            const answerTime = questionAnswerTime.value.get(q.id) || 0
            totalAnswerTime += answerTime
            
            if (!userAnswer) {
                // 未答的题目
                topicNullNum++
            } else {
                // 已答的题目，判断对错
                let isCorrect = false
                if (typeof q.answer === 'string') {
                    isCorrect = userAnswer === q.answer
                } else if (Array.isArray(q.answer)) {
                    const userAnswerArray = Array.isArray(userAnswer) ? userAnswer : (typeof userAnswer === 'string' ? userAnswer.split(',') : [])
                    isCorrect = userAnswerArray.length === q.answer.length && 
                        userAnswerArray.every((a: string) => (q.answer as string[]).includes(a))
                }
                
                if (isCorrect) {
                    topicTrueNum++
                } else {
                    topicFalseNum++
                }
            }
        })
        
        // 正确率 = 答对的题目数 / 总题目数 * 100
        const accuracyRate = total > 0 ? Math.round((topicTrueNum / total) * 100) : 0
        
        // 计算平均答题时间（只统计已答的题目）
        const answeredCount = topicTrueNum + topicFalseNum
        const averageAnswerTime = answeredCount > 0 ? parseFloat((totalAnswerTime / answeredCount).toFixed(2)) : 0
        
        // 构建筑内容
        const content = examData.value.questions.map(q => {
            const userAnswer = selectedAnswers.value.get(q.id)
            // 处理多选题情况，将数组转成逗号分隔的字符串
            const userAnswerStr = Array.isArray(userAnswer) ? userAnswer.join(',') : (userAnswer || '')
            
            // 判断是否答对
            let hasChooseTrue: boolean | null = null
            if (userAnswer) {
                if (typeof q.answer === 'string') {
                    hasChooseTrue = userAnswer === q.answer
                } else if (Array.isArray(q.answer)) {
                    const userAnswerArray = userAnswerStr.split(',')
                    hasChooseTrue = userAnswerArray.length === q.answer.length && 
                        userAnswerArray.every((a: string) => (q.answer as string[]).includes(a))
                }
            }
            
            // 获取答题时间
            const answerTime = questionAnswerTime.value.get(q.id) || 0
            
            // 根据答题时间计算等级
            let answerTimeStr = ''
            if (answerTime < 2) {
                answerTimeStr = 'L1-极快'
            } else if (answerTime < 5) {
                answerTimeStr = 'L2-较快'
            } else if (answerTime <= 30) {
                answerTimeStr = 'L3-正常'
            } else {
                answerTimeStr = 'L4-较慢'
            }
            
            // 计算该题得分
            const questionScore = getQuestionScore(q.id)
            
            return {
                id: q.id,
                topic: q.topic,
                topic_type: q.topic_type,
                topic_index: q.topic_index,
                answer: q.answer,
                userAnswer: userAnswerStr,
                choose: q.choose,
                has_choose_true: hasChooseTrue,
                answer_time: answerTime,
                answer_time_str: answerTimeStr,
                score: questionScore
            }
        })
        
        const recordData = {
            id: `exercise_${Date.now()}`,
            file_name: examData.value.questions[0]?.file_name || '',
            content,
            grades: {
                topic_true_num: topicTrueNum,
                totalQuestions: total,
                topic_false_num: topicFalseNum,
                topic_null_num: topicNullNum,
                answer_total_time: Math.round(totalAnswerTime),
                accuracy_raet: accuracyRate,
                average_answer_time: averageAnswerTime,
                test_type: examData.value.test_type || '全量练习',
                createTime: new Date().toISOString(),
                total_score: parseFloat((topicTrueNum * pointsPerQuestion.value).toFixed(1))
            }
        }
        
        const response = await addExerciseRecord(recordData)
        if (response.code === 200) {
            hasSavedRecord.value = true
            submitModalStatus.value = 'success'
            submitModalMessage.value = `练习记录保存成功！\n共 ${total} 题，答对 ${topicTrueNum} 题，正确率 ${accuracyRate}%`
            console.log('✅ 练习记录保存成功')
        } else {
            throw new Error(response.msg || '保存失败')
        }
    } catch (error) {
        console.error('保存练习记录失败:', error)
        submitModalStatus.value = 'error'
        submitModalMessage.value = error instanceof Error ? error.message : '保存练习记录失败，请重试'
    } finally {
        isSaving.value = false
    }
}

function handleSubmitModalClose() {
    showSubmitModal.value = false
}

function restartExam() {
    selectedAnswers.value.clear()
    confirmedQuestions.value.clear()
    currentIndex.value = 0
    showResult.value = false
    isSubmitted.value = false
    showExplanation.value = false
    elapsedSeconds.value = 0
    hasSavedRecord.value = false
    startTimer()
}

function getQuestionStatus(index: number): string {
    const question = examData.value.questions[index]
    if (!question) return 'unanswered'

    if (!confirmedQuestions.value.has(question.id)) {
        return 'unconfirmed'
    }

    const answer = selectedAnswers.value.get(question.id)

    if (!answer) {
        return 'unanswered'
    } else if (Array.isArray(answer)) {
        return answer.length > 0 ? 'answered' : 'unanswered'
    } else {
        return answer ? 'answered' : 'unanswered'
    }
}

function isQuestionCorrect(question: Question): boolean {
    const userAnswer = selectedAnswers.value.get(question.id)
    if (!userAnswer) return false

    // 填空题处理：支持多种答案格式
    if (question.topic_type === '填空题') {
        const correctAnswer = question.answer
        const userInput = typeof userAnswer === 'string' ? userAnswer.trim() : userAnswer
        
        if (Array.isArray(correctAnswer)) {
            if (typeof userInput === 'string') {
                const userAnswers = userInput.split(/[,，、]/).map(s => s.trim()).filter(s => s)
                return userAnswers.length > 0 && userAnswers.every(a => 
                    correctAnswer.some(c => c.trim().toLowerCase() === a.toLowerCase())
                )
            }
            if (Array.isArray(userInput)) {
                return correctAnswer.length === userInput.length &&
                    correctAnswer.every(a => 
                        userInput.some(u => u.trim().toLowerCase() === a.trim().toLowerCase())
                    )
            }
        }
        
        if (typeof correctAnswer === 'string') {
            const userStr = typeof userInput === 'string' ? userInput : userInput.join(',')
            return userStr.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
        }
    }

    // 简答题和综合应用题处理：使用AI评阅分数判断
    if (question.topic_type === '简答题' || question.topic_type === '综合应用题') {
        const aiResult = aiReviewResults.value.get(question.id)
        if (aiResult) {
            // AI评分 >= 题目分值的70%即为正确
            const threshold = pointsPerQuestion.value * 0.7
            return aiResult.ai_score >= threshold
        }
        return false
    }

    // 选择题处理
    if (Array.isArray(question.answer)) {
        if (Array.isArray(userAnswer)) {
            return question.answer.length === userAnswer.length &&
                question.answer.every(a => userAnswer.includes(a))
        }
        return false
    }

    return userAnswer === question.answer
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
    if (showSubmitModal.value || showResult.value) {
        return
    }

    if (showSettingsModal.value && editingShortcut.value) {
        handleShortcutKeydown(e)
        return
    }

    // 如果显示AI评阅模态框，不处理其他快捷键（让模态框自己处理）
    if (showAiReviewModal.value) {
        return
    }

    const keyCombo = getKeyCombo(e)
    const shortcuts = settings.value.shortcuts

    if (keyCombo === shortcuts.prevQuestion) {
        e.preventDefault()
        if (currentIndex.value > 0) {
            goToQuestion(currentIndex.value - 1)
        }
    } else if (keyCombo === shortcuts.nextQuestion) {
        e.preventDefault()
        if (currentIndex.value < totalQuestions.value - 1) {
            goToQuestion(currentIndex.value + 1)
        }
    } else if (keyCombo === shortcuts.confirmAnswer) {
        e.preventDefault()
        if (!isCurrentQuestionConfirmed.value) {
            confirmAnswer()
        }
    } else if (keyCombo === shortcuts.submitExam) {
        e.preventDefault()
        if (currentIndex.value === totalQuestions.value - 1 && !isSubmitted.value) {
            submitExam()
        }
    } else if (keyCombo === shortcuts.openSettings) {
        e.preventDefault()
        openSettingsModal()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        navigateOptions(e.key === 'ArrowDown')
    } else if (e.key === ' ' && currentQuestion.value?.topic_type === '多选题') {
        // 多选题按空格键选择/取消选择当前焦点选项
        e.preventDefault()
        toggleCurrentOption()
    } else if (e.key.toLowerCase() === 'i') {
        // 按 I 键聚焦到输入框（填空题、简答题、综合应用题）
        // 只有当没有聚焦到文本输入框时才阻止默认行为
        const activeElement = document.activeElement
        const isTextInput = activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'INPUT'
        if (!isTextInput) {
            e.preventDefault()
            focusTextInput()
        }
    }
}

function navigateOptions(isDown: boolean) {
    const options = currentOptions.value
    if (options.length === 0) return

    if (isDown) {
        selectedOptionIndex.value = (selectedOptionIndex.value + 1) % options.length
    } else {
        selectedOptionIndex.value = selectedOptionIndex.value === 0 ? options.length - 1 : selectedOptionIndex.value - 1
    }

    // 对于单选题，继续原来的行为（移动时自动选择）
    // 对于多选题，只移动焦点，不自动选择
    if (currentQuestion.value?.topic_type !== '多选题') {
        const selectedOption = options[selectedOptionIndex.value]
        if (selectedOption) {
            selectAnswer(selectedOption.key)
        }
    }
}

// 多选题：切换当前焦点选项的选择状态
function toggleCurrentOption() {
    if (isCurrentQuestionConfirmed.value) return
    
    const options = currentOptions.value
    const focusedOption = options[selectedOptionIndex.value]
    if (focusedOption) {
        selectAnswer(focusedOption.key)
    }
}

function resetSelectedOptionIndex() {
    selectedOptionIndex.value = 0
    
    const question = currentQuestion.value
    // 填空题、简答题和综合应用题不需要自动选择选项
    if (question && (question.topic_type === '填空题' || question.topic_type === '简答题' || question.topic_type === '综合应用题')) {
        return
    }
    
    // 多选题不自动选择选项，需要用户手动选择
    if (question && question.topic_type === '多选题') {
        return
    }
    
    const options = currentOptions.value
    if (options.length > 0) {
        const currentAnswer = selectedAnswers.value.get(currentQuestion.value?.id || 0)
        if (!currentAnswer && options[0]) {
            selectAnswer(options[0].key)
        }
    }
}

// 聚焦到文本输入框（填空题、简答题、综合应用题）
function focusTextInput() {
    const question = currentQuestion.value
    if (question && (question.topic_type === '填空题' || question.topic_type === '简答题' || question.topic_type === '综合应用题')) {
        nextTick(() => {
            const textarea = document.querySelector('.question-card textarea') as HTMLTextAreaElement
            textarea?.focus()
        })
    }
}

// 延迟聚焦到文本输入框（兼容旧调用）
function focusTextInputDelayed() {
    setTimeout(() => {
        const question = currentQuestion.value
        if (question && (question.topic_type === '填空题' || question.topic_type === '简答题' || question.topic_type === '综合应用题')) {
            const questionContent = document.querySelector('.question-content') as HTMLElement
            if (questionContent) {
                const cards = questionContent.querySelectorAll('.question-card')
                let currentTextarea: HTMLTextAreaElement | null = null
                
                for (const card of cards) {
                    const style = window.getComputedStyle(card)
                    if (style.opacity !== '0' && style.display !== 'none') {
                        currentTextarea = card.querySelector('.fill-blank-textarea, .essay-textarea') as HTMLTextAreaElement
                        if (currentTextarea) break
                    }
                }
                
                if (currentTextarea) {
                    currentTextarea.focus({ preventScroll: true })
                    const length = currentTextarea.value.length
                    currentTextarea.setSelectionRange(length, length)
                }
            }
        }
    }, 300)
}

// 关闭AI评阅模态框
function closeAiReviewModal() {
    if (showAiReviewModal.value) {
        showAiReviewModal.value = false
        // 关闭模态框后开始计时跳转下一题
        handleAiReviewModalClose()
    }
}

function saveCurrentTextAnswer(index?: number) {
    // 使用传入的索引或当前索引获取题目
    const idx = index !== undefined ? index : currentIndex.value
    const question = examData.value.questions[idx]
    if (question) {
        const qid = question.id
        if (question.topic_type === '填空题' || question.topic_type === '简答题' || question.topic_type === '综合应用题') {
            selectedAnswers.value.set(qid, textAnswer.value)
        }
    }
}

function loadTextAnswer(index?: number) {
    // 使用传入的索引或当前索引获取题目
    const idx = index !== undefined ? index : currentIndex.value
    const question = examData.value.questions[idx]
    
    // 只有填空题、简答题和综合应用题才需要加载文本答案
    if (!question || (question.topic_type !== '填空题' && question.topic_type !== '简答题' && question.topic_type !== '综合应用题')) {
        textAnswer.value = ''
        currentComprehensiveAnswer.value = ''
        return
    }
    
    const qid = question.id
    const answer = selectedAnswers.value.get(qid)
    // 根据题型加载对应的答案
    if (question.topic_type === '综合应用题') {
        // 综合应用题使用独立的答案
        currentComprehensiveAnswer.value = typeof answer === 'string' && answer ? answer : ''
    } else {
        // 填空题和简答题使用 textAnswer
        textAnswer.value = typeof answer === 'string' && answer ? answer : ''
    }
}

onMounted(() => {
    loadSettings()
    
    const dataFromQuery = route.query.data as string
    const typeFromQuery = route.query.type as string

    // 根据练习类型设置显示名称
    const testTypeMap: Record<string, string> = {
        'full': '全量练习',
        'random': '随机练习',
        'chapter': '背题训练',
        'mistake': '错题重做'
    }
    const testType = testTypeMap[typeFromQuery] || '全量练习'

    if (dataFromQuery) {
        try {
            // 先尝试解码，如果失败则直接使用原始数据
            let decodedData = dataFromQuery
            try {
                decodedData = decodeURIComponent(dataFromQuery)
            } catch (decodeError) {
                console.warn('URL decode failed, using original data')
            }
            
            const parsedData = JSON.parse(decodedData)

            if (Array.isArray(parsedData)) {
                // 获取文件名
                const fileName = parsedData.length > 0 && parsedData[0].file_name 
                    ? parsedData[0].file_name 
                    : (route.query.file_name as string || '未知文档')
                
                // 设置当前文件名
                currentFileName.value = fileName
                
                examData.value = {
                    title: testType,
                    description: `当前文档：${fileName}`,
                    duration: 30,
                    test_type: testType,
                    questions: parsedData
                }
                console.log('Loaded questions from route params:', parsedData.length, 'test_type:', testType, 'file:', fileName)
            } else if (parsedData.questions) {
                examData.value = {
                    ...parsedData,
                    title: parsedData.title || testType,
                    test_type: parsedData.test_type || testType
                }
                console.log('Loaded exam data from route params:', parsedData.questions.length, 'test_type:', examData.value.test_type)
            }
        } catch (error) {
            console.error('Failed to parse question data:', error)
        }
    } else {
        console.log('No question data received, using default test data')
    }

    startTimer()
    resetSelectedOptionIndex()
    window.addEventListener('keydown', handleKeydown)
    
    // 记录第一道题的开始时间
    const firstQuestion = examData.value.questions[0]
    if (firstQuestion && !questionStartTime.value.has(firstQuestion.id)) {
        questionStartTime.value.set(firstQuestion.id, Date.now())
    }
    
    // 初始加载时如果是文本类题目，自动聚焦输入框
    nextTick(() => {
        focusTextInputDelayed()
    })
})

onUnmounted(() => {
    if (timerInterval.value) {
        clearInterval(timerInterval.value)
    }
    window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
    <div class="exam-container">
        <header class="exam-header">
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
                    <div class="confirmed-badge" v-if="confirmedCount > 0">
                        ✅ 已确认 {{ confirmedCount }}/{{ totalQuestions }}
                    </div>
                    <button class="nav-btn settings-btn" @click="openSettingsModal">
                        ⚙️ 设置
                    </button>
                    <div class="timer" :class="{ stopped: isSubmitted }">
                        <span class="timer-icon">⏱️</span>
                        <span class="timer-text">{{ formatTime(elapsedSeconds) }}</span>
                        <span v-if="isSubmitted" class="timer-status">已暂停</span>
                    </div>
                    
                </div>
            </div>
            
            <!-- 设置模态窗口 -->
            <div v-if="showSettingsModal" class="settings-modal-overlay" @click.self="closeSettingsModal">
                <div class="settings-modal">
                    <div class="modal-header">
                        <h3>⚙️ 设置</h3>
                        <button class="close-btn" @click="closeSettingsModal">✕</button>
                    </div>
                    <div class="modal-body">
                        <aside class="settings-sidebar">
                            <button 
                                class="sidebar-item" 
                                :class="{ active: activeSettingTab === 'answer' }"
                                @click="activeSettingTab = 'answer'"
                            >
                                <span class="sidebar-icon">📝</span>
                                <span class="sidebar-text">答题设置</span>
                            </button>
                            <button 
                                class="sidebar-item" 
                                :class="{ active: activeSettingTab === 'shortcut' }"
                                @click="activeSettingTab = 'shortcut'"
                            >
                                <span class="sidebar-icon">⌨️</span>
                                <span class="sidebar-text">快捷键设置</span>
                            </button>
                            <button 
                                class="sidebar-item" 
                                :class="{ active: activeSettingTab === 'sound' }"
                                @click="activeSettingTab = 'sound'"
                            >
                                <span class="sidebar-icon">🔊</span>
                                <span class="sidebar-text">音效设置</span>
                            </button>
                        </aside>
                        <main class="settings-content">
                            <div v-if="activeSettingTab === 'answer'" class="settings-panel">
                                <h4>答题设置</h4>
                                <div class="settings-item">
                                    <label>
                                        <input type="checkbox" v-model="settings.showExplanation" />
                                        <span>显示答案解析</span>
                                    </label>
                                </div>
                                <div class="settings-item">
                                    <label>
                                        <input type="checkbox" v-model="settings.autoNextQuestion" />
                                        <span>自动下一题</span>
                                    </label>
                                </div>
                                <div v-if="settings.autoNextQuestion" class="delay-settings">
                                    <div class="delay-item">
                                        <label>
                                            <span>答题正确延迟：</span>
                                            <input type="number" v-model.number="settings.correctDelay" min="1" max="60" />
                                            <span>秒</span>
                                        </label>
                                    </div>
                                    <div class="delay-item">
                                        <label>
                                            <span>答题错误延迟：</span>
                                            <input type="number" v-model.number="settings.wrongDelay" min="1" max="60" />
                                            <span>秒</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
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
                                <div class="settings-item">
                                    <span class="shortcut-label">确认答案</span>
                                    <button 
                                        class="shortcut-key"
                                        :class="{ editing: editingShortcut === 'confirmAnswer' }"
                                        @click="startEditShortcut('confirmAnswer')"
                                    >{{ formatShortcut(settings.shortcuts.confirmAnswer) }}</button>
                                </div>
                                <div class="settings-item">
                                    <span class="shortcut-label">提交结果</span>
                                    <button 
                                        class="shortcut-key"
                                        :class="{ editing: editingShortcut === 'submitExam' }"
                                        @click="startEditShortcut('submitExam')"
                                    >{{ formatShortcut(settings.shortcuts.submitExam) }}</button>
                                </div>
                                <div class="settings-item">
                                    <span class="shortcut-label">打开设置</span>
                                    <button 
                                        class="shortcut-key"
                                        :class="{ editing: editingShortcut === 'openSettings' }"
                                        @click="startEditShortcut('openSettings')"
                                    >{{ formatShortcut(settings.shortcuts.openSettings) }}</button>
                                </div>
                                <div v-if="editingShortcut" class="editing-hint">
                                    ⌨️ 请按下新的快捷键（按 Esc 取消）
                                </div>
                            </div>
                            <div v-if="activeSettingTab === 'sound'" class="settings-panel">
                                <h4>音效设置</h4>
                                <div class="settings-item">
                                    <label>
                                        <input type="checkbox" v-model="settings.soundEnabled" />
                                        <span>答题音效</span>
                                    </label>
                                </div>
                                <div class="settings-item">
                                    <span class="sound-label">正确提示音</span>
                                    <select class="sound-select">
                                        <option>默认</option>
                                        <option>清脆</option>
                                        <option>柔和</option>
                                    </select>
                                </div>
                                <div class="settings-item">
                                    <span class="sound-label">错误提示音</span>
                                    <select class="sound-select">
                                        <option>默认</option>
                                        <option>低沉</option>
                                        <option>警示</option>
                                    </select>
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

        <main class="exam-main">
            <aside class="question-list">
                <div class="list-header">
                    <h3>题目列表</h3>
                    <span class="score-info">{{ pointsPerQuestionDisplay }}分/题</span>
                    <span class="progress-text">{{ currentIndex + 1 }} / {{ totalQuestions }}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: progress + '%' }"></div>
                </div>
                <div class="questions-container">
                    <div ref="questionGridRef" class="questions-grid">
                        <button
                            v-for="(q, index) in examData.questions"
                            :key="q.id"
                            :ref="(el) => { if (el) questionBtnRefs[index] = el as HTMLButtonElement }"
                            class="question-btn"
                            :class="{
                                active: currentIndex === index,
                                confirmed: confirmedQuestions.has(q.id),
                                correct: confirmedQuestions.has(q.id) && isQuestionCorrect(q),
                                incorrect: confirmedQuestions.has(q.id) && !isQuestionCorrect(q),
                                unconfirmed: !confirmedQuestions.has(q.id)
                            }"
                            @click="goToQuestion(index)"
                        >
                            {{ index + 1 }}
                        </button>
                    </div>
                </div>
            </aside>

            <section class="question-content">
                <transition :name="direction === 'forward' ? 'question-forward' : 'question-backward'" mode="out-in" @after-enter="onQuestionEnter">
                    <div :key="currentIndex" class="question-card">
                        <div class="question-header">
                            <span class="question-type">{{ currentQuestion?.topic_type }}</span>
                            <span class="question-id">第 {{ currentQuestion?.topic_index || (currentIndex + 1) }} 题</span>
                            <span v-if="isCurrentQuestionConfirmed" class="confirmed-badge-small">✓ 已确认</span>
                            <!-- 简答题和综合应用题需要等待AI评阅完成后再显示结果 -->
                            <template v-if="isCurrentQuestionConfirmed">
                                <template v-if="(currentQuestion?.topic_type === '简答题' || currentQuestion?.topic_type === '综合应用题') ? aiReviewResults.has(currentQuestion?.id) : true">
                                    <span class="answer-result" :class="isCorrect() ? 'correct' : 'incorrect'">
                                        {{ isCorrect() ? '正确' : '错误' }}
                                    </span>
                                    <span v-if="currentQuestionScore !== null" class="score-badge" :class="currentQuestionScore > 0 ? 'positive' : 'negative'">
                                        {{ currentQuestionScore > 0 ? '+' : '' }}{{ currentQuestionScore.toFixed(1) }}分
                                    </span>
                                </template>
                            </template>
                        </div>

                        <!-- 主题干 -->
                        <div v-if="currentQuestion?.main_topic" class="main-topic-section">
                            <div class="main-topic-header">
                                <span class="main-topic-icon">📋</span>
                                <span class="main-topic-title">主题干</span>
                            </div>
                            <div class="main-topic-content">
                                <p>{{ currentQuestion?.main_topic }}</p>
                            </div>
                        </div>

                        <div class="question-text">
                            <p>{{ currentQuestion?.topic }}</p>
                        </div>

                        <!-- 选择题、判断题的选项 -->
                        <div v-if="currentQuestion?.topic_type === '单选题' || currentQuestion?.topic_type === '多选题' || currentQuestion?.topic_type === '判断题'" class="options-list">
                            <div
                                v-for="(option, index) in currentOptions"
                                :key="option.key"
                                class="option-item"
                                :class="{
                                    selected: isSelected(option.key),
                                    focused: currentQuestion?.topic_type === '多选题' && selectedOptionIndex === index && !isCurrentQuestionConfirmed,
                                    correct: isCurrentQuestionConfirmed && 
                                        (typeof currentQuestion?.answer === 'string' && currentQuestion?.answer === option.key ||
                                         Array.isArray(currentQuestion?.answer) && (currentQuestion?.answer as string[]).includes(option.key)),
                                    incorrect: isCurrentQuestionConfirmed && isSelected(option.key) && 
                                        (typeof currentQuestion?.answer === 'string' && currentQuestion?.answer !== option.key ||
                                         Array.isArray(currentQuestion?.answer) && !(currentQuestion?.answer as string[]).includes(option.key)),
                                    locked: isCurrentQuestionConfirmed
                                }"
                                @click="selectAnswer(option.key)"
                            >
                                <span class="option-key">{{ option.key }}</span>
                                <span class="option-value">{{ option.value }}</span>
                            </div>
                        </div>

                        <!-- 填空题输入框 -->
                        <div v-else-if="currentQuestion?.topic_type === '填空题'" class="fill-blank-section">
                            <div class="fill-blank-input">
                                <textarea
                                    ref="textInputRef"
                                    v-model="textAnswer"
                                    :disabled="isCurrentQuestionConfirmed"
                                    class="fill-blank-textarea"
                                    placeholder="请输入填空题答案，多个答案用 ， 分隔..."
                                    rows="3"
                                ></textarea>
                            </div>
                        </div>

                        <!-- 简答题输入框 -->
                        <div v-else-if="currentQuestion?.topic_type === '简答题'" class="essay-section">
                            <div class="essay-input">
                                <textarea
                                    ref="textInputRef"
                                    v-model="textAnswer"
                                    :disabled="isCurrentQuestionConfirmed"
                                    class="essay-textarea"
                                    placeholder="请输入简答题答案..."
                                    rows="6"
                                ></textarea>
                            </div>
                        </div>

                        <!-- 综合应用题输入框 - 使用独立的 currentComprehensiveAnswer -->
                        <div v-else-if="currentQuestion?.topic_type === '综合应用题'" class="essay-section">
                            <div class="essay-input">
                                <textarea
                                    ref="textInputRef"
                                    v-model="currentComprehensiveAnswer"
                                    :disabled="isCurrentQuestionConfirmed"
                                    class="essay-textarea comprehensive"
                                    placeholder="请详细解答综合应用题..."
                                    rows="10"
                                ></textarea>
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
                            v-if="!isCurrentQuestionConfirmed"
                            class="nav-btn confirm"
                            :disabled="!hasValidAnswer"
                            @click="confirmAnswer"
                        >
                            ✓ 确认答案
                        </button>
                        
                        <button
                            v-else
                            class="nav-btn confirmed"
                        >
                            ✓ 已确认
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
                            :disabled="hasSavedRecord || isSaving"
                            @click="submitExam"
                        >
                            {{ isSaving ? '保存中...' : hasSavedRecord ? '已保存' : '提交结果' }}
                        </button>
                    </div>

                    <div v-if="showExplanation" class="explanation-section">
                            <div class="explanation-header">
                                <span class="explanation-icon">💡</span>
                                <span class="explanation-title">答案解析</span>
                            </div>
                            
                            <!-- 正确答案块 -->
                            <div class="correct-answer-block">
                                <div class="correct-answer-header">
                                    <span class="correct-answer-icon">✓</span>
                                    <span class="correct-answer-title">正确答案</span>
                                </div>
                                <div class="correct-answer-content">
                                    {{ formatCorrectAnswer(currentQuestion?.answer) }}
                                </div>
                            </div>
                            
                            <!-- 解析块 -->
                            <div class="explanation-block">
                                <div class="explanation-block-header">
                                    <span class="explanation-block-icon">📖</span>
                                    <span class="explanation-block-title">解析</span>
                                </div>
                                <div class="explanation-block-content">
                                    <p>{{ currentQuestion?.explain }}</p>
                                </div>
                            </div>
                            
                            <!-- AI评阅结果 -->
                            <div v-if="currentAiReviewResult && (currentQuestion?.topic_type === '简答题' || currentQuestion?.topic_type === '综合应用题')" class="ai-review-section">
                                <div class="ai-review-header">
                                    <span class="ai-review-icon">🤖</span>
                                    <span class="ai-review-title">AI评阅</span>
                                </div>
                                <div class="ai-review-content">
                                    <div class="ai-score">
                                        <span class="ai-score-label">AI评分：</span>
                                        <span class="ai-score-value" :class="currentAiReviewResult.ai_score >= pointsPerQuestion * 0.6 ? 'high' : 'low'">
                                            {{ currentAiReviewResult.ai_score.toFixed(1) }}分
                                        </span>
                                    </div>
                                    <div class="ai-comment">
                                        <span class="ai-comment-label">评语：</span>
                                        <span class="ai-comment-value">{{ currentAiReviewResult.comment }}</span>
                                    </div>
                                    <div v-if="currentAiReviewResult.losePointReason" class="ai-lose-reason">
                                        <span class="ai-lose-reason-label">扣分原因：</span>
                                        <span class="ai-lose-reason-value">{{ currentAiReviewResult.losePointReason }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </transition>
            </section>

            <aside v-if="showResult" class="result-panel">
                <div class="result-card">
                    <h2>🎉 练习完成</h2>

                    <div class="result-stats">
                        <div class="stat-item">
                            <span class="stat-value">{{ score }}</span>
                            <span class="stat-label">正确题数</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">{{ confirmedCount }}</span>
                            <span class="stat-label">已答题目</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">{{ accuracy }}%</span>
                            <span class="stat-label">正确率</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">{{ formatTime(elapsedSeconds) }}</span>
                            <span class="stat-label">用时</span>
                        </div>
                    </div>

                    <div class="result-message">
                        <p v-if="accuracy >= 90">🌟 太棒了！正确率超过 90%！</p>
                        <p v-else-if="accuracy >= 70">👍 不错的表现！继续加油！</p>
                        <p v-else-if="accuracy >= 50">💪 还有进步空间，多练习！</p>
                        <p v-else>📚 需要多加学习相关知识！</p>
                    </div>

                    <button class="restart-btn" @click="restartExam">
                        🔄 重新练习
                    </button>
                </div>
            </aside>
        </main>
        
        <SubmitModal
            :visible="showSubmitModal"
            :status="submitModalStatus"
            :message="submitModalMessage"
            @close="handleSubmitModalClose"
        />
        
        <AiReviewModal
            ref="aiReviewModalRef"
            :visible="showAiReviewModal"
            :score="pointsPerQuestion"
            @close="handleAiReviewModalClose"
        />
    </div>
</template>

<style scoped>
.exam-container {
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.explanation-header{
    margin:1rm 0;
}

.exam-header {
    background: white;
    padding: 0.8rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border-radius: 0 0 12px 12px;
    position: relative;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.header-right {
    display: flex;
    align-items: center;
}

.right-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.nav-btn {
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.nav-btn:hover {
    background: #e2e8f0;
    color: #1e293b;
    transform: translateY(-1px);
}

.nav-divider {
    width: 1px;
    height: 24px;
    background: #e2e8f0;
    margin: 0 0.5rem;
}

.header-left h1 {
    font-size: 1.3rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
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

.confirmed-badge {
    padding: 0.5rem 1rem;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #4ade80;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
}

.timer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 8px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.timer.stopped {
    background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
}

.timer-icon {
    font-size: 1.25rem;
}

.timer-text {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: 'Courier New', monospace;
}

.timer-status {
    font-size: 0.85rem;
    opacity: 0.8;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
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
    max-width: 720px;
    height: 520px;
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
    width: 160px;
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

.settings-panel {
    height: 100%;
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

.settings-item label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
}

.settings-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #667eea;
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

.sound-label {
    color: #475569;
    font-size: 0.95rem;
}

.sound-select {
    padding: 0.4rem 0.6rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-size: 0.9rem;
    cursor: pointer;
}

.delay-settings {
    padding: 0.75rem 0 0;
    margin-top: -0.5rem;
}

.delay-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    color: #475569;
    font-size: 0.9rem;
}

.delay-item label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.delay-item input[type="number"] {
    width: 70px;
    padding: 0.4rem 0.6rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #475569;
    font-size: 0.9rem;
    text-align: center;
}

.settings-modal .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #fafafa;
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

.exam-main {
    flex: 1;
    display: flex;
    padding: 1.5rem;
    gap: 1.5rem;
    overflow: hidden;
}

.question-list {
    width: 280px;
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 200px);
}

.list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-shrink: 0;
    gap: 0.5rem;
}

.list-header h3 {
    font-size: 1.1rem;
    color: #1e293b;
    margin: 0;
    flex-shrink: 0;
}

.score-info {
    font-size: 0.85rem;
    color: #667eea;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    background: rgba(102, 126, 234, 0.1);
    border-radius: 4px;
    flex-shrink: 0;
}

.progress-text {
    font-size: 0.9rem;
    color: #64748b;
    font-weight: 500;
    flex-shrink: 0;
}

.progress-bar {
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
    flex-shrink: 0;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transition: width 0.3s ease;
}

.questions-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
}

.questions-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
    padding-right: 0.5rem;
}

.question-btn {
    aspect-ratio: 1;
    border: 2px solid #e2e8f0;
    background: white;
    border-radius: 8px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
}

.question-btn:hover {
    border-color: #667eea;
    color: #667eea;
}

.question-btn.active {
    background: rgba(59, 130, 246, 0.1);
    border: 2px dashed #3b82f6;
    color: #2563eb;
}

.question-btn.unconfirmed {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.question-btn.confirmed {
    background: #f0fdf4;
    border-color: #22c55e;
    color: #166534;
}

.question-btn.correct {
    background: #dcfce7;
    border-color: #22c55e;
    color: #166534;
}

.question-btn.active.confirmed {
    background: #f0fdf4;
    border: 2px dashed #22c55e;
    color: #166534;
}

.question-btn.active.correct {
    background: #dcfce7;
    border: 2px dashed #22c55e;
    color: #166534;
}

.question-btn.incorrect {
    background: #fef2f2;
    border-color: #ef4444;
    color: #dc2626;
}

.question-btn.active.incorrect {
    background: #fef2f2;
    border: 2px dashed #ef4444;
    color: #dc2626;
}

.question-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
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
    padding: 2rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    min-height: 0;
}

.question-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-shrink: 0;
    flex-wrap: wrap;
}

.question-type {
    padding: 0.5rem 1rem;
    height: 28px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    box-sizing: border-box;
}

.question-id {
    padding: 0.5rem 1rem;
    height: 28px;
    background: #f1f5f9;
    color: #475569;
    border-radius: 6px;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    font-size: 0.9rem;
}

.confirmed-badge-small {
    padding: 0.5rem 1rem;
    height: 28px;
    background: #dcfce7;
    color: #166534;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    box-sizing: border-box;
}

.answer-result {
    padding: 0.5rem 1rem;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 500;
    box-sizing: border-box;
}

.answer-result.correct {
    background: #22c55e;
    color: white;
}

.answer-result.incorrect {
    background: #ef4444;
    color: white;
}

.score-badge {
    padding: 0.5rem 1rem;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 500;
    box-sizing: border-box;
}

.score-badge.positive {
    background: rgba(34, 197, 94, 0.15);
    color: #166534;
    border: 1px solid #22c55e;
}

.score-badge.negative {
    background: rgba(239, 68, 68, 0.15);
    color: #dc2626;
    border: 1px solid #ef4444;
}

.main-topic-section {
    background: #f0f9ff;
    border: 1px solid #7dd3fc;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
}

.main-topic-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e0f2fe;
}

.main-topic-icon {
    font-size: 1rem;
}

.main-topic-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #0369a1;
}

.main-topic-content {
    font-size: 1rem;
    line-height: 1.6;
    color: #1e293b;
}

.main-topic-content p {
    margin: 0;
    white-space: pre-wrap;
}

.question-text {
    font-size: 1.1rem;
    line-height: 1.7;
    color: #1e293b;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid #e2e8f0;
    flex-shrink: 0;
}

.question-text p {
    margin: 0;
}

.options-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 1rem;
    flex-shrink: 0;
}

.option-item {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1rem 1.5rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 56px;
}

.option-item:hover:not(.locked) {
    border-color: #667eea;
    background: #f8fafc;
}

.option-item.locked {
    cursor: not-allowed;
    opacity: 0.9;
}

.option-item.selected {
    border: 2px dashed #667eea;
    background: rgba(102, 126, 234, 0.08);
}

.option-item.focused {
    outline: 2px solid #667eea;
    outline-offset: 2px;
}

.option-item.correct {
    border-color: #22c55e;
    background: #dcfce7;
}

.option-item.incorrect {
    border-color: #ef4444;
    background: #fef2f2;
}

.option-item.selected.correct {
    border: 2px dashed #22c55e;
    background: #dcfce7;
}

.option-item.selected.incorrect {
    border: 2px dashed #ef4444;
    background: #fef2f2;
}

.option-key {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 50%;
    font-weight: 600;
    color: #475569;
    flex-shrink: 0;
    font-size: 0.95rem;
}

.option-item.selected .option-key {
    background: #667eea;
    color: white;
}

.option-item.correct .option-key {
    background: #22c55e;
    color: white;
}

.option-item.incorrect .option-key {
    background: #ef4444;
    color: white;
}

.option-value {
    flex: 1;
    font-size: 1rem;
    color: #334155;
    line-height: 1.6;
}

/* 填空题样式 */
.fill-blank-section {
    margin-bottom: 2rem;
    flex-shrink: 0;
}

.fill-blank-input {
    width: 100%;
}

.fill-blank-textarea {
    width: 100%;
    padding: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 1rem;
    color: #334155;
    line-height: 1.6;
    resize: vertical;
    transition: all 0.2s ease;
    box-sizing: border-box;
    background: white;
}

.fill-blank-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.fill-blank-textarea:disabled {
    background: #f8fafc;
    cursor: not-allowed;
    opacity: 0.7;
}

/* 简答题样式 */
.essay-section {
    margin-bottom: 2rem;
    flex-shrink: 0;
}

.essay-input {
    width: 100%;
}

.essay-textarea {
    width: 100%;
    padding: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 1rem;
    color: #334155;
    line-height: 1.6;
    resize: vertical;
    transition: all 0.2s ease;
    box-sizing: border-box;
    background: white;
    min-height: 150px;
}

.essay-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.essay-textarea:disabled {
    background: #f8fafc;
    cursor: not-allowed;
    opacity: 0.7;
}

.essay-textarea.comprehensive {
    min-height: 250px;
    background: linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%);
}

.explanation-section {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 10px;
    padding: 1.25rem;
    margin-top: 1rem;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 16px;
    min-height: 0;
    max-height: 400px;
}

.explanation-section::-webkit-scrollbar {
    width: 6px;
}

.explanation-section::-webkit-scrollbar-track {
    background: rgba(251, 191, 36, 0.2);
    border-radius: 3px;
}

.explanation-section::-webkit-scrollbar-thumb {
    background: rgba(245, 158, 11, 0.5);
    border-radius: 3px;
}

.explanation-section::-webkit-scrollbar-thumb:hover {
    background: rgba(245, 158, 11, 0.7);
}


.explanation-icon {
    font-size: 1.1rem;
}

.explanation-title {
    font-weight: 600;
    color: #92400e;
    font-size: 0.95rem;
}

/* 正确答案区域 */
.correct-answer-block {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    background: rgba(34, 197, 94, 0.1);
    border-left: 4px solid #22c55e;
}

.correct-answer-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
}

.correct-answer-icon {
    font-size: 0.9rem;
    color: #22c55e;
}

.correct-answer-title {
    font-weight: 600;
    color: #166534;
    font-size: 0.95rem;
}

.correct-answer-content {
    color: #15803d;
    font-weight: 600;
    font-size: 1.1rem;
    padding-left: 24px;
    line-height: 1.6;
}

/* 解析区域 */
.explanation-block {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.1);
    border-left: 4px solid #f59e0b;
}

.explanation-block-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
}

.explanation-block-icon {
    font-size: 0.9rem;
    color: #f59e0b;
}

.explanation-block-title {
    font-weight: 600;
    color: #92400e;
    font-size: 0.95rem;
}

.explanation-block-content {
    color: #475569;
    line-height: 1.7;
    padding-left: 24px;
}

.explanation-block-content p {
    margin: 0;
    font-size: 1rem;
}

.ai-review-section {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    background: rgba(99, 102, 241, 0.1);
    border-left: 4px solid #6366f1;
}

.ai-review-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
}

.ai-review-icon {
    font-size: 0.9rem;
    color: #6366f1;
}

.ai-review-title {
    font-weight: 600;
    color: #4f46e5;
    font-size: 0.95rem;
}

.ai-review-content {
    padding-left: 24px;
}

.ai-score {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
}

.ai-score-label {
    font-weight: 500;
    color: #475569;
}

.ai-score-value {
    font-weight: 700;
    font-size: 1.1rem;
}

.ai-score-value.high {
    color: #16a34a;
}

.ai-score-value.low {
    color: #dc2626;
}

.ai-comment {
    margin-bottom: 0.4rem;
}

.ai-comment-label {
    font-weight: 500;
    color: #475569;
    display: block;
    margin-bottom: 0.2rem;
}

.ai-comment-value {
    color: #334155;
    line-height: 1.6;
}

.ai-lose-reason {
    background: rgba(239, 68, 68, 0.1);
    padding: 0.5rem;
    border-radius: 4px;
    margin-top: 0.4rem;
}

.ai-lose-reason-label {
    font-weight: 500;
    color: #dc2626;
    display: block;
    margin-bottom: 0.2rem;
}

.ai-lose-reason-value {
    color: #991b1b;
    line-height: 1.6;
}

.explanation-content p {
    margin: 0;
    font-size: 0.95rem;
}

.answer-verdict {
    margin-top: 0.75rem;
    padding: 0.5rem;
    border-radius: 6px;
    font-weight: 600;
    text-align: center;
    font-size: 0.95rem;
}

.answer-verdict.correct {
    background: #dcfce7;
    color: #166534;
}

.answer-verdict.incorrect {
    background: #fef2f2;
    color: #dc2626;
}

.navigation-buttons {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
    margin-top: 1rem;
    margin-bottom: 1rem;
}

.nav-btn {
    padding: 0.75rem 1.75rem;
    background: white;
    border: 2px solid #667eea;
    border-radius: 8px;
    color: #667eea;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
}

.nav-btn:hover:not(:disabled) {
    background: #667eea;
    color: white;
}

.nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.nav-btn.confirm {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    border: none;
}

.nav-btn.confirm:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
}

.nav-btn.confirmed {
    background: #dcfce7;
    color: #166534;
    border: 2px solid #22c55e;
    cursor: default;
}

.nav-btn.submit {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
}

.nav-btn.submit:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.result-panel {
    width: 300px;
    flex-shrink: 0;
}

.result-card {
    background: white;
    border-radius: 12px;
    padding: 1.75rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    text-align: center;
    height: fit-content;
}

.result-card h2 {
    font-size: 1.4rem;
    color: #1e293b;
    margin-bottom: 1.5rem;
}

.result-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
    margin-bottom: 1.5rem;
}

.stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #667eea;
}

.stat-label {
    font-size: 0.85rem;
    color: #64748b;
}

.result-message {
    background: #f8fafc;
    border-radius: 8px;
    padding: 0.875rem;
    margin-bottom: 1.5rem;
}

.result-message p {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
}

.restart-btn {
    width: 100%;
    padding: 0.875rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
}

.restart-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}
</style>
