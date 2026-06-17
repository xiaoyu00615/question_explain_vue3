<script setup lang="ts">
    defineProps<{
        visible: boolean
        status: 'loading' | 'success' | 'error'
        message: string
    }>()

    const emit = defineEmits<{
        (e: 'close'): void
    }>()

    function handleClose() {
        emit('close')
    }
</script>

<template>
    <Transition name="modal">
        <div v-if="visible" class="modal-overlay" @click.self="handleClose">
            <div class="modal-container">
                <!-- 加载中状态 -->
                <template v-if="status === 'loading'">
                    <div class="loading-icon">
                        <div class="spinner"></div>
                    </div>
                    <h2 class="modal-title">⏳ 提交中</h2>
                    <p class="modal-message">{{ message }}</p>
                </template>

                <!-- 成功状态 -->
                <template v-else-if="status === 'success'">
                    <div class="status-icon success">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <h2 class="modal-title">🎉 提交成功</h2>
                    <p class="modal-message">{{ message }}</p>
                    <div class="button-group">
                        <button class="btn btn-primary" @click="handleClose">
                            确定
                        </button>
                    </div>
                </template>

                <!-- 错误状态 -->
                <template v-else-if="status === 'error'">
                    <div class="status-icon error">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </div>
                    <h2 class="modal-title">❌ 提交失败</h2>
                    <p class="modal-message">{{ message }}</p>
                    <div class="button-group">
                        <button class="btn btn-primary" @click="handleClose">
                            关闭
                        </button>
                    </div>
                </template>
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
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 16px;
        padding: 2.5rem;
        min-width: 400px;
        max-width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
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

    .loading-icon {
        width: 100px;
        height: 100px;
        margin: 0 auto 1.5rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .status-icon {
        width: 100px;
        height: 100px;
        margin: 0 auto 1.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        animation: iconBounce 0.6s ease-out;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .status-icon.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
    }

    .status-icon.error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
    }

    @keyframes iconBounce {
        0% {
            transform: scale(0);
        }
        50% {
            transform: scale(1.2);
        }
        100% {
            transform: scale(1);
        }
    }

    .modal-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 1rem;
    }

    .modal-message {
        color: #64748b;
        margin-bottom: 1.5rem;
        line-height: 1.6;
    }

    .button-group {
        display: flex;
        justify-content: center;
        gap: 1rem;
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

    .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }

    .btn:active {
        transform: translateY(0);
    }
</style>