<script setup lang="ts">
/**
 * 加载中模态窗口组件
 *
 * 显示数据加载状态的提示信息
 */
defineProps<{
    /** 是否显示模态窗口 */
    visible: boolean
    /** 加载提示信息 */
    message?: string
    /** 是否显示取消按钮 */
    showCancel?: boolean
}>()

const emit = defineEmits<{
    /** 取消操作 */
    (e: 'cancel'): void
}>()

function handleCancel() {
    emit('cancel')
}
</script>

<template>
    <Transition name="modal">
        <div v-if="visible" class="modal-overlay">
            <div class="modal-container">
                <!-- 加载动画 -->
                <div class="loading-animation">
                    <div class="spinner"></div>
                </div>

                <!-- 标题 -->
                <h2 class="modal-title">⏳ 处理中</h2>

                <!-- 提示信息 -->
                <p class="loading-message">
                    {{ message || '文件正在处理中，请稍后...' }}
                </p>

                <!-- 加载进度指示器 -->
                <div class="progress-indicator">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>

                <!-- 提示文字 -->
                <p class="tip-text">
                    此过程可能需要较长时间，请耐心等待
                </p>

                <!-- 取消按钮（可选） -->
                <div v-if="showCancel !== false" class="button-group">
                    <button class="btn btn-secondary" @click="handleCancel">
                        取消
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
/* 模态窗口过渡动画 */
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

/* 遮罩层 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
}

/* 模态窗口容器 */
.modal-container {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 16px;
    padding: 2.5rem;
    min-width: 400px;
    max-width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    text-align: center;
    position: relative;
    animation: modalPop 0.3s ease-out;
}

@keyframes modalPop {
    from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

/* 加载动画 */
.loading-animation {
    width: 120px;
    height: 120px;
    margin: 0 auto 1.5rem;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}

.spinner {
    width: 80px;
    height: 80px;
    border: 6px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

/* 标题 */
.modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 1rem;
}

/* 加载消息 */
.loading-message {
    color: #475569;
    margin-bottom: 1.5rem;
    font-size: 1rem;
    line-height: 1.6;
}

/* 进度指示器 */
.progress-indicator {
    margin-bottom: 1.5rem;
}

.progress-bar {
    width: 100%;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
    position: relative;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    border-radius: 3px;
    animation: progress 2s ease-in-out infinite;
    width: 60%;
}

@keyframes progress {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(250%);
    }
}

/* 提示文字 */
.tip-text {
    color: #94a3b8;
    font-size: 0.875rem;
    margin-bottom: 2rem;
}

/* 按钮组 */
.button-group {
    display: flex;
    justify-content: center;
}

.btn {
    padding: 0.75rem 2rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-size: 1rem;
}

.btn-secondary {
    background: #e2e8f0;
    color: #475569;
}

.btn-secondary:hover {
    background: #cbd5e1;
}

.btn:active {
    transform: translateY(0);
}
</style>