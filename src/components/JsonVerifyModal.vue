<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

interface QuestionItem {
    id: number
    file_name: string
    topic_type: string
    topic_index: number
    topic: string
    main_topic?: string
    choose?: {
        [key: string]: string
    }
    answer: string | string[]
    explain: string
}

const props = defineProps<{
    visible: boolean
    questions: QuestionItem[]
    fileName: string
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'confirm', data: QuestionItem[]): void
}>()

const editingField = ref<{ field: string; key?: string } | null>(null)
const editValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const editTextareaRef = ref<HTMLTextAreaElement | null>(null)
const currentQuestionIndex = ref(0)
const transitionDirection = ref<'left' | 'right'>('right')

const editableQuestions = ref<QuestionItem[]>([])

watch(() => props.questions, (newQuestions) => {
    editableQuestions.value = JSON.parse(JSON.stringify(newQuestions))
    currentQuestionIndex.value = 0
}, { immediate: true, deep: true })

const currentQuestion = computed(() => {
    return editableQuestions.value[currentQuestionIndex.value]
})

const hasChoices = computed(() => {
    return currentQuestion.value?.choose && Object.keys(currentQuestion.value.choose).length > 0
})

const isMultiAnswer = computed(() => {
    return Array.isArray(currentQuestion.value?.answer)
})

function getTopicTypeIcon(type: string): string {
    switch (type) {
        case '单选':
        case '单选题': return '🔘'
        case '多选':
        case '多选题': return '☑️'
        case '判断':
        case '判断题': return '✅'
        case '填空':
        case '填空题': return '📝'
        case '简答':
        case '简答题': return '📄'
        default: return '📌'
    }
}

function startEditing(field: string, event: MouseEvent, key?: string) {
    if ((event as MouseEvent).detail !== 2) return
    
    const question = currentQuestion.value
    if (!question) return

    editingField.value = { field, key }
    
    if (field === 'topic_type') {
        editValue.value = question.topic_type
    } else if (field === 'topic_index') {
        editValue.value = String(question.topic_index)
    } else if (field === 'topic') {
        editValue.value = question.topic
    } else if (field === 'answer') {
        editValue.value = Array.isArray(question.answer) ? question.answer.join(',') : question.answer
    } else if (field === 'explain') {
        editValue.value = question.explain
    } else if (field === 'choose') {
        editValue.value = question.choose?.[key || ''] || ''
    }

    nextTick(() => {
        if (field === 'explain' || field === 'answer' && isQuestionType('简答题')) {
            editTextareaRef.value?.focus()
            editTextareaRef.value?.select()
        } else {
            editInputRef.value?.focus()
            editInputRef.value?.select()
        }
    })
}

function isQuestionType(type: string): boolean {
    const topicType = currentQuestion.value?.topic_type || ''
    return topicType.includes(type)
}

function saveEdit() {
    if (!editingField.value || !currentQuestion.value) return

    const { field, key } = editingField.value
    const question = currentQuestion.value
    
    if (field === 'topic_type') {
        const oldType = question.topic_type
        question.topic_type = editValue.value
        
        // 根据新的题目类型调整选项和答案结构
        adjustQuestionStructure(question)
    } else if (field === 'topic_index') {
        const num = parseInt(editValue.value)
        question.topic_index = isNaN(num) ? 0 : num
    } else if (field === 'topic') {
        question.topic = editValue.value
    } else if (field === 'answer') {
        if (editValue.value.includes(',')) {
            question.answer = editValue.value.split(',').map(s => s.trim())
        } else {
            question.answer = editValue.value
        }
    } else if (field === 'explain') {
        question.explain = editValue.value
    } else if (field === 'choose' && key) {
        if (!question.choose) question.choose = {}
        question.choose[key] = editValue.value
    }

    editingField.value = null
    editValue.value = ''
}

function adjustQuestionStructure(question: QuestionItem) {
    const type = question.topic_type
    
    // 判断题：设置选项为正确/错误
    if (type.includes('判断')) {
        question.choose = {
            '正确': '正确',
            '错误': '错误'
        }
        if (!question.answer || (typeof question.answer === 'string' && !['正确', '错误'].includes(question.answer))) {
            question.answer = '正确'
        }
    }
    // 单选题：设置默认选项 A-D
    else if (type.includes('单选')) {
        if (!question.choose || Object.keys(question.choose).length === 0 || 
            question.choose && Object.keys(question.choose).some(k => k === '正确' || k === '错误')) {
            question.choose = {
                'A': '选项A',
                'B': '选项B',
                'C': '选项C',
                'D': '选项D'
            }
        }
        if (!question.answer) {
            question.answer = 'A'
        }
    }
    // 多选题：设置默认选项 A-D，答案可能是多个
    else if (type.includes('多选')) {
        if (!question.choose || Object.keys(question.choose).length === 0 || 
            question.choose && Object.keys(question.choose).some(k => k === '正确' || k === '错误')) {
            question.choose = {
                'A': '选项A',
                'B': '选项B',
                'C': '选项C',
                'D': '选项D'
            }
        }
        if (!question.answer) {
            question.answer = ['A']
        }
    }
    // 填空题：移除选项
    else if (type.includes('填空')) {
        delete question.choose
        if (!question.answer) {
            question.answer = ''
        }
    }
    // 简答题：移除选项
    else if (type.includes('简答')) {
        delete question.choose
        if (!question.answer) {
            question.answer = ''
        }
    }
}

function getNextOptionKey(): string {
    const question = currentQuestion.value
    if (!question?.choose) return 'A'
    
    const existingKeys = Object.keys(question.choose).sort()
    if (existingKeys.length === 0) return 'A'
    
    const lastKey = existingKeys[existingKeys.length - 1]
    const nextCharCode = lastKey.charCodeAt(0) + 1
    if (nextCharCode <= 'Z'.charCodeAt(0)) {
        return String.fromCharCode(nextCharCode)
    }
    return ''
}

function addOption() {
    const question = currentQuestion.value
    if (!question?.choose) return
    
    const nextKey = getNextOptionKey()
    if (nextKey) {
        question.choose[nextKey] = `选项${nextKey}`
    }
}

function removeOption(key: string) {
    const question = currentQuestion.value
    if (!question?.choose) return
    
    const keys = Object.keys(question.choose)
    if (keys.length <= 2) {
        alert('至少保留两个选项')
        return
    }
    
    delete question.choose[key]
    
    // 如果删除的是当前答案，更新答案
    if (typeof question.answer === 'string' && question.answer === key) {
        const remainingKeys = Object.keys(question.choose)
        question.answer = remainingKeys[0]
    } else if (Array.isArray(question.answer)) {
        question.answer = question.answer.filter(a => a !== key)
        if (question.answer.length === 0) {
            const remainingKeys = Object.keys(question.choose)
            question.answer = [remainingKeys[0]]
        }
    }
}

function cancelEdit() {
    editingField.value = null
    editValue.value = ''
}

function handleClose() {
    editingField.value = null
    editValue.value = ''
    currentQuestionIndex.value = 0
    emit('close')
}

function handleConfirm() {
    editableQuestions.value.forEach((question, index) => {
        question.id = index + 1
    })
    emit('confirm', editableQuestions.value)
}

function prevQuestion() {
    if (currentQuestionIndex.value > 0) {
        transitionDirection.value = 'left'
        currentQuestionIndex.value--
    }
}

function nextQuestion() {
    if (currentQuestionIndex.value < editableQuestions.value.length - 1) {
        transitionDirection.value = 'right'
        currentQuestionIndex.value++
    }
}

function goToQuestion(index: number) {
    if (index > currentQuestionIndex.value) {
        transitionDirection.value = 'right'
    } else if (index < currentQuestionIndex.value) {
        transitionDirection.value = 'left'
    }
    currentQuestionIndex.value = index
}

function isEditing(field: string, key?: string): boolean {
    if (!editingField.value) return false
    if (editingField.value.field !== field) return false
    if (key !== undefined && editingField.value.key !== key) return false
    return true
}

function handleKeyDown(event: KeyboardEvent) {
    if (!props.visible) return
    if (editingField.value) return

    if (event.key === 'ArrowLeft') {
        event.preventDefault()
        prevQuestion()
    } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        nextQuestion()
    }
}

function getNextId(): number {
    if (editableQuestions.value.length === 0) {
        return 1
    }
    const maxId = Math.max(...editableQuestions.value.map(q => q.id))
    return maxId + 1
}

