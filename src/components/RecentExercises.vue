<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getExerciseRecords, deleteExerciseRecord, type ExerciseRecord } from '../api/chat'

interface DisplayRecord {
    id: string
    fileName: string
    questionCount: number
    topicTrueNum: number
    topicFalseNum: number
    topicNullNum: number
    answerTotalTime: number
    accuracyRate: number
    averageAnswerTime: number
    createTime: string
    aiEvaluation: string
    testType: string
    content: any[]
}

const exerciseRecords = ref<DisplayRecord[]>([])
const loading = ref(false)
const showDeleteConfirm = ref(false)
const recordToDelete = ref<DisplayRecord | null>(null)
const selectedRecord = ref<DisplayRecord | null>(null)
const showRecordDetail = ref(false)
const currentQuestionIndex = ref(0)
const detailMainContent = ref<HTMLElement | null>(null)

const questionTypeStats = computed(() => {
    if (!selectedRecord.value) return {}
    const stats: Record<string, number> = {}
    selectedRecord.value.content.forEach(q => {
        const type = q.topic_type || '未知类型'
        stats[type] = (stats[type] || 0) + 1
    })
    return stats
})

function scrollToQuestion(index: number) {
    currentQuestionIndex.value = index
    const element = document.getElementById(`question-${index}`)
    if (element && detailMainContent.value) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
}

async function loadExerciseRecords() {
    try {
        loading.value = true
        const response = await getExerciseRecords()
        if (response.code === 200) {
            const records = Array.isArray(response.data) ? response.data : []
            // 处理新数据格式
            exerciseRecords.value = records.map((record: any) => ({
                id: record.id,
                fileName: record.file_name || '',
                questionCount: record.content?.length || 0,
                topicTrueNum: record.grades?.topic_true_num || 0,
                topicFalseNum: record.grades?.topic_false_num || 0,
                topicNullNum: record.grades?.topic_null_num || 0,
                answerTotalTime: record.grades?.answer_total_time || 0,
                accuracyRate: record.grades?.accuracy_raet || 0,
                averageAnswerTime: record.grades?.average_answer_time || 0,
                createTime: record.grades?.createTime || '',
                aiEvaluation: record.ai_evaluation || '',
                testType: record.grades?.test_type || '',
                content: record.content || []
            }))
        }
    } catch (error) {
        console.error('获取练习记录失败:', error)
        exerciseRecords.value = []
    } finally {
        loading.value = false
    }
}

function viewRecordDetail(record: DisplayRecord) {
    selectedRecord.value = record
    showRecordDetail.value = true
    currentQuestionIndex.value = 0
}

function closeRecordDetail() {
    showRecordDetail.value = false
    selectedRecord.value = null
}

function confirmDelete(record: DisplayRecord) {
    recordToDelete.value = record
    showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
    if (!recordToDelete.value) return
    const deleteId = recordToDelete.value.id
    console.log('删除记录 ID:', deleteId)
    
    if (!deleteId) {
        alert('删除失败：记录 ID 不存在')
        showDeleteConfirm.value = false
        return
    }
    
    try {
        const response = await deleteExerciseRecord({ id: deleteId })
        console.log('删除响应:', response)
        if (response.code === 200) {
            await loadExerciseRecords()
        } else {
            alert('删除失败：' + response.msg)
        }
    } catch (error) {
        console.error('删除练习记录失败:', error)
        alert('删除失败，请检查网络连接')
    } finally {
        showDeleteConfirm.value = false
        recordToDelete.value = null
    }
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
}

function getProgressBarColor(accuracy: number): string {
    if (accuracy >= 90) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    if (accuracy >= 70) return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    if (accuracy >= 50) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
}

onMounted(() => {
    loadExerciseRecords()
})
</script>

