<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface ImageItem {
    id: string
    file?: File
    preview: string
    name: string
    size: number
    order: number
    aiResult?: string
    url?: string
    fileSize?: number
}

interface BatchRecord {
    id: string
    timestamp: Date
    images: ImageItem[]
    orcId?: string
}

const imageList = ref<ImageItem[]>([])
const batchRecords = ref<BatchRecord[]>([])
const isDragging = ref(false)
const draggedIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

const exportFormat = ref<'word' | 'markdown' | 'txt' | 'html' | 'json'>('markdown')
const batchExportFormat = ref<Record<string, 'word' | 'markdown' | 'txt' | 'html' | 'json'>>({})
const isExporting = ref(false)

const batchExportName = ref<Record<string, string>>({})
const batchExportPreset = ref<Record<string, string>>({})

const selectedBatchIds = ref<string[]>([])
const isSelectAll = ref(false)

const exportPresets = [
    { value: 'plain', label: '纯文本拼接', desc: '所有内容直接拼接' },
    { value: 'chunked', label: '分块提示拼接', desc: '按图片分块，带提示语' },
    { value: 'numbered', label: '编号列表', desc: '每张图片内容带序号' },
    { value: 'titles', label: '标题分段', desc: '每张图片作为独立章节' },
    { value: 'markdown', label: 'Markdown格式', desc: '使用Markdown语法' },
    { value: 'clean', label: '简洁模式', desc: '去除多余空白和换行' }
]

function generateDefaultExportName(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    return `视觉转文档_${year}${month}${day}_${hours}${minutes}${seconds}`
}

const fileInputRef = ref<HTMLInputElement | null>(null)

const showUploadModal = ref(false)
const uploadProgress = ref(0)
const uploadMessage = ref('')

const showEditModal = ref(false)
const currentEditingIndex = ref<number>(-1)
const editingContent = ref('')
const editingBatchIndex = ref<number>(-1)

const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageName = ref('')

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function getImageMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop()
    const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml'
    }
    return mimeMap[ext || ''] || 'image/jpeg'
}

function formatImageUrl(url: string, filename: string): string {
    if (!url) return ''
    
    if (url.startsWith('data:')) {
        return url
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
    }
    
    if (/^[A-Za-z0-9+/=]+$/.test(url.replace(/\s/g, ''))) {
        const mimeType = getImageMimeType(filename)
        return `data:${mimeType};base64,${url}`
    }
    
    return `http://localhost:8001${url}`
}

async function fetchHistoryRecords() {
    try {
        console.log('开始获取历史记录...')
        const response = await fetch('/get/visual_data')
        console.log('响应状态:', response.status)
        
        if (!response.ok) {
            console.error('获取历史记录失败:', response.status)
            return
        }
        
        const result = await response.json()
        console.log('响应数据:', JSON.stringify(result, null, 2))
        
        if (result.code === 200 && result.data) {
            let historyData: Array<{ images_data: Array<{ filename: string, url: string, text: string, base64?: string, size?: number }>, orc_id?: string }> = []
            
            if (Array.isArray(result.data)) {
                historyData = result.data
            } else if (result.data && typeof result.data === 'object') {
                historyData = [result.data as { images_data: Array<{ filename: string, url: string, text: string, base64?: string }>, orc_id?: string }]
            }
            
            console.log('解析到的历史记录数量:', historyData.length)
            
            historyData.forEach((item, index) => {
                if (item.images_data && item.images_data.length > 0) {
                    const images: ImageItem[] = item.images_data.map((img, imgIndex) => ({
                        id: `history_img_${index}_${imgIndex}`,
                        preview: img.base64 ? formatImageUrl(img.base64, img.filename) : formatImageUrl(img.url, img.filename),
                        name: img.filename,
                        size: img.size || 0,
                        fileSize: img.size || 0,
                        order: imgIndex,
                        aiResult: img.text,
                        url: img.url
                    }))
                    
                    const record: BatchRecord = {
                        id: `history_batch_${index}`,
                        timestamp: new Date(),
                        images: images,
                        orcId: item.orc_id
                    }
                    
                    batchRecords.value.push(record)
                    batchExportFormat.value[record.id] = 'markdown'
                    batchExportPreset.value[record.id] = 'plain'
                }
            })
            
            console.log('加载完成，共', batchRecords.value.length, '条记录')
        } else {
            console.log('数据格式不符合预期')
        }
    } catch (error) {
        console.error('获取历史记录异常:', error)
    }
}

onMounted(() => {
    fetchHistoryRecords()
})

function triggerFileUpload() {
    fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files) {
        processFiles(Array.from(files))
    }
    input.value = ''
}

function handleDrop(event: DragEvent) {
    event.preventDefault()
    isDragging.value = false
    
    const files = event.dataTransfer?.files
    if (files) {
        processFiles(Array.from(files))
    }
}

function handleDragOver(event: DragEvent) {
    event.preventDefault()
    isDragging.value = true
}

function handleDragLeave() {
    isDragging.value = false
}

function processFiles(files: File[]) {
    const imageFiles = files.filter(file => 
        ALLOWED_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE
    )
    
    if (imageFiles.length === 0) {
        alert('请上传 JPEG/PNG/GIF/WEBP 格式的图片，且文件大小不超过5MB')
        return
    }
    
    imageFiles.forEach((file, index) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const newImage: ImageItem = {
                id: `img_${Date.now()}_${index}`,
                file: file,
                preview: e.target?.result as string,
                name: file.name,
                size: file.size,
                order: imageList.value.length + index
            }
            imageList.value.push(newImage)
        }
        reader.readAsDataURL(file)
    })
}