function addQuestion() {
    const currentQuestion = editableQuestions.value[currentQuestionIndex.value]
    const currentTopicType = currentQuestion?.topic_type || '单选题'
    const currentTopicIndex = currentQuestion?.topic_index || 1
    
    const newId = getNextId()
    const newQuestion: QuestionItem = {
        id: newId,
        file_name: props.fileName,
        topic_type: currentTopicType,
        topic_index: currentTopicIndex + 1,
        topic: '请输入题目内容',
        choose: {
            'A': '选项A',
            'B': '选项B',
            'C': '选项C',
            'D': '选项D'
        },
        answer: '',
        explain: ''
    }
    
    editableQuestions.value.splice(currentQuestionIndex.value + 1, 0, newQuestion)
    
    for (let i = currentQuestionIndex.value + 2; i < editableQuestions.value.length; i++) {
        const q = editableQuestions.value[i]
        if (q.topic_type === currentTopicType && q.topic_index > currentTopicIndex) {
            q.topic_index++
        }
    }
    
    nextQuestion()
}

function reindexQuestions() {
    editableQuestions.value.forEach((question, index) => {
        question.id = index + 1
    })
}

function deleteQuestion() {
    if (editableQuestions.value.length <= 1) {
        alert('至少保留一道题目')
        return
    }
    
    if (!confirm('确定要删除当前题目吗？')) {
        return
    }
    
    const deletedQuestion = editableQuestions.value[currentQuestionIndex.value]
    const deletedTopicType = deletedQuestion.topic_type
    
    editableQuestions.value.splice(currentQuestionIndex.value, 1)
    
    const sameTypeQuestions = editableQuestions.value.filter(q => q.topic_type === deletedTopicType)
    sameTypeQuestions.forEach((q, index) => {
        q.topic_index = index + 1
    })
    
    if (currentQuestionIndex.value >= editableQuestions.value.length) {
        currentQuestionIndex.value = Math.max(0, editableQuestions.value.length - 1)
    }
    
    reindexQuestions()
}

onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
    <Transition name="modal">
        <div v-if="visible" class="modal-overlay">
            <div class="modal-container">
                <!-- 左侧题目列表 -->
                <div class="left-panel">
                    <div class="panel-header">
                        <h3 class="panel-title">题目列表</h3>
                        <span class="panel-count">共 {{ editableQuestions.length }} 题</span>
                    </div>
                    <div class="question-grid">
                        <div
                            v-for="(question, index) in editableQuestions"
                            :key="question.id"
                            class="question-num"
                            :class="{ active: index === currentQuestionIndex }"
                            @click="goToQuestion(index)"
                            :title="question.topic_type"
                        >
                            {{ index + 1 }}
                        </div>
                    </div>
                </div>

                <!-- 右侧题目详情 -->
                <div class="right-panel">
                    <!-- 头部 -->
                    <div class="panel-header-main">
                        <div class="header-left">
                            <h2 class="main-title">📋 JSON数据校验</h2>
                            <p class="main-subtitle">文件: {{ fileName }}</p>
                        </div>
                    </div>

                    <!-- 提示信息 -->
                    <div class="tip-bar">
                        <span class="tip-icon">💡</span>
                        <span class="tip-text">双击题目内容可进行编辑修改，确认无误后点击"确认提交"进行向量化处理</span>
                    </div>

                    <!-- 题目内容区域 -->
                    <div class="question-wrapper">
                        <Transition :name="`slide-${transitionDirection}`" mode="out-in">
                            <div class="question-content" v-if="currentQuestion" :key="currentQuestionIndex">
                                <!-- 题目标题 -->
                                <div class="question-header">
                                    <span class="question-num-big">第 {{ currentQuestionIndex + 1 }} 题</span>
                                    <span class="question-type-tag">{{ getTopicTypeIcon(currentQuestion.topic_type) }} {{ currentQuestion.topic_type }}</span>
                                </div>

                                <!-- 元信息 -->
                                <div class="meta-row">
                                    <div class="meta-item">
                                        <label>题目类型:</label>
                                        <div 
                                            class="editable-field"
                                            :class="{ editing: isEditing('topic_type') }"
                                            @click="startEditing('topic_type', $event)"
                                        >
                                            <template v-if="isEditing('topic_type')">
                                                <input 
                                                    ref="editInputRef"
                                                    v-model="editValue"
                                                    class="edit-input"
                                                    @blur="saveEdit"
                                                    @keydown.enter="saveEdit"
                                                    @keydown.escape="cancelEdit"
                                                />
                                            </template>
                                            <template v-else>{{ currentQuestion.topic_type }}</template>
                                        </div>
                                    </div>
                                    <div class="meta-item">
                                        <label>原始序号:</label>
                                        <div 
                                            class="editable-field"
                                            :class="{ editing: isEditing('topic_index') }"
                                            @click="startEditing('topic_index', $event)"
                                        >
                                            <template v-if="isEditing('topic_index')">
                                                <input 
                                                    ref="editInputRef"
                                                    v-model="editValue"
                                                    class="edit-input"
                                                    type="number"
                                                    @blur="saveEdit"
                                                    @keydown.enter="saveEdit"
                                                    @keydown.escape="cancelEdit"
                                                />
                                            </template>
                                            <template v-else>{{ currentQuestion.topic_index }}</template>
                                        </div>
                                    </div>
                                </div>

                                <!-- 主题干（仅综合应用题显示） -->
                                <div v-if="currentQuestion.topic_type === '综合应用题'" class="field-section">
                                    <label class="field-label">主题干:</label>
                                    <div 
                                        class="field-value main-topic-text"
                                        :class="{ editing: isEditing('main_topic') }"
                                        @click="startEditing('main_topic', $event)"
                                    >
                                        <template v-if="isEditing('main_topic')">
                                            <textarea 
                                                ref="editInputRef"
                                                v-model="editValue"
                                                class="edit-textarea"
                                                rows="3"
                                                @blur="saveEdit"
                                                @keydown.enter.ctrl="saveEdit"
                                                @keydown.escape="cancelEdit"
                                            ></textarea>
                                        </template>
                                        <template v-else>{{ currentQuestion.main_topic || '无' }}</template>
                                    </div>
                                </div>

                                <!-- 题目（子题干） -->
                                <div class="field-section">
                                    <label class="field-label">题目:</label>
                                    <div 
                                        class="field-value question-text"
                                        :class="{ editing: isEditing('topic') }"
                                        @click="startEditing('topic', $event)"
                                    >
                                        <template v-if="isEditing('topic')">
                                            <input 
                                                ref="editInputRef"
                                                v-model="editValue"
                                                class="edit-input wide"
                                                @blur="saveEdit"
                                                @keydown.enter="saveEdit"
                                                @keydown.escape="cancelEdit"
                                            />
                                        </template>
                                        <template v-else>{{ currentQuestion.topic }}</template>
                                    </div>
                                </div>

                                <!-- 选项 -->
                                <div v-if="hasChoices" class="field-section">
                                    <label class="field-label">选项:</label>
                                    <div class="options-list">
                                        <div 
                                            v-for="(value, choiceKey) in currentQuestion.choose" 
                                            :key="choiceKey"
                                            class="option-item"
                                            :class="{ editing: isEditing('choose', choiceKey), readonly: isQuestionType('判断') }"
                                        >
                                            <span class="option-key">{{ choiceKey }}.</span>
                                            <template v-if="isEditing('choose', choiceKey) && !isQuestionType('判断')">
                                                <input 
                                                    ref="editInputRef"
                                                    v-model="editValue"
                                                    class="edit-input option-input"
                                                    @blur="saveEdit"
                                                    @keydown.enter="saveEdit"
                                                    @keydown.escape="cancelEdit"
                                                />
                                            </template>
                                            <template v-else>
                                                <span 
                                                    class="option-value"
                                                    @click="!isQuestionType('判断') && startEditing('choose', $event, choiceKey)"
                                                >{{ value }}</span>
                                            </template>
                                            <button 
                                                v-if="!isQuestionType('判断') && Object.keys(currentQuestion.choose).length > 2"
                                                class="option-delete-btn"
                                                @click.stop="removeOption(choiceKey)"
                                                title="删除选项"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    <div v-if="!isQuestionType('判断') && Object.keys(currentQuestion.choose).length < 26" class="options-actions">
                                        <button 
                                            class="action-btn add-option"
                                            @click="addOption"
                                        >
                                            ➕ 添加选项
                                        </button>
                                    </div>
                                </div>

                                <!-- 答案 -->
                                <div class="field-section">
                                    <label class="field-label">答案:</label>
                                    <template v-if="isQuestionType('简答题')">
                                        <div 
                                            class="field-value answer-text essay"
                                            :class="{ editing: isEditing('answer') }"
                                            @click="startEditing('answer', $event)"
                                        >
                                            <template v-if="isEditing('answer')">
                                                <textarea 
                                                    ref="editTextareaRef"
                                                    v-model="editValue"
                                                    class="edit-textarea"
                                                    @blur="saveEdit"
                                                    @keydown.enter.exact.prevent="saveEdit"
                                                    @keydown.escape="cancelEdit"
                                                ></textarea>
                                            </template>
                                            <template v-else>{{ currentQuestion.answer || '暂无答案' }}</template>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <div 
                                            class="field-value answer-text"
                                            :class="{ editing: isEditing('answer') }"
                                            @click="startEditing('answer', $event)"
                                        >
                                            <template v-if="isEditing('answer')">
                                                <input 
                                                    ref="editInputRef"
                                                    v-model="editValue"
                                                    class="edit-input wide"
                                                    @blur="saveEdit"
                                                    @keydown.enter="saveEdit"
                                                    @keydown.escape="cancelEdit"
                                                    :placeholder="isMultiAnswer ? '多个答案用逗号分隔' : ''"
                                                />
                                            </template>
                                            <template v-else>
                                                <span v-if="isMultiAnswer" class="multi-answer-tag">
                                                    {{ (currentQuestion.answer as string[]).join('、') }}
                                                </span>
                                                <span v-else>{{ currentQuestion.answer }}</span>
                                            </template>
                                        </div>
                                    </template>
                                </div>

                                <!-- 解析 -->
                                <div class="field-section">
                                    <label class="field-label">解析:</label>
                                    <div 
                                        class="field-value explain-text"
                                        :class="{ editing: isEditing('explain') }"
                                        @click="startEditing('explain', $event)"
                                    >
                                        <template v-if="isEditing('explain')">
                                            <textarea 
                                                ref="editTextareaRef"
                                                v-model="editValue"
                                                class="edit-textarea"
                                                @blur="saveEdit"
                                                @keydown.enter.exact.prevent="saveEdit"
                                                @keydown.escape="cancelEdit"
                                            ></textarea>
                                        </template>
                                        <template v-else>{{ currentQuestion.explain || '暂无解析' }}</template>
                                    </div>
                                </div>
                            </div>
                        </Transition>
                    </div>

                    <!-- 导航栏 -->
                    <div class="nav-bar">
                        <div class="action-bar">
                            <button 
                                class="action-btn add"
                                @click="addQuestion"
                                :disabled="editingField !== null"
                                title="在当前题目后面添加一道新题"
                            >
                                ➕ 添加题目
                            </button>
                            <button 
                                class="action-btn delete"
                                @click="deleteQuestion"
                                :disabled="editableQuestions.length <= 1 || editingField !== null"
                                title="删除当前题目"
                            >
                                🗑️ 删除题目
                            </button>
                        </div>
                        <button 
                            class="nav-btn prev"
                            :disabled="currentQuestionIndex === 0"
                            @click="prevQuestion"
                        >
                            ◀ 上一题
                        </button>
                        <span class="nav-indicator">{{ currentQuestionIndex + 1 }} / {{ editableQuestions.length }}</span>
                        <button 
                            class="nav-btn next"
                            :disabled="currentQuestionIndex === editableQuestions.length - 1"
                            @click="nextQuestion"
                        >
                            下一题 ▶
                        </button>
                    </div>

                    <!-- 底部按钮 -->
                    <div class="bottom-bar">
                        <button class="btn btn-cancel" @click="handleClose">取消</button>
                        <button class="btn btn-submit" @click="handleConfirm">确认提交</button>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
    transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
    transform: scale(0.9) translateY(-20px);
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
}

