<template>
    <div v-if="visible" class="ai-review-modal-overlay">
        <div class="ai-review-modal">
            <div class="ai-review-modal-header">
                <h3 class="ai-review-modal-title">🤖 AI评阅</h3>
                <button v-if="status !== 'reviewing'" class="ai-review-modal-close" @click="handleClose">×</button>
            </div>
            
            <div class="ai-review-modal-body">
                <div v-if="status === 'reviewing'" class="reviewing-state">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">正在AI评阅中...</p>
                    <p class="loading-hint">请稍候，评阅完成后可关闭</p>
                </div>
                
                <div v-else-if="status === 'completed' && reviewResult" class="completed-state">
                    <div class="result-header">
                        <span class="result-icon">{{ reviewResult.ai_score >= (score * 0.7) ? '✅' : '⚠️' }}</span>
                        <span class="result-label">评阅完成</span>
                    </div>
                    
                    <div class="score-section">
                        <div class="score-label">AI评分</div>
                        <div class="score-value" :class="reviewResult.ai_score >= (score * 0.7) ? 'high' : 'low'">
                            {{ reviewResult.ai_score.toFixed(1) }} / {{ score.toFixed(1) }}
                        </div>
                    </div>
                    
                    <div class="comment-section">
                        <div class="comment-label">评语</div>
                        <div class="comment-content">{{ reviewResult.comment }}</div>
                    </div>
                    
                    <div v-if="reviewResult.losePointReason" class="lose-reason-section">
                        <div class="lose-reason-label">扣分原因</div>
                        <div class="lose-reason-content">{{ reviewResult.losePointReason }}</div>
                    </div>
                </div>
                
                <div v-else-if="status === 'error'" class="error-state">
                    <span class="error-icon">❌</span>
                    <p class="error-text">AI评阅失败，请稍后重试</p>
                </div>
            </div>
            
            <div class="ai-review-modal-footer">
                <button 
                    class="confirm-btn" 
                    :disabled="status === 'reviewing'"
                    @click="handleClose"
                >
                    {{ status === 'reviewing' ? '评阅中...' : '确认' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

interface AIReviewResult {
    ai_score: number
    comment: string
    losePointReason: string
}

const props = defineProps<{
    visible: boolean
    score: number
}>()

const emit = defineEmits<{
    (e: 'close'): void
}>()

const status = ref<'idle' | 'reviewing' | 'completed' | 'error'>('idle')
const reviewResult = ref<AIReviewResult | null>(null)

watch(() => props.visible, (newVal) => {
    if (newVal) {
        status.value = 'reviewing'
        reviewResult.value = null
    }
})

function handleKeydown(e: KeyboardEvent) {
    // 使用 Alt+Enter 关闭模态框，避免与确认答案的 Enter 键冲突
    if (e.key === 'Enter' && e.altKey && status.value === 'completed') {
        e.preventDefault()
        handleClose()
    }
}

onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
})

function setResult(result: AIReviewResult) {
    reviewResult.value = result
    status.value = 'completed'
}

function setError() {
    status.value = 'error'
}

function handleClose() {
    emit('close')
}

defineExpose({
    setResult,
    setError
})
</script>

<style scoped>
.ai-review-modal-overlay {
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

.ai-review-modal {
    background: #fff;
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
}

.ai-review-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #fff;
}

.ai-review-modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
}

.ai-review-modal-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.25rem 0.75rem;
    border-radius: 8px;
    transition: background 0.2s;
}

.ai-review-modal-close:hover {
    background: rgba(255, 255, 255, 0.3);
}

.ai-review-modal-body {
    padding: 1.5rem;
    min-height: 200px;
}

.reviewing-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.loading-text {
    margin-top: 1rem;
    color: #6b7280;
    font-size: 1rem;
}

.loading-hint {
    margin-top: 0.5rem;
    color: #9ca3af;
    font-size: 0.85rem;
}

.completed-state {
    padding: 0.5rem;
}

.result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

.result-icon {
    font-size: 1.5rem;
}

.result-label {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
}

.score-section {
    text-align: center;
    padding: 1rem;
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
    border-radius: 12px;
    margin-bottom: 1rem;
}

.score-label {
    font-size: 0.9rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
}

.score-value {
    font-size: 2.5rem;
    font-weight: 700;
}

.score-value.high {
    color: #16a34a;
}

.score-value.low {
    color: #dc2626;
}

.comment-section {
    margin-bottom: 1rem;
}

.comment-label {
    font-size: 0.9rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.comment-content {
    background: #f9fafb;
    padding: 1rem;
    border-radius: 8px;
    color: #374151;
    line-height: 1.6;
}

.lose-reason-section {
    background: rgba(239, 68, 68, 0.08);
    padding: 1rem;
    border-radius: 8px;
    border-left: 4px solid #dc2626;
}

.lose-reason-label {
    font-size: 0.9rem;
    color: #dc2626;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.lose-reason-content {
    color: #991b1b;
    line-height: 1.6;
}

.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
}

.error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.error-text {
    color: #dc2626;
    font-size: 1rem;
}

.ai-review-modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
}

.confirm-btn {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #fff;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.confirm-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.confirm-btn:disabled {
    background: linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%);
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
    box-shadow: none;
}
</style>