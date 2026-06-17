<script setup lang="ts">
    /**
     * 删除确认模态窗口组件
     * 
     * 防止误操作的二次确认窗口
     */
    defineProps<{
        /** 是否显示模态窗口 */
        visible: boolean
        /** 要删除的文件名 */
        fileName: string
    }>()

    const emit = defineEmits<{
        /** 取消删除 */
        (e: 'cancel'): void
        /** 确认删除 */
        (e: 'confirm'): void
    }>()

    function handleCancel() {
        emit('cancel')
    }

    function handleConfirm() {
        emit('confirm')
    }
</script>

<template>
    <Transition name="modal">
        <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
            <div class="modal-container">
                <!-- 警告图标 -->
                <div class="warning-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>

                <!-- 标题 -->
                <h2 class="modal-title">⚠️ 删除确认</h2>

                <!-- 警告消息 -->
                <p class="warning-message">
                    确定要删除以下文件吗？
                </p>

                <!-- 文件信息卡片 -->
                <div class="file-info">
                    <div class="file-icon-wrapper">
                        <span class="file-icon">🗑️</span>
                    </div>
                    <div class="file-details">
                        <p class="file-name">{{ fileName }}</p>
                    </div>
                </div>

                <!-- 提示信息 -->
                <div class="alert-message">
                    <p>⚠️ 此操作不可逆，文件将被永久删除</p>
                </div>

                <!-- 按钮组 -->
                <div class="button-group">
                    <button class="btn btn-secondary" @click="handleCancel">
                        取消
                    </button>
                    <button class="btn btn-danger" @click="handleConfirm">
                        确认删除
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
        background: rgba(0, 0, 0, 0.5);
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

    /* 警告图标 */
    .warning-icon {
        width: 100px;
        height: 100px;
        margin: 0 auto 1.5rem;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        animation: iconShake 0.5s ease-out;
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
    }

    @keyframes iconShake {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-10deg); }
        75% { transform: rotate(10deg); }
    }

    /* 标题 */
    .modal-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 1rem;
    }

    /* 警告消息 */
    .warning-message {
        color: #475569;
        font-size: 1rem;
        margin-bottom: 1.5rem;
    }

    /* 文件信息卡片 */
    .file-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    .file-icon-wrapper {
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
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
        color: #991b1b;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* 提示信息 */
    .alert-message {
        background: #fef3c7;
        border: 1px solid #fcd34d;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 2rem;
    }

    .alert-message p {
        color: #92400e;
        margin: 0;
        font-size: 0.9rem;
    }

    /* 按钮组 */
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

    .btn-secondary {
        background: #e2e8f0;
        color: #475569;
    }

    .btn-secondary:hover {
        background: #cbd5e1;
    }

    .btn-danger {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
    }

    .btn-danger:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
    }

    .btn:active {
        transform: translateY(0);
    }
</style>