.slide-left-enter-from {
    transform: translateX(-100%);
    opacity: 0;
}

.slide-left-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

.slide-right-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.slide-right-leave-to {
    transform: translateX(-100%);
    opacity: 0;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
}

.modal-container {
    background: #ffffff;
    border-radius: 16px;
    width: 1400px;
    max-width: 95vw;
    height: 85vh;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    display: flex;
    overflow: hidden;
}

.left-panel {
    width: 200px;
    background: #f8fafc;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
}

.panel-header {
    padding: 16px;
    border-bottom: 1px solid #e2e8f0;
    background: white;
}

.panel-title {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 4px;
}

.panel-count {
    font-size: 12px;
    color: #64748b;
}

.question-grid {
    overflow-x: hidden;
    overflow-y: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 100%;
    min-height: 0;
}

.question-num {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s;
}

.question-num:hover {
    border-color: #667eea;
    color: #667eea;
}

.question-num.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: #667eea;
}

.right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-x: hidden;
}

.panel-header-main {
    padding: 16px 24px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-left {
    flex: 1;
}

.main-title {
    font-size: 24px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 4px;
}

.main-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 0;
}

.tip-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fefce8;
    border-bottom: 1px solid #fef08a;
    padding: 10px 24px;
}

.tip-icon {
    font-size: 16px;
}

.tip-text {
    font-size: 13px;
    color: #854d0e;
    margin: 0;
}

.question-wrapper {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    padding: 20px 24px;
}

.question-content {
    position: relative;
}

.question-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.question-num-big {
    font-size: 16px;
    font-weight: 600;
    color: #667eea;
}

.question-type-tag {
    font-size: 13px;
    color: #475569;
    background: #e0e7ff;
    padding: 4px 12px;
    border-radius: 4px;
}

.meta-row {
    display: flex;
    gap: 32px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.meta-item label {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
}

.editable-field {
    padding: 4px 8px;
    background: white;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 13px;
    color: #334155;
    cursor: pointer;
    min-width: 100px;
    transition: all 0.2s;
}

.edit-textarea {
    width: 100%;
    min-height: 80px;
    padding: 10px;
    border: 1px solid #667eea;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    outline: none;
}

.editable-field:hover {
    border-color: #cbd5e1;
}

.editable-field.editing {
    border-color: #667eea;
}

.field-section {
    margin-bottom: 20px;
}

.field-label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 8px;
}

.field-value {
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    line-height: 1.6;
}

.field-value:hover {
    border-color: #cbd5e1;
}

.field-value.editing {
    border-color: #667eea;
    background: white;
}

.question-text {
    min-height: 48px;
}

.main-topic-text {
    min-height: 80px;
    background: #f0f9ff;
    border-color: #7dd3fc;
}

.answer-text {
    background: #ecfdf5;
    border-color: #86efac;
    color: #065f46;
    font-weight: 500;
}

.answer-text.essay {
    min-height: 120px;
    font-weight: normal;
}

.explain-text {
    min-height: 80px;
}

.options-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.option-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.option-item:hover {
    border-color: #cbd5e1;
}

.option-item.editing {
    border-color: #667eea;
}

.option-key {
    font-weight: 600;
    color: #667eea;
    min-width: 20px;
}

.option-value {
    flex: 1;
}

.option-item.readonly {
    cursor: default;
}

.option-item.readonly:hover {
    border-color: #e2e8f0;
}

.option-delete-btn {
    padding: 2px 6px;
    background: #fee2e2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    color: #dc2626;
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
}

.option-item:hover .option-delete-btn {
    opacity: 1;
}

.option-delete-btn:hover {
    background: #fecaca;
}

.options-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-start;
}

.action-btn.add-option {
    padding: 6px 16px;
    font-size: 12px;
    background: #f0fdf4;
    border-color: #86efac;
    color: #065f46;
}

.action-btn.add-option:hover {
    background: #dcfce7;
    border-color: #22c55e;
    color: #059669;
}

.multi-answer-tag {
    display: inline-block;
    background: #dcfce7;
    padding: 4px 8px;
    border-radius: 4px;
}

.edit-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid #667eea;
    border-radius: 4px;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
}

.edit-input.wide {
    padding: 10px;
}

.edit-input.option-input {
    flex: 1;
}

.edit-textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #667eea;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    min-height: 120px;
    resize: vertical;
    box-sizing: border-box;
}

.nav-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 12px 16px;
    border-top: 1px solid #e2e8f0;
    background: white;
}

.nav-btn {
    padding: 8px 20px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    color: #475569;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
    border-color: #667eea;
    color: #667eea;
}

.nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.nav-indicator {
    font-size: 14px;
    color: #475569;
    font-weight: 500;
}

.action-bar {
    display: flex;
    gap: 12px;
}

.action-btn {
    padding: 8px 20px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    color: #475569;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
}

.action-btn:hover:not(:disabled) {
    border-color: #667eea;
    color: #667eea;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.action-btn.add {
    border-color: #86efac;
    color: #065f46;
    background: #f0fdf4;
}

.action-btn.add:hover:not(:disabled) {
    border-color: #22c55e;
    color: #059669;
    background: #dcfce7;
}

.action-btn.delete {
    border-color: #fecaca;
    color: #dc2626;
    background: #fef2f2;
}

.action-btn.delete:hover:not(:disabled) {
    border-color: #ef4444;
    color: #b91c1c;
    background: #fee2e2;
}

.bottom-bar {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
    background: white;
}

.btn {
    padding: 10px 24px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    font-size: 14px;
}

.btn-cancel {
    background: #e2e8f0;
    color: #475569;
}

.btn-cancel:hover {
    background: #cbd5e1;
}

.btn-submit {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-submit:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}
</style>