<template>
    <div class="recent-exercises">
        <div class="section-header">
            <h3>📊 最近练习</h3>
            <button class="refresh-btn" @click="loadExerciseRecords" :disabled="loading">
                {{ loading ? '加载中...' : '刷新' }}
            </button>
        </div>
        
        <div v-if="loading" class="loading-container">
            <span class="loading-spinner"></span>
            加载中...
        </div>
        
        <div v-else-if="exerciseRecords.length === 0" class="empty-container">
            <span class="empty-icon">📚</span>
            <p>暂无练习记录</p>
        </div>
        
        <div v-else class="records-list">
            <div 
                v-for="(record, index) in exerciseRecords" 
                :key="record.id || index" 
                class="record-card"
                @click="viewRecordDetail(record)"
            >
                <div class="card-header">
                    <div class="title-section">
                        <span class="record-title">{{ record.fileName || '练习记录' }}</span>
                        <span class="record-time">{{ formatDate(record.createTime) }}</span>
                    </div>
                    <button class="delete-btn" @click.stop="confirmDelete(record)">
                        🗑️
                    </button>
                </div>
                
                <div class="record-stats">
                    <div class="stat-item">
                        <span class="stat-value">{{ record.topicTrueNum }}/{{ record.questionCount }}</span>
                        <span class="stat-label">正确/总题</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">{{ record.accuracyRate }}%</span>
                        <span class="stat-label">正确率</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">{{ formatTime(record.answerTotalTime) }}</span>
                        <span class="stat-label">答题时长</span>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="progress-bar-container">
                        <div 
                            class="progress-fill" 
                            :style="{ 
                                width: `${record.accuracyRate}%`,
                                background: getProgressBarColor(record.accuracyRate)
                            }"
                        ></div>
                    </div>
                    <span class="progress-percent">{{ record.accuracyRate }}%</span>
                </div>
                
                <div class="record-detail-preview">
                    <span class="detail-tag">答对 {{ record.topicTrueNum }} 题</span>
                    <span class="detail-tag error">答错 {{ record.topicFalseNum }} 题</span>
                    <span class="detail-tag warning">未答 {{ record.topicNullNum }} 题</span>
                    <span v-if="record.testType" class="detail-tag test-type">{{ record.testType }}</span>
                </div>
            </div>
        </div>
        
        <Transition name="modal">
            <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
                <div class="modal-container">
                    <div class="modal-icon">⚠️</div>
                    <h3 class="modal-title">确认删除</h3>
                    <p class="modal-text">确定要删除这条练习记录吗？</p>
                    <div class="modal-buttons">
                        <button class="btn btn-cancel" @click="showDeleteConfirm = false">
                            取消
                        </button>
                        <button class="btn btn-danger" @click="handleDeleteConfirm">
                            删除
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
        
        <!-- 记录详情弹窗 -->
        <Transition name="modal">
            <div v-if="showRecordDetail && selectedRecord" class="modal-overlay" @click.self="closeRecordDetail">
                <div class="detail-modal-container">
                    <div class="detail-modal-header">
                        <h3>练习详情</h3>
                        <button class="close-btn" @click="closeRecordDetail">✕</button>
                    </div>
                    
                    <div class="detail-modal-body">
                        <!-- 左侧答题卡导航 -->
                        <div class="detail-sidebar">
                            <div class="sidebar-section">
                                <h4>📋 答题卡</h4>
                                <div class="answer-card-grid">
                                    <button 
                                        v-for="(question, idx) in selectedRecord.content" 
                                        :key="question.id || idx"
                                        class="answer-card-btn"
                                        :class="{ 
                                            active: currentQuestionIndex === idx,
                                            correct: question.has_choose_true === true,
                                            error: question.has_choose_true === false,
                                            unanswered: question.has_choose_true === null
                                        }"
                                        @click="scrollToQuestion(idx)"
                                    >
                                        {{ idx + 1 }}
                                    </button>
                                </div>
                            </div>
                            
                            <div class="sidebar-section">
                                <h4>📊 题目类型</h4>
                                <div class="question-types">
                                    <div 
                                        v-for="(type, count) in questionTypeStats" 
                                        :key="type"
                                        class="type-item"
                                    >
                                        <span class="type-name">{{ type }}</span>
                                        <span class="type-count">{{ count }}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="sidebar-section">
                                <h4>📈 答题统计</h4>
                                <div class="stats-summary">
                                    <div class="stat-row">
                                        <span class="stat-icon">✓</span>
                                        <span class="stat-text">答对</span>
                                        <span class="stat-num correct">{{ selectedRecord.topicTrueNum }}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-icon">✗</span>
                                        <span class="stat-text">答错</span>
                                        <span class="stat-num error">{{ selectedRecord.topicFalseNum }}</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-icon">○</span>
                                        <span class="stat-text">未答</span>
                                        <span class="stat-num warning">{{ selectedRecord.topicNullNum }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 右侧内容区 -->
                        <div class="detail-main-content" ref="detailMainContent">
                            <div class="detail-summary">
                                <div class="summary-item">
                                    <span class="summary-label">文档名称</span>
                                    <span class="summary-value">{{ selectedRecord.fileName }}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">练习时间</span>
                                    <span class="summary-value">{{ formatDate(selectedRecord.createTime) }}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">总题目数</span>
                                    <span class="summary-value">{{ selectedRecord.questionCount }}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">正确率</span>
                                    <span class="summary-value accuracy">{{ selectedRecord.accuracyRate }}%</span>
                                </div>
                            </div>
                            
                            <div class="detail-stats-grid">
                                <div class="stats-card correct">
                                    <span class="stats-number">{{ selectedRecord.topicTrueNum }}</span>
                                    <span class="stats-label">答对</span>
                                </div>
                                <div class="stats-card error">
                                    <span class="stats-number">{{ selectedRecord.topicFalseNum }}</span>
                                    <span class="stats-label">答错</span>
                                </div>
                                <div class="stats-card warning">
                                    <span class="stats-number">{{ selectedRecord.topicNullNum }}</span>
                                    <span class="stats-label">未答</span>
                                </div>
                                <div class="stats-card time">
                                    <span class="stats-number">{{ selectedRecord.averageAnswerTime }}s</span>
                                    <span class="stats-label">平均用时</span>
                                </div>
                            </div>
                            
                            <div v-if="selectedRecord.aiEvaluation && selectedRecord.aiEvaluation.trim()" class="ai-evaluation-section">
                                <h4>📝 AI 评估</h4>
                                <div class="ai-evaluation-content">{{ selectedRecord.aiEvaluation }}</div>
                            </div>
                            
                            <div class="questions-list">
                                <h4>📋 题目详情</h4>
                                <div 
                                    v-for="(question, idx) in selectedRecord.content" 
                                    :key="question.id || idx"
                                    :id="`question-${idx}`"
                                    class="question-item"
                                    :class="{ 
                                        correct: question.has_choose_true === true,
                                        error: question.has_choose_true === false,
                                        unanswered: question.has_choose_true === null
                                    }"
                                >
                                    <div class="question-header">
                                        <span class="question-index">{{ idx + 1 }}.</span>
                                        <span class="question-type">{{ question.topic_type }}</span>
                                        <span class="question-result" v-if="question.has_choose_true === true">✓ 正确</span>
                                        <span class="question-result" v-else-if="question.has_choose_true === false">✗ 错误</span>
                                        <span class="question-result" v-else>○ 未答</span>
                                    </div>
                                    <div class="question-content">{{ question.topic }}</div>
                                    <div class="question-answer">
                                        <span class="answer-label">你的答案：</span>
                                        <span class="answer-value" :class="{ correct: question.has_choose_true === true, error: question.has_choose_true === false, unanswered: question.has_choose_true === null }">
                                            {{ question.userAnswer || '未作答' }}
                                        </span>
                                        <span v-if="question.has_choose_true === false || question.has_choose_true === null" class="answer-label" style="margin-left: 1rem;">正确答案：</span>
                                        <span v-if="question.has_choose_true === false || question.has_choose_true === null" class="answer-value correct">
                                            {{ Array.isArray(question.answer) ? question.answer.join(',') : question.answer }}
                                        </span>
                                    </div>
                                    <div v-if="question.answer_time_str" class="question-time">
                                        <span class="time-label">答题用时：</span>
                                        <span class="time-value">{{ question.answer_time_str }} ({{ question.answer_time?.toFixed(2) }}s)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.recent-exercises {
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.section-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #1e293b;
}

.refresh-btn {
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
    background: #e2e8f0;
    border-color: #cbd5e1;
}

.refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 3rem;
    color: #64748b;
    font-size: 1rem;
}

.loading-spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.5rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #64748b;
}

.empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.records-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 500px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 8px;
}

.record-card {
    background: #fafafa;
    border-radius: 12px;
    padding: 1.25rem;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.record-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-color: #cbd5e1;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
}

.title-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.record-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
}

.record-time {
    font-size: 0.85rem;
    color: #94a3b8;
}

.delete-btn {
    background: #fef2f2;
    border: none;
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1rem;
}

.delete-btn:hover {
    background: #fecaca;
}

.file-name {
    font-size: 0.9rem;
    color: #64748b;
    margin-bottom: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.record-stats {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
}

.stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #667eea;
}

.stat-label {
    font-size: 0.8rem;
    color: #94a3b8;
}

.progress-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.progress-bar-container {
    flex: 1;
    height: 12px;
    background: #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    border-radius: 6px;
    transition: width 0.5s ease;
}

.progress-percent {
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
    min-width: 40px;
    text-align: right;
}

.modal-enter-active,
.modal-leave-active {
    transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
    transform: scale(0.9);
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
    background: white;
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    min-width: 320px;
}

.modal-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.modal-title {
    font-size: 1.25rem;
    color: #1e293b;
    margin: 0 0 0.75rem 0;
}

.modal-text {
    color: #64748b;
    margin: 0 0 1.5rem 0;
}

.modal-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: none;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-cancel {
    background: #f1f5f9;
    color: #475569;
}

.btn-cancel:hover {
    background: #e2e8f0;
}

.btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
}

.btn-danger:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

/* 详情弹窗样式 */
.detail-modal-container {
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
}

.detail-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}

.detail-modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #1e293b;
}

.close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: #f1f5f9;
    color: #64748b;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
}

.close-btn:hover {
    background: #e2e8f0;
    color: #1e293b;
}

.detail-modal-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.detail-summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.summary-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.summary-label {
    font-size: 0.85rem;
    color: #64748b;
}

.summary-value {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
}

.summary-value.accuracy {
    color: #10b981;
    font-size: 1.25rem;
}

.detail-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.stats-card {
    padding: 1rem;
    border-radius: 12px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.stats-card.correct {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.stats-card.error {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
}

.stats-card.warning {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
}

.stats-card.time {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: white;
}

.stats-number {
    font-size: 1.5rem;
    font-weight: 700;
}

.stats-label {
    font-size: 0.85rem;
    opacity: 0.9;
}

.ai-evaluation-section {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
}

.ai-evaluation-section h4 {
    margin: 0 0 0.75rem 0;
    color: #166534;
    font-size: 1rem;
}

.ai-evaluation-content {
    color: #15803d;
    font-size: 0.95rem;
    line-height: 1.6;
    white-space: pre-wrap;
}

.questions-list {
    margin-top: 1.5rem;
}

.questions-list h4 {
    margin: 0 0 1rem 0;
    color: #1e293b;
    font-size: 1.1rem;
}

.question-item {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    transition: all 0.2s;
}

.question-item:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.question-item.correct {
    border-left: 4px solid #10b981;
}

.question-item.error {
    border-left: 4px solid #ef4444;
}

.question-item.unanswered {
    border-left: 4px solid #f59e0b;
}

.question-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.question-index {
    font-weight: 600;
    color: #1e293b;
}

.question-type {
    font-size: 0.8rem;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.question-result {
    font-size: 0.85rem;
    font-weight: 600;
    margin-left: auto;
}

.question-item.correct .question-result {
    color: #10b981;
}

.question-item.error .question-result {
    color: #ef4444;
}

.question-item.unanswered .question-result {
    color: #f59e0b;
}

.question-content {
    color: #334155;
    font-size: 0.95rem;
    line-height: 1.5;
    margin-bottom: 0.75rem;
}

.question-answer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
}

.answer-label {
    color: #64748b;
}

.answer-value {
    color: #1e293b;
    font-weight: 500;
}

.answer-value.correct {
    color: #10b981;
}

.answer-value.error {
    color: #ef4444;
}

.answer-value.unanswered {
    color: #f97316;
    background: rgba(249, 115, 22, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(249, 115, 22, 0.3);
}

.question-time {
    font-size: 0.85rem;
    color: #64748b;
}

.time-value {
    color: #6366f1;
    font-weight: 500;
}

.record-detail-preview {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.75rem;
}

.detail-tag {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: #dcfce7;
    color: #166534;
}

.detail-tag.error {
    background: #fee2e2;
    color: #991b1b;
}

.detail-tag.warning {
    background: #fef3c7;
    color: #92400e;
}

.detail-tag.test-type {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 500;
}

.record-card {
    cursor: pointer;
    transition: all 0.2s;
}

.record-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 侧边栏布局样式 */
.detail-modal-container {
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 1200px;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
}

.detail-modal-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.detail-sidebar {
    width: 280px;
    background: linear-gradient(180deg, #1e293b 0%, #334155 100%);
    padding: 1.25rem;
    overflow-y: auto;
    color: white;
    flex-shrink: 0;
}

.sidebar-section {
    margin-bottom: 1.5rem;
}

.sidebar-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    color: #cbd5e1;
    font-weight: 600;
}

.answer-card-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.4rem;
}

.answer-card-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: none;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    background: #475569;
    color: white;
}

.answer-card-btn:hover {
    transform: scale(1.05);
}

.answer-card-btn.active {
    background: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.answer-card-btn.correct {
    background: #10b981;
}

.answer-card-btn.error {
    background: #ef4444;
}

.answer-card-btn.unanswered {
    background: #f59e0b;
}

.question-types {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.type-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
}

.type-name {
    font-size: 0.85rem;
    color: #e2e8f0;
}

.type-count {
    font-size: 0.9rem;
    font-weight: 600;
    color: #f1f5f9;
}

.stats-summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.stat-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
}

.stat-icon {
    font-size: 0.9rem;
    width: 20px;
}

.stat-text {
    flex: 1;
    font-size: 0.85rem;
    color: #e2e8f0;
}

.stat-num {
    font-size: 0.95rem;
    font-weight: 700;
}

.stat-num.correct {
    color: #10b981;
}

.stat-num.error {
    color: #ef4444;
}

.stat-num.warning {
    color: #f59e0b;
}

.detail-main-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
}
</style>