function handleImageDragStart(index: number) {
    draggedIndex.value = index
}

function handleImageDragOver(event: DragEvent, index: number) {
    event.preventDefault()
    dropTargetIndex.value = index
}

function handleImageDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault()
    
    if (draggedIndex.value !== null && draggedIndex.value !== targetIndex) {
        const draggedItem = imageList.value[draggedIndex.value]
        if (draggedItem) {
            imageList.value.splice(draggedIndex.value, 1)
            imageList.value.splice(targetIndex, 0, draggedItem)
            
            imageList.value.forEach((item, idx) => {
                item.order = idx
            })
        }
    }
    
    draggedIndex.value = null
    dropTargetIndex.value = null
}

function handleImageDragEnd() {
    draggedIndex.value = null
    dropTargetIndex.value = null
}

function removeImage(index: number) {
    imageList.value.splice(index, 1)
    imageList.value.forEach((item, idx) => {
        item.order = idx
    })
}

function clearAllImages() {
    imageList.value = []
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function formatDate(date: Date): string {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

function moveImage(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= imageList.value.length) return
    
    const items = [...imageList.value]
    const temp = items[index] as ImageItem
    items[index] = items[newIndex] as ImageItem
    items[newIndex] = temp
    imageList.value = items
    
    imageList.value.forEach((item, idx) => {
        item.order = idx
    })
}

const hasImages = computed(() => imageList.value.length > 0)
const hasBatchRecords = computed(() => batchRecords.value.length > 0)

async function uploadAndRecognize() {
    if (!hasImages.value) return
    
    const unrecognizedImages = imageList.value.filter(img => !img.aiResult)
    
    if (unrecognizedImages.length === 0) {
        openEditModal(0)
        return
    }
    
    showUploadModal.value = true
    uploadProgress.value = 0
    uploadMessage.value = `正在上传 ${unrecognizedImages.length} 张图片进行AI识别...`
    
    try {
        const formData = new FormData()
        unrecognizedImages.forEach((imageItem) => {
            if (imageItem && imageItem.file) {
                formData.append('files', imageItem.file)
            }
        })
        
        uploadProgress.value = 30
        uploadMessage.value = '正在上传图片...'
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
            controller.abort(new Error('请求超时'))
        }, 300000)
        
        const response = await fetch('/batch_ocr', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        uploadProgress.value = 60
        uploadMessage.value = '图片上传完成，正在进行AI识别...'
        
        if (!response.ok) {
            throw new Error(`服务器错误，状态码: ${response.status}`)
        }
        
        let result: { code: number, msg: string, data: { images_data: Array<{ filename: string, url: string, text: string }> } } | null = null
        try {
            result = await response.json()
        } catch (jsonError) {
            const textResponse = await response.text()
            console.error('JSON解析失败，响应内容:', textResponse)
            throw new Error(`服务器返回无效数据: ${(jsonError as Error).message}`)
        }
        
        if (!result) {
            throw new Error('服务器返回空响应')
        }
        
        uploadProgress.value = 80
        
        if (result.code === 200 && result.data && result.data.images_data) {
            uploadMessage.value = 'AI识别完成，正在处理结果...'
            
            result.data.images_data.forEach((item) => {
                const imageItem = unrecognizedImages.find(img => img?.name === item.filename)
                if (imageItem) {
                    const index = imageList.value.findIndex(img => img.id === imageItem.id)
                    if (index !== -1) {
                        const image = imageList.value[index]
                        if (image) {
                            image.aiResult = item.text
                        }
                    }
                }
            })
            
            const newBatch: BatchRecord = {
                id: `batch_${Date.now()}`,
                timestamp: new Date(),
                images: [...imageList.value]
            }
            batchRecords.value.unshift(newBatch)
            
            batchExportFormat.value[newBatch.id] = 'markdown'
            batchExportPreset.value[newBatch.id] = 'plain'
        } else {
            console.error('AI识别失败:', result.msg)
            unrecognizedImages.forEach((imageItem) => {
                if (imageItem) {
                    const index = imageList.value.findIndex(img => img.id === imageItem.id)
                    if (index !== -1) {
                        const image = imageList.value[index]
                        if (image) {
                            image.aiResult = `识别失败: ${result.msg || '未知错误'}`
                        }
                    }
                }
            })
        }
        
        uploadProgress.value = 100
        uploadMessage.value = 'AI识别完成！'
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        showUploadModal.value = false
        imageList.value = []
        
    } catch (error) {
        console.error('上传失败:', error)
        const err = error as Error
        let userMessage = '上传失败: '
        
        if (err.name === 'AbortError') {
            userMessage += '请求超时，请尝试减少图片数量后重试'
        } else if (err.message.includes('Failed to fetch')) {
            userMessage += '无法连接到服务器，请检查网络连接或稍后重试'
        } else if (err.message.includes('Unexpected end of JSON')) {
            userMessage += '服务器返回数据异常，请稍后重试'
        } else {
            userMessage += err.message
        }
        
        uploadMessage.value = userMessage
        uploadProgress.value = 0
        
        setTimeout(() => {
            showUploadModal.value = false
        }, 3000)
    }
}

function openEditModal(index: number, batchIndex: number = -1) {
    if (batchIndex >= 0) {
        editingBatchIndex.value = batchIndex
        const batch = batchRecords.value[batchIndex]
        if (!batch || index < 0 || index >= batch.images.length) return
        currentEditingIndex.value = index
        const image = batch.images[index]
        editingContent.value = image?.aiResult || '暂无识别结果'
    } else {
        editingBatchIndex.value = -1
        if (index < 0 || index >= imageList.value.length) return
        currentEditingIndex.value = index
        const image = imageList.value[index]
        editingContent.value = image?.aiResult || '暂无识别结果'
    }
    showEditModal.value = true
}

function saveEdit() {
    if (editingBatchIndex.value >= 0) {
        const batch = batchRecords.value[editingBatchIndex.value]
        const idx = currentEditingIndex.value
        if (batch && idx >= 0 && idx < batch.images.length) {
            const image = batch.images[idx]
            if (image) {
                image.aiResult = editingContent.value
            }
        }
    } else {
        const idx = currentEditingIndex.value
        if (idx >= 0 && idx < imageList.value.length) {
            const image = imageList.value[idx]
            if (image) {
                image.aiResult = editingContent.value
            }
        }
    }
}

function closeEditModal() {
    showEditModal.value = false
    currentEditingIndex.value = -1
    editingBatchIndex.value = -1
    editingContent.value = ''
}

function prevImage() {
    saveEdit()
    if (editingBatchIndex.value >= 0) {
        const batch = batchRecords.value[editingBatchIndex.value]
        if (batch && currentEditingIndex.value > 0) {
            currentEditingIndex.value--
            const image = batch.images[currentEditingIndex.value]
            editingContent.value = image?.aiResult || ''
        }
    } else {
        if (currentEditingIndex.value > 0) {
            currentEditingIndex.value--
            const image = imageList.value[currentEditingIndex.value]
            editingContent.value = image?.aiResult || ''
        }
    }
}

function nextImage() {
    saveEdit()
    if (editingBatchIndex.value >= 0) {
        const batch = batchRecords.value[editingBatchIndex.value]
        if (batch && currentEditingIndex.value < batch.images.length - 1) {
            currentEditingIndex.value++
            const image = batch.images[currentEditingIndex.value]
            editingContent.value = image?.aiResult || ''
        }
    } else {
        if (currentEditingIndex.value < imageList.value.length - 1) {
            currentEditingIndex.value++
            const image = imageList.value[currentEditingIndex.value]
            editingContent.value = image?.aiResult || ''
        }
    }
}

function finishEditAndExport() {
    saveEdit()
    closeEditModal()
}

function openImagePreview(url: string, name: string) {
    previewImageUrl.value = url
    previewImageName.value = name
    showImagePreview.value = true
}

function closeImagePreview() {
    showImagePreview.value = false
    previewImageUrl.value = ''
    previewImageName.value = ''
}

function exportBatchDocument(batchId: string) {
    const batch = batchRecords.value.find(b => b.id === batchId)
    if (!batch) return
    
    const format = batchExportFormat.value[batchId] || 'markdown'
    const preset = batchExportPreset.value[batchId] || 'plain'
    const customName = batchExportName.value[batchId] !== undefined ? batchExportName.value[batchId] : generateDefaultExportName()
    exportDocumentWithImages(batch.images, format, batch.timestamp, preset, customName)
}

function applyExportPreset(images: ImageItem[], preset: string): string {
    let content = ''
    
    switch (preset) {
        case 'plain':
            content = images.map(img => img.aiResult || '').join('\n\n')
            break
        case 'chunked':
            content = images.map((img, index) => 
                `【图片${index + 1}】${img.name}\n---\n${img.aiResult || '暂无识别结果'}`
            ).join('\n\n')
            break
        case 'numbered':
            content = images.map((img, index) => 
                `${index + 1}. ${img.aiResult || '暂无识别结果'}`
            ).join('\n')
            break
        case 'titles':
            content = images.map((img, index) => 
                `## ${index + 1}. ${img.name}\n\n${img.aiResult || '暂无识别结果'}`
            ).join('\n\n')
            break
        case 'markdown':
            content = images.map((img, index) => 
                `### 图片 ${index + 1}: ${img.name}\n\n${img.aiResult || '暂无识别结果'}`
            ).join('\n\n')
            break
        case 'clean':
            content = images.map(img => (img.aiResult || '').replace(/\s+/g, ' ').trim()).join(' ')
            break
        default:
            content = images.map(img => img.aiResult || '').join('\n\n')
    }
    
    return content
}

function exportDocumentWithImages(images: ImageItem[], format: 'word' | 'wordx' | 'markdown' | 'txt' | 'html' | 'json', timestamp: Date, preset: string = 'plain', customName: string = '') {
    isExporting.value = true
    
    try {
        let content = ''
        let filename = ''
        let mimeType = ''
        
        const baseName = customName || `vision_to_doc_${Date.now()}`
        
        const presetContent = applyExportPreset(images, preset)
        
        if (format === 'markdown') {
            content = `# ${baseName}\n\n`
            content += `> 导出时间: ${formatDate(timestamp)}\n`
            content += `> 图片数量: ${images.length}\n`
            content += `> 导出预设: ${exportPresets.find(p => p.value === preset)?.label || '默认'}\n\n`
            content += `---\n\n`
            content += presetContent
            filename = `${baseName}.md`
            mimeType = 'text/markdown'
        } else if (format === 'txt') {
            content = `${baseName}\n`
            content += `${'='.repeat(40)}\n\n`
            content += `导出时间: ${formatDate(timestamp)}\n`
            content += `图片数量: ${images.length}\n`
            content += `导出预设: ${exportPresets.find(p => p.value === preset)?.label || '默认'}\n\n`
            content += `${'='.repeat(40)}\n\n`
            content += presetContent
            filename = `${baseName}.txt`
            mimeType = 'text/plain'
        } else if (format === 'word' || format === 'wordx') {
            content = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${baseName}</title>
<style>
body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
h2 { color: #555; margin-top: 30px; }
.meta { color: #666; font-size: 14px; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
img { max-width: 100%; height: auto; margin: 10px 0; }
.content-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; }
.preset-content { white-space: pre-wrap; }
</style>
</head>
<body>
<h1>📷 ${baseName}</h1>
<div class="meta">
<p><strong>导出时间:</strong> ${formatDate(timestamp)}</p>
<p><strong>图片数量:</strong> ${images.length}</p>
<p><strong>导出预设:</strong> ${exportPresets.find(p => p.value === preset)?.label || '默认'}</p>
</div>
<hr>
<div class="preset-content">${presetContent.replace(/\n/g, '<br>')}</div>
</body></html>`
            filename = `${baseName}.${format === 'wordx' ? 'docx' : 'doc'}`
            mimeType = format === 'wordx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword'
        } else if (format === 'html') {
            content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${baseName}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; background: #fff; padding: 2rem; }
.container { max-width: 900px; margin: 0 auto; }
.header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #667eea; }
.header h1 { color: #333; font-size: 1.8rem; }
.meta { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }
.content { white-space: pre-wrap; background: #f8fafc; padding: 1.5rem; border-radius: 8px; margin-top: 1rem; }
.footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #999; font-size: 0.8rem; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>📷 ${baseName}</h1>
<div class="meta">
<span>导出时间: ${formatDate(timestamp)}</span> | 
<span>图片数量: ${images.length}</span> | 
<span>预设: ${exportPresets.find(p => p.value === preset)?.label || '默认'}</span>
</div>
</div>
<div class="content">${presetContent.replace(/\n/g, '<br>')}</div>
<div class="footer">导出自视觉转文档工具</div>
</div>
</body></html>`
            filename = `${baseName}.html`
            mimeType = 'text/html'
        } else if (format === 'json') {
            const jsonData = {
                title: baseName,
                exportTime: timestamp.toISOString(),
                imageCount: images.length,
                preset: exportPresets.find(p => p.value === preset)?.label || '默认',
                data: images.map(img => ({
                    filename: img.name,
                    size: img.size,
                    content: img.aiResult || ''
                }))
            }
            content = JSON.stringify(jsonData, null, 2)
            filename = `${baseName}.json`
            mimeType = 'application/json'
        }
        
        let blob: Blob
        if (format === 'word' || format === 'wordx') {
            const text = '\uFEFF' + content
            const buffer = new ArrayBuffer(text.length * 2)
            const view = new Uint16Array(buffer)
            for (let i = 0; i < text.length; i++) {
                view[i] = text.charCodeAt(i)
            }
            blob = new Blob([buffer], { type: mimeType })
        } else {
            blob = new Blob([content], { type: mimeType + ';charset=utf-8' })
        }
        downloadFile(blob, filename)
        
    } catch (error) {
        console.error('导出失败:', error)
        alert('导出失败，请稍后重试')
    } finally {
        isExporting.value = false
    }
}

async function deleteBatchRecord(batchId: string) {
    if (!confirm('确定要删除这条记录吗？')) {
        return
    }
    
    const recordIndex = batchRecords.value.findIndex(b => b.id === batchId)
    if (recordIndex === -1) {
        return
    }
    
    const record = batchRecords.value[recordIndex]
    if (!record) {
        return
    }
    
    console.log('删除记录:', record)
    console.log('orcId:', record.orcId)
    
    try {
        if (record.orcId) {
            const url = `/delete/visual_data?orc_id=${encodeURIComponent(record.orcId)}`
            console.log('请求URL:', url)
            
            const response = await fetch(url, {
                method: 'DELETE'
            })
            
            console.log('响应状态:', response.status)
            
            if (!response.ok) {
                throw new Error(`删除失败，状态码: ${response.status}`)
            }
            
            const result = await response.json()
            console.log('响应数据:', result)
            
            if (result.code !== 200) {
                throw new Error(result.msg || '删除失败')
            }
        }
        
        batchRecords.value.splice(recordIndex, 1)
        delete batchExportFormat.value[batchId]
        delete batchExportPreset.value[batchId]
        delete batchExportName.value[batchId]
        
        alert('删除成功')
    } catch (error) {
        console.error('删除失败:', error)
        alert((error as Error).message || '删除失败，请稍后重试')
    }
}

function toggleSelectAll() {
    isSelectAll.value = !isSelectAll.value
    if (isSelectAll.value) {
        selectedBatchIds.value = batchRecords.value.map(b => b.id)
    } else {
        selectedBatchIds.value = []
    }
}

function toggleSelect(batchId: string) {
    const index = selectedBatchIds.value.indexOf(batchId)
    if (index === -1) {
        selectedBatchIds.value.push(batchId)
    } else {
        selectedBatchIds.value.splice(index, 1)
    }
    isSelectAll.value = selectedBatchIds.value.length === batchRecords.value.length && batchRecords.value.length > 0
}

function batchDelete() {
    if (selectedBatchIds.value.length === 0) {
        alert('请先选择要删除的记录')
        return
    }
    
    if (!confirm(`确定要删除选中的 ${selectedBatchIds.value.length} 条记录吗？`)) {
        return
    }
    
    selectedBatchIds.value.forEach(async (batchId) => {
        const recordIndex = batchRecords.value.findIndex(b => b.id === batchId)
        if (recordIndex !== -1) {
            const record = batchRecords.value[recordIndex]
            if (record && record.orcId) {
                try {
                    const url = `/delete/visual_data?orc_id=${encodeURIComponent(record.orcId)}`
                    await fetch(url, { method: 'DELETE' })
                } catch (error) {
                    console.error('删除记录失败:', error)
                }
            }
            batchRecords.value.splice(recordIndex, 1)
            delete batchExportFormat.value[batchId]
            delete batchExportPreset.value[batchId]
            delete batchExportName.value[batchId]
        }
    })
    
    selectedBatchIds.value = []
    isSelectAll.value = false
    alert('批量删除成功')
}

const exportFormats = [
    { value: 'markdown', label: '📝 Markdown', ext: '.md', mimeType: 'text/markdown' },
    { value: 'txt', label: '📃 TXT', ext: '.txt', mimeType: 'text/plain' },
    { value: 'word', label: '📄 Word', ext: '.doc', mimeType: 'application/msword' },
    { value: 'html', label: '🌐 HTML', ext: '.html', mimeType: 'text/html' },
    { value: 'json', label: '📋 JSON', ext: '.json', mimeType: 'application/json' }
]

function batchExport() {
    if (selectedBatchIds.value.length === 0) {
        alert('请先选择要导出的记录')
        return
    }
    
    const format = exportFormat.value
    const preset = 'plain'
    const timestamp = new Date()
    
    const allImages: ImageItem[] = []
    selectedBatchIds.value.forEach(batchId => {
        const batch = batchRecords.value.find(b => b.id === batchId)
        if (batch) {
            allImages.push(...batch.images)
        }
    })
    
    const baseName = `批量导出_${formatDate(timestamp)}`
    exportDocumentWithImages(allImages, format, timestamp, preset, baseName)
    
    selectedBatchIds.value = []
    isSelectAll.value = false
}

function exportToExcel(images: ImageItem[], filename: string) {
    let content = '数据来源,文件名,文件大小,识别内容\n'
    
    images.forEach(img => {
        const escapedContent = (img.aiResult || '').replace(/"/g, '""').replace(/\n/g, ' ')
        content += `"视觉转文档","${img.name}","${formatFileSize(img.size)}","${escapedContent}"\n`
    })
    
    const blob = new Blob([`\uFEFF${content}`], { type: 'application/vnd.ms-excel' })
    downloadFile(blob, `${filename}.xlsx`)
}

function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
</script>

<template>
    <div class="vision-to-doc">
        <div class="vision-header">
            <div class="header-content">
                <h1>📷 视觉转文档</h1>
                <p class="subtitle">上传图片进行AI识别，编辑结果后导出为Word、Markdown或TXT格式</p>
            </div>
            <div class="header-actions">
                <button class="btn-clear" @click="clearAllImages" :disabled="!hasImages">
                    🗑️ 清空全部
                </button>
            </div>
        </div>

        <div class="vision-content">
            <div class="upload-section">
                <div 
                    class="upload-area"
                    :class="{ dragging: isDragging }"
                    @drop="handleDrop"
                    @dragover="handleDragOver"
                    @dragleave="handleDragLeave"
                    @click="triggerFileUpload"
                >
                    <input 
                        ref="fileInputRef"
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        class="hidden-input"
                        @change="handleFileSelect"
                    >
                    <div class="upload-icon">📤</div>
                    <div class="upload-text">
                        <p class="upload-title">点击或拖拽上传图片</p>
                        <p class="upload-hint">支持 JPG、PNG、GIF、WebP 格式，单张不超过 5MB</p>
                    </div>
                </div>
            </div>

            <div v-if="hasImages" class="image-section">
                <div class="section-header">
                    <h3>📋 待识别图片 <span class="count">({{ imageList.length }}张)</span></h3>
                    <p class="section-hint">拖拽图片可调整顺序</p>
                </div>
                
                <div class="image-grid">
                    <div 
                        v-for="(image, index) in imageList" 
                        :key="image.id"
                        class="image-card"
                        :class="{ 
                            'drag-over': dropTargetIndex === index,
                            'dragging': draggedIndex === index
                        }"
                        draggable="true"
                        @dragstart="handleImageDragStart(index)"
                        @dragover="handleImageDragOver($event, index)"
                        @drop="handleImageDrop($event, index)"
                        @dragend="handleImageDragEnd"
                    >
                        <div class="card-order">
                            <span class="order-number">{{ index + 1 }}</span>
                        </div>
                        <div class="card-preview">
                            <img :src="image.preview" :alt="image.name" />
                        </div>
                        <div class="card-info">
                            <p class="card-name" :title="image.name">{{ image.name }}</p>
                            <p class="card-size">{{ formatFileSize(image.size) }}</p>
                        </div>
                        <div class="card-actions">
                            <button 
                                class="action-btn move-btn" 
                                @click="moveImage(index, 'up')"
                                :disabled="index === 0"
                                title="上移"
                            >
                                ↑
                            </button>
                            <button 
                                class="action-btn move-btn" 
                                @click="moveImage(index, 'down')"
                                :disabled="index === imageList.length - 1"
                                title="下移"
                            >
                                ↓
                            </button>
                            <button 
                                class="action-btn delete-btn" 
                                @click="removeImage(index)"
                                title="删除"
                            >
                                ✕
                            </button>
                        </div>
                        <div class="drag-handle" title="拖拽排序">⋮⋮</div>
                    </div>
                </div>
            </div>

            <div v-if="hasImages" class="action-section">
                <div class="action-card">
                    <div class="action-header">
                        <h3>⚡ 操作流程</h3>
                    </div>
                    <div class="action-steps">
                        <div class="step-item">
                            <span class="step-number">1</span>
                            <span class="step-text">上传图片</span>
                        </div>
                        <span class="step-arrow">→</span>
                        <div class="step-item">
                            <span class="step-number">2</span>
                            <span class="step-text">AI识别</span>
                        </div>
                        <span class="step-arrow">→</span>
                        <div class="step-item">
                            <span class="step-number">3</span>
                            <span class="step-text">查看记录</span>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button 
                            class="btn-action btn-recognize"
                            @click="uploadAndRecognize"
                            :disabled="isExporting || showUploadModal"
                        >
                            🤖 {{ showUploadModal ? '识别中...' : '开始AI识别' }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="hasBatchRecords" class="records-section">
                <div class="section-header">
                    <h3>📁 历史识别记录 <span class="count">({{ batchRecords.length }}条)</span></h3>
                    <p class="section-hint">点击记录可编辑内容，右侧选择格式后导出</p>
                </div>
                
                <div v-if="batchRecords.length > 0" class="batch-actions-bar">
                    <label class="select-all-label">
                        <input type="checkbox" :checked="isSelectAll" @change="toggleSelectAll" />
                        <span>全选</span>
                    </label>
                    <span class="selected-count">已选 {{ selectedBatchIds.length }} 条</span>
                    <div class="batch-buttons">
                        <select v-model="exportFormat" class="batch-export-format">
                            <option value="markdown">📝 Markdown (.md)</option>
                            <option value="txt">📃 TXT (.txt)</option>
                            <option value="word">📄 Word (.doc)</option>
                            <option value="wordx">📄 Word (.docx)</option>
                            <option value="html">🌐 HTML (.html)</option>
                            <option value="json">📋 JSON (.json)</option>
                        </select>
                        <button class="btn-batch-export" @click="batchExport" :disabled="selectedBatchIds.length === 0 || isExporting">
                            📦 批量导出
                        </button>
                        <button class="btn-batch-delete" @click="batchDelete" :disabled="selectedBatchIds.length === 0">
                            🗑️ 批量删除
                        </button>
                    </div>
                </div>
                
                <div class="records-list">
                    <div 
                        v-for="(batch, batchIndex) in batchRecords" 
                        :key="batch.id"
                        class="record-card"
                        :class="{ selected: selectedBatchIds.includes(batch.id) }"
                    >
                        <div class="record-header">
                            <label class="record-select">
                                <input type="checkbox" :checked="selectedBatchIds.includes(batch.id)" @change="toggleSelect(batch.id)" />
                            </label>
                            <div class="record-info">
                                <span class="record-time">📅 {{ formatDate(batch.timestamp) }}</span>
                                <span class="record-count">📷 {{ batch.images.length }}张图片</span>
                            </div>
                            <div class="record-actions">
                                <input 
                                    type="text"
                                    :value="batchExportName[batch.id] !== undefined ? batchExportName[batch.id] : generateDefaultExportName()"
                                    @input="batchExportName[batch.id] = ($event.target as HTMLInputElement).value"
                                    class="export-name-input"
                                    placeholder="输入导出文件名"
                                    :title="batchExportName[batch.id] !== undefined ? batchExportName[batch.id] : generateDefaultExportName()"
                                />
                                <div class="export-dropdown">
                                    <select 
                                        v-model="batchExportPreset[batch.id]"
                                        class="export-preset-select"
                                    >
                                        <option v-for="preset in exportPresets" :key="preset.value" :value="preset.value">
                                            {{ preset.label }}
                                        </option>
                                    </select>
                                    <select 
                                        v-model="batchExportFormat[batch.id]"
                                        class="export-select"
                                    >
                                        <option value="markdown">📝 Markdown (.md)</option>
                                        <option value="txt">📃 TXT (.txt)</option>
                                        <option value="word">📄 Word (.doc)</option>
                                        <option value="wordx">📄 Word (.docx)</option>
                                        <option value="html">🌐 HTML (.html)</option>
                                        <option value="json">{ } JSON (.json)</option>
                                    </select>
                                    <button 
                                        class="btn-export-single"
                                        @click="exportBatchDocument(batch.id)"
                                        :disabled="isExporting"
                                    >
                                        导出
                                    </button>
                                </div>
                                <button 
                                    class="btn-delete-record"
                                    @click="deleteBatchRecord(batch.id)"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        
                        <div class="record-content">
                            <div 
                                v-for="(image, imgIndex) in batch.images" 
                                :key="image.id"
                                class="record-item"
                                @click="openEditModal(imgIndex, batchIndex)"
                            >
                                <div class="item-image" @click.stop="openImagePreview(image.preview, image.name)">
                                    <img :src="image.preview" :alt="image.name" />
                                </div>
                                <div class="item-info">
                                    <p class="item-name">{{ image.name }}</p>
                                    <p class="item-size">{{ formatFileSize(image.size) }}</p>
                                </div>
                                <div class="item-content">
                                    <p class="content-preview">{{ image.aiResult?.substring(0, 100) }}{{ image.aiResult && image.aiResult.length > 100 ? '...' : '' }}</p>
                                </div>
                                <div class="item-action">
                                    <span class="edit-hint">点击编辑</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="!hasImages" class="empty-state">
                <div class="empty-icon">🖼️</div>
                <p class="empty-text">暂无识别记录</p>
                <p class="empty-hint">请上传图片进行AI识别</p>
            </div>
        </div>

        <div v-if="showUploadModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔄 正在处理图片</h3>
                </div>
                <div class="modal-body">
                    <div class="upload-progress-bar">
                        <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
                    </div>
                    <p class="upload-message">{{ uploadMessage }}</p>
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>

        <div v-if="showEditModal" class="modal-overlay edit-modal">
            <div class="modal-content edit-content">
                <div class="modal-header">
                    <h3>✏️ 编辑AI识别结果</h3>
                    <button class="close-btn" @click="closeEditModal">✕</button>
                </div>
                <div class="modal-body edit-body">
                    <div class="image-preview-panel">
                        <div class="preview-header">
                            <span class="image-number">{{ currentEditingIndex + 1 }} / {{ editingBatchIndex >= 0 ? batchRecords[editingBatchIndex]?.images.length : imageList.length }}</span>
                            <span class="image-name">{{ editingBatchIndex >= 0 ? batchRecords[editingBatchIndex]?.images[currentEditingIndex]?.name : imageList[currentEditingIndex]?.name }}</span>
                        </div>
                        <img 
                            :src="editingBatchIndex >= 0 ? batchRecords[editingBatchIndex]?.images[currentEditingIndex]?.preview : imageList[currentEditingIndex]?.preview" 
                            :alt="editingBatchIndex >= 0 ? batchRecords[editingBatchIndex]?.images[currentEditingIndex]?.name : imageList[currentEditingIndex]?.name" 
                            @click="openImagePreview((editingBatchIndex >= 0 ? batchRecords[editingBatchIndex]?.images[currentEditingIndex]?.preview : imageList[currentEditingIndex]?.preview) || '', (editingBatchIndex >= 0 ? batchRecords[editingBatchIndex]?.images[currentEditingIndex]?.name : imageList[currentEditingIndex]?.name) || '')"
                        />
                    </div>
                    <div class="content-editor">
                        <label class="editor-label">AI识别内容</label>
                        <textarea
                            v-model="editingContent"
                            class="editor-textarea"
                            placeholder="在此编辑AI识别的内容..."
                            rows="15"
                        ></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button 
                        class="btn-nav"
                        @click="prevImage"
                        :disabled="currentEditingIndex === 0"
                    >
                        ← 上一张
                    </button>
                    <button 
                        class="btn-nav"
                        v-if="currentEditingIndex < (editingBatchIndex >= 0 ? (batchRecords[editingBatchIndex]?.images.length ?? 0) - 1 : imageList.length - 1)"
                        @click="nextImage"
                    >
                        下一张 →
                    </button>
                    <button 
                        v-else
                        class="btn-finish"
                        @click="finishEditAndExport"
                    >
                        ✅ 完成编辑
                    </button>
                </div>
            </div>
        </div>

        <div v-if="showImagePreview" class="modal-overlay image-preview-modal" @click="closeImagePreview">
            <div class="modal-content image-preview-content" @click.stop>
                <div class="modal-header">
                    <h3>🖼️ {{ previewImageName }}</h3>
                    <button class="close-btn" @click="closeImagePreview">✕</button>
                </div>
                <div class="modal-body image-preview-body">
                    <img :src="previewImageUrl" :alt="previewImageName" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.vision-to-doc {
    height: 100%;
    padding: 0.75rem;
    background: #f5f7fa;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-sizing: border-box;
}

.vision-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 1.25rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-content {
    flex: 1;
}

.vision-header h1 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.subtitle {
    color: #7f8c8d;
    font-size: 1rem;
    margin: 0;
    line-height: 1.5;
}

.header-actions {
    display: flex;
    gap: 0.75rem;
}

.btn-clear {
    padding: 0.75rem 1.25rem;
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-clear:hover:not(:disabled) {
    background: #fecaca;
}

.btn-clear:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.vision-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.upload-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 1.5rem;
}

.upload-area {
    border: 2px dashed #e2e8f0;
    border-radius: 12px;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fafbfc;
}

.upload-area:hover {
    border-color: #667eea;
    background: #f8faff;
}

.upload-area.dragging {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    transform: scale(1.01);
}

.hidden-input {
    display: none;
}

.upload-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.upload-text {
    margin: 0;
}

.upload-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #475569;
    margin: 0 0 0.5rem 0;
}

.upload-hint {
    font-size: 0.9rem;
    color: #94a3b8;
    margin: 0;
}

.image-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 1.5rem;
}

.records-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 1.5rem;
}

.section-header {
    margin-bottom: 1rem;
}

.section-header h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0 0 0.25rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.section-header .count {
    font-size: 0.9rem;
    color: #667eea;
    font-weight: 500;
}

.section-hint {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
}

.image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
}

.image-card {
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem;
    position: relative;
    transition: all 0.2s ease;
    cursor: grab;
}

.image-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.image-card.drag-over {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    transform: scale(1.02);
}

.image-card.dragging {
    opacity: 0.5;
    cursor: grabbing;
}

.card-order {
    position: absolute;
    top: -8px;
    left: -8px;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
    z-index: 1;
}

.card-preview {
    width: 100%;
    height: 120px;
    border-radius: 8px;
    overflow: hidden;
    background: #f1f5f9;
    margin-bottom: 0.75rem;
    position: relative;
}

.card-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.card-info {
    margin-bottom: 0.75rem;
}

.card-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: #374151;
    margin: 0 0 0.25rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.card-size {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0;
}

.card-actions {
    display: flex;
    gap: 0.5rem;
}

.action-btn {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.move-btn {
    color: #475569;
}

.move-btn:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #667eea;
    color: #667eea;
}

.delete-btn {
    color: #dc2626;
    border-color: #fecaca;
}

.delete-btn:hover {
    background: #fee2e2;
    border-color: #dc2626;
}

.drag-handle {
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    color: #cbd5e1;
    font-size: 1rem;
    cursor: grab;
    padding: 4px;
}

.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    min-height: 200px;
}

.empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.empty-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: #64748b;
    margin: 0 0 0.5rem 0;
}

.empty-hint {
    font-size: 0.9rem;
    color: #94a3b8;
    margin: 0;
}

.action-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 1.5rem;
}

.action-card {
    background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
    border-radius: 10px;
    padding: 1.5rem;
    border: 1px solid #667eea30;
}

.action-header {
    margin-bottom: 1rem;
}

.action-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0;
}

.action-steps {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
}

.step-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.step-number {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
}

.step-text {
    font-size: 0.9rem;
    color: #475569;
    font-weight: 500;
}

.step-arrow {
    color: #94a3b8;
    font-size: 1rem;
}

.action-buttons {
    display: flex;
    justify-content: center;
}

.btn-action {
    padding: 0.875rem 2rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-recognize {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
}

.btn-recognize:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-recognize:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.records-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.record-card {
    background: #f8fafc;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
}

.record-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
}

.record-info {
    display: flex;
    gap: 1.5rem;
}

.record-time {
    font-size: 0.9rem;
    color: #475569;
}

.record-count {
    font-size: 0.9rem;
    color: #667eea;
    font-weight: 500;
}

.record-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.export-dropdown {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.export-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.85rem;
    background: white;
    cursor: pointer;
    min-width: 120px;
}

.btn-export-single {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-export-single:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-delete-record {
    padding: 0.5rem;
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-delete-record:hover {
    background: #fecaca;
}

.record-content {
    padding: 0.75rem;
}

.record-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: white;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.record-item:hover {
    background: #f8fafc;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.record-item:last-child {
    margin-bottom: 0;
}

.item-image {
    width: 60px;
    height: 60px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    cursor: zoom-in;
}

.item-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.item-info {
    flex-shrink: 0;
    min-width: 120px;
}

.item-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: #374151;
    margin: 0 0 0.25rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-size {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
}

.item-content {
    flex: 1;
    min-width: 0;
}

.content-preview {
    font-size: 0.85rem;
    color: #475569;
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.item-action {
    flex-shrink: 0;
}

.edit-hint {
    font-size: 0.8rem;
    color: #667eea;
    padding: 0.375rem 0.75rem;
    background: rgba(102, 126, 234, 0.1);
    border-radius: 4px;
}

.modal-overlay {
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

.modal-content {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.modal-header h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
    padding: 0.25rem;
    border-radius: 6px;
    transition: background 0.2s;
}

.close-btn:hover {
    background: #f1f5f9;
}

.modal-body {
    text-align: center;
}

.upload-progress-bar {
    width: 100%;
    height: 10px;
    background: #e2e8f0;
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 1rem;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transition: width 0.3s ease;
}

.upload-message {
    font-size: 0.95rem;
    color: #475569;
    margin-bottom: 1.5rem;
}

.loading-spinner {
    display: inline-block;
    width: 30px;
    height: 30px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.edit-modal {
    align-items: flex-start;
    padding-top: 5%;
}

.edit-content {
    max-width: 95%;
    max-height: 90vh;
    width: 1400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.edit-body {
    display: flex;
    gap: 2rem;
    flex: 1;
    overflow-y: auto;
    min-height: 500px;
}

.image-preview-panel {
    flex-shrink: 0;
    width: 400px;
}

.preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
}

.image-number {
    font-size: 0.85rem;
    color: #667eea;
    font-weight: 600;
}

.image-name {
    font-size: 0.85rem;
    color: #64748b;
}

.image-preview-panel img {
    width: 100%;
    max-height: 500px;
    object-fit: contain;
    border-radius: 8px;
    background: #f8fafc;
    cursor: zoom-in;
}

.content-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.editor-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.5rem;
}

.editor-textarea {
    flex: 1;
    min-height: 300px;
    padding: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.95rem;
    font-family: inherit;
    resize: vertical;
    line-height: 1.6;
    transition: border-color 0.2s;
}

.editor-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.modal-footer {
    display: flex;
    justify-content: center;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
    margin-top: 1rem;
}

.btn-nav {
    padding: 0.75rem 1.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-nav:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #667eea;
    color: #667eea;
}

.btn-nav:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.btn-finish {
    padding: 0.75rem 2rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-finish:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.image-preview-modal {
    align-items: center;
}

.image-preview-content {
    max-width: 90%;
    max-height: 90vh;
    padding: 1rem;
}

.image-preview-body {
    display: flex;
    justify-content: center;
    align-items: center;
    max-height: 70vh;
    overflow: auto;
}

.image-preview-body img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
}

.export-name-input {
    flex: 1;
    min-width: 180px;
    max-width: 250px;
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 13px;
    background: white;
    outline: none;
    transition: border-color 0.2s;
}

.export-name-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.export-name-input::placeholder {
    color: #94a3b8;
}

.export-preset-select {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 13px;
    background: white;
    outline: none;
    cursor: pointer;
    min-width: 120px;
    transition: border-color 0.2s;
}

.export-preset-select:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.record-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.batch-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: #f8fafc;
    border-radius: 8px;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.select-all-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    color: #475569;
}

.select-all-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.selected-count {
    font-size: 0.85rem;
    color: #64748b;
}

.batch-buttons {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.batch-export-format {
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.85rem;
    background: white;
    cursor: pointer;
    min-width: 120px;
}

.btn-batch-export,
.btn-batch-delete {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-batch-export {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-batch-export:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-batch-delete {
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
}

.btn-batch-delete:hover:not(:disabled) {
    background: #fecaca;
}

.btn-batch-export:disabled,
.btn-batch-delete:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.record-card.selected {
    border: 2px solid #667eea;
    background: #f0f5ff;
}

.record-select {
    margin-right: 0.75rem;
    cursor: pointer;
}

.record-select input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
}
</style>