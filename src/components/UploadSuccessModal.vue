<script setup lang="ts">
    /**
     * 上传成功模态窗口组件
     * 
     * 显示文件上传成功的提示信息，包含文件名、大小、状态等信息
     */
    defineProps<{
        /** 是否显示模态窗口 */
        visible: boolean
        /** 上传成功的文件名 */
        fileName: string
        /** 文件大小（字节） */
        fileSize?: number
        /** 文件类型 */
        fileType?: string
    }>()

    const emit = defineEmits<{
        /** 关闭模态窗口 */
        (e: 'close'): void
        /** 确认并关闭 */
        (e: 'confirm'): void
    }>()

    /**
     * 格式化文件大小
     * @param bytes - 文件大小（字节）
     * @returns 格式化后的文件大小字符串
     */
    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    /**
     * 获取文件图标
     * @param type - 文件类型
     * @returns 对应的文件图标
     */
    function getFileIcon(type: string): string {
        switch (type?.toLowerCase()) {
            case 'pdf': return '📕'
            case 'docx':
            case 'doc': return '📘'
            case 'xlsx':
            case 'xls': return '📗'
            case 'txt': return '📄'
            default: return '📁'
        }
    }

    /**
     * 关闭模态窗口
     */
    function handleClose() {
        emit('close')
    }

    /**
     * 确认并关闭
     */
    function handleConfirm() {
        emit('confirm')
    }
</script>

<template>
    <Transition name="modal">
        <div v-if="visible" class="modal-overlay" @click.self="handleClose">
            <div class="modal-container">
                <!-- 成功图标 -->
                <div class="success-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>

                <!-- 标题 -->
                <h2 class="modal-title">🎉 处理完成</h2>

                <!-- 文件信息卡片 -->
                <div class="file-info">
                    <div class="file-icon-wrapper">
                        <span class="file-icon">{{ getFileIcon(fileType || '') }}</span>
                    </div>
                    <div class="file-details">
                        <p class="file-name">{{ fileName }}</p>
                        <div class="file-meta">
                            <span v-if="fileType" class="meta-item">类型: {{ fileType.toUpperCase() }}</span>
                            <span v-if="fileSize" class="meta-item">大小: {{ formatFileSize(fileSize) }}</span>
                        </div>
                    </div>
                </div>

                <!-- 提示信息 -->
                <p class="success-message">
                    文件已成功上传并完成处理！
                </p>

                <!-- 状态提示 -->
                <div class="status-indicators">
                    <div class="status-item">
                        <span class="status-icon success">✅</span>
                        <span class="status-text">向量化成功</span>
                    </div>
                    <div class="status-item">
                        <span class="status-icon success">✅</span>
                        <span class="status-text">JSON化完成</span>
                    </div>
                </div>

                <!-- 按钮组 -->
                <div class="button-group">
                    <button class="btn btn-secondary" @click="handleClose">
                        关闭
                    </button>
                    <button class="btn btn-primary" @click="handleConfirm">
                        确定
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

    /* 成功图标 */
    .success-icon {
        width: 100px;
        height: 100px;
        margin: 0 auto 1.5rem;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        animation: iconBounce 0.6s ease-out;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
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

    /* 标题 */
    .modal-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 1rem;
    }

    /* 文件信息卡片 */
    .file-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: #f1f5f9;
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    .file-icon-wrapper {
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        color: #1e293b;
        margin: 0 0 0.5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .file-meta {
        display: flex;
        gap: 1rem;
    }

    .meta-item {
        font-size: 0.875rem;
        color: #64748b;
    }

    /* 成功消息 */
    .success-message {
        color: #64748b;
        margin-bottom: 1.5rem;
        line-height: 1.6;
    }

    /* 状态指示器 */
    .status-indicators {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
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

    .status-icon.success {
        animation: successPulse 0.5s ease;
    }

    @keyframes successPulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.3);
        }
    }

    .status-text {
        font-size: 0.875rem;
        color: #10b981;
        font-weight: 500;
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