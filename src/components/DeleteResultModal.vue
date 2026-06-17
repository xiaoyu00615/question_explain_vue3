<script setup lang="ts">
    defineProps<{
        visible: boolean
        success: boolean
        message: string
        fileName?: string
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
                <div :class="['result-icon', success ? 'success' : 'error']">
                    <svg v-if="success" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <svg v-else width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>

                <h2 class="modal-title">
                    {{ success ? '🎉 删除成功' : '⚠️ 提示' }}
                </h2>

                <p class="result-message">
                    {{ message }}
                </p>

                <div v-if="fileName" class="file-info" :class="{ 'file-not-found': !success }">
                    <div class="file-icon-wrapper" :class="{ 'warning': !success }">
                        <span class="file-icon">{{ success ? '🗑️' : '📄' }}</span>
                    </div>
                    <div class="file-details">
                        <p class="file-name">{{ fileName }}</p>
                    </div>
                </div>

                <div class="status-indicators">
                    <div class="status-item" :class="{ completed: success }">
                        <span class="status-icon">{{ success ? '✅' : '⏳' }}</span>
                        <span class="status-text">文件删除</span>
                    </div>
                    <div class="status-item" :class="{ completed: success }">
                        <span class="status-icon">{{ success ? '✅' : '⏳' }}</span>
                        <span class="status-text">数据更新</span>
                    </div>
                </div>

                <div class="button-group">
                    <button class="btn btn-primary" @click="handleClose">
                        确定
                    </button>
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

    .result-icon {
        width: 100px;
        height: 100px;
        margin: 0 auto 1.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        animation: iconBounce 0.6s ease-out;
    }

    .result-icon.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
    }

    .result-icon.error {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
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

    .result-message {
        color: #475569;
        font-size: 1rem;
        margin-bottom: 1.5rem;
        line-height: 1.6;
    }

    .file-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    .file-info.file-not-found {
        background: #fffbeb;
        border-color: #fcd34d;
    }

    .file-icon-wrapper {
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .file-icon-wrapper.warning {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }

    .file-icon {
        font-size: 2rem;
    }

    .file-details {
        flex: 1;
        text-align: left;
    }

    .file-name {
        font-weight: 500;
        color: #166534;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .file-not-found .file-name {
        color: #92400e;
    }

    .status-indicators {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-bottom: 2rem;
    }

    .status-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .status-icon {
        font-size: 1.25rem;
    }

    .status-text {
        font-size: 0.875rem;
        color: #64748b;
    }

    .status-item.completed .status-text {
        color: #059669;
        font-weight: 500;
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
