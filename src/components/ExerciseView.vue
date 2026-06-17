<template>
  <div class="exercise-container">
    <div class="exercise-header">
      <h2>📝 题目作答练习</h2>
      <p class="subtitle">选择题目开始练习，系统将自动评分并提供详细解析</p>
    </div>

    <div class="exercise-content">
      <div class="exercise-info">
        <div class="info-card">
          <div class="info-icon">📚</div>
          <div class="info-text">
            <h3>题库练习</h3>
            <p>从题库中随机抽取题目进行练习</p>
          </div>
        </div>

        <div class="info-card">
          <div class="info-icon">🎯</div>
          <div class="info-text">
            <h3>即时反馈</h3>
            <p>提交后立即显示正确答案和详细解析</p>
          </div>
        </div>

        <div class="info-card">
          <div class="info-icon">📊</div>
          <div class="info-text">
            <h3>学习统计</h3>
            <p>记录您的练习历史和正确率</p>
          </div>
        </div>
      </div>

      <div class="exercise-section">
        <h3>开始练习</h3>
        <div class="action-buttons">
          <button class="btn-primary" @click="startExercise('full')">
            📚 全量练习
          </button>
          <button class="btn-secondary" @click="openRandomExerciseModal">
            🎲 随机练习
          </button>
          <button class="btn-secondary" @click="startExercise('chapter')">
            📖 背题训练
          </button>
          <button class="btn-secondary" @click="startExercise('mistake')">
            📝 错题重做
          </button>
        </div>
      </div>

      <div class="exercise-section">
        <h3>选择文档</h3>
        <p class="section-desc">选择文档后，练习题目将基于该文档内容生成</p>
        <div class="document-select">
          <div class="dropdown-container">
            <button class="document-select-btn" @click="toggleDocumentDropdown">
              📄 {{ selectedDocument ? selectedDocument.name.slice(0, 8) + '...' : '请选择文档' }} ▼
            </button>
            <div v-if="showDocumentDropdown" class="dropdown-menu">
              <div class="dropdown-header">
                共 {{ documentList.length }} 个文档
              </div>
              <div v-for="doc in documentList" :key="doc.id" class="dropdown-item" @click="handleSelectDocument(doc)">
                <span class="file-icon">{{ getFileIcon(doc.type) }}</span>
                <span class="file-name" :title="doc.name">{{ doc.name }}</span>
              </div>
              <div v-if="documentList.length === 0" class="dropdown-empty">
                暂无文档，请先上传
              </div>
            </div>
          </div>
          <div v-if="selectedDocument" class="selected-doc-info">
            <span>已选择：{{ selectedDocument.name }}</span>
            <button class="clear-btn" @click="clearDocument">✕</button>
          </div>
        </div>
      </div>

      <RecentExercises />
    </div>

    <!-- 加载中模态框 -->
    <LoadingModal
      :visible="isLoading"
      :message="loadingMessage"
      @cancel="cancelLoading"
    />

    <!-- 错题为空白态框 -->
    <div v-if="showNoMistakeModal" class="no-mistake-modal-overlay" @click.self="showNoMistakeModal = false">
      <div class="no-mistake-modal">
        <div class="modal-header">
          <h3>📭 暂无错题</h3>
          <button class="close-btn" @click="showNoMistakeModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="no-mistake-icon">📚</div>
          <p class="no-mistake-message">
            <strong>{{ noMistakeFileName }}</strong>
          </p>
          <p class="no-mistake-hint">
            暂无错题可练习，<br>
            建议先进行全量练习或随机练习
          </p>
          <button class="btn-primary" @click="showNoMistakeModal = false">
            我知道了
          </button>
        </div>
      </div>
    </div>

    <!-- 随机练习题目数量选择模态框 -->
    <div v-if="showRandomExerciseModal" class="random-exercise-modal-overlay" @click.self="showRandomExerciseModal = false">
      <div class="random-exercise-modal">
        <div class="modal-header">
          <h3>🎲 随机练习</h3>
          <button class="close-btn" @click="showRandomExerciseModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="isLoadingQuestionBank" class="loading-state">
            <div class="loading-spinner"></div>
            <p>正在加载题库信息...</p>
          </div>

          <div v-else-if="randomExerciseError" class="error-state">
            <p class="error-text">{{ randomExerciseError }}</p>
            <button class="retry-btn" @click="openRandomExerciseModal">重新加载</button>
          </div>

          <div v-else class="form-container">
            <div class="info-row">
              <span class="info-label">题库总数：</span>
              <span class="info-value">{{ totalQuestionCount }} 题</span>
            </div>

            <div class="input-group">
              <label for="question-count">题目数量：</label>
              <input
                id="question-count"
                type="number"
                v-model.number="randomQuestionCount"
                :min="Math.max(1, Math.floor(totalQuestionCount * 0.2))"
                :max="totalQuestionCount"
                placeholder="请输入题目数量"
              />
            </div>

            <div class="hint-text">
              ⚠️ 最少选择：<span class="highlight">{{ Math.max(1, Math.floor(totalQuestionCount * 0.2)) }} 题</span>（20%）
            </div>

            <div class="hint-text">
              📊 当前选择：<span class="highlight">{{ randomQuestionCount }} 题</span>（{{ totalQuestionCount > 0 ? Math.round((randomQuestionCount / totalQuestionCount) * 100) : 0 }}%）
            </div>
          </div>
        </div>

        <div class="modal-footer" v-if="!isLoadingQuestionBank && !randomExerciseError">
          <button class="btn-cancel" @click="showRandomExerciseModal = false">取消</button>
          <button
            class="btn-confirm"
            @click="confirmRandomExercise"
            :disabled="randomQuestionCount < Math.max(1, Math.floor(totalQuestionCount * 0.2)) || randomQuestionCount > totalQuestionCount"
          >
            开始练习
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LoadingModal from './LoadingModal.vue'
import RecentExercises from './RecentExercises.vue'
import { getQuestionBank } from '../api/chat'

const router = useRouter()
const exerciseType = ref('')
const showDocumentDropdown = ref(false)
const isLoading = ref(false)
const loadingMessage = ref('文件正在请求中，请稍后...')

// 随机练习模态框相关
const showRandomExerciseModal = ref(false)
const randomQuestionCount = ref(0)
const totalQuestionCount = ref(0)
const isLoadingQuestionBank = ref(false)
const randomExerciseError = ref('')

// 错题为空提示模态框相关
const showNoMistakeModal = ref(false)
const noMistakeFileName = ref('')

// 从父组件注入共享的文档选择状态
const selectedDocument = inject<any>('selectedDocument')
const documentList = inject<any>('documentList')
const selectDocument = inject<any>('selectDocument')

interface Document {
  id: string
  name: string
  type: string
  uploadTime: string
}

interface QuestionItem {
  id: number
  file_name: string
  topic_type: string
  topic_index: number
  topic: string
  choose?: {
    [key: string]: string
  }
  answer: string | string[]
  explain: string
}

function getFileIcon(type: string): string {
  const fileType = type.toLowerCase()
  if (fileType.includes('pdf')) return '📕'
  if (fileType.includes('doc') || fileType.includes('word')) return '📘'
  if (fileType.includes('xls') || fileType.includes('excel')) return '📗'
  if (fileType.includes('txt')) return '📄'
  return '📁'
}

function toggleDocumentDropdown() {
  showDocumentDropdown.value = !showDocumentDropdown.value
}

function handleSelectDocument(doc: any) {
  // 调用父组件的 selectDocument
  if (selectDocument) {
    selectDocument(doc)
  }
  // 关闭自己的下拉菜单
  showDocumentDropdown.value = false
}

function clearDocument() {
  if (selectedDocument) {
    selectedDocument.value = null
  }
}

// 打开随机练习模态框
async function openRandomExerciseModal() {
  if (!selectedDocument || !selectedDocument.value) {
    alert('请先选择文档')
    return
  }

  showRandomExerciseModal.value = true
  isLoadingQuestionBank.value = true
  randomExerciseError.value = ''

  try {
    // 预请求获取全部题目数量
    const response = await getQuestionBank(selectedDocument.value.name, 'all')

    if (response.code === 200) {
      totalQuestionCount.value = response.data.length

      // 默认填入 60% 的题目数量
      const defaultCount = Math.floor(totalQuestionCount.value * 0.6)
      randomQuestionCount.value = Math.max(defaultCount, 1)
    } else {
      randomExerciseError.value = '获取题库失败：' + response.msg
    }
  } catch (error) {
    console.error('❌ 预请求失败:', error)
    randomExerciseError.value = '请求失败，请检查网络连接'
  } finally {
    isLoadingQuestionBank.value = false
  }
}

// 确认随机练习
async function confirmRandomExercise() {
  // 验证：最少不低于 20%
  const minCount = Math.max(1, Math.floor(totalQuestionCount.value * 0.2))

  if (randomQuestionCount.value < minCount) {
    alert(`题目数量不能少于 ${minCount} 题（${Math.round((minCount / totalQuestionCount.value) * 100)}%）`)
    return
  }

  if (randomQuestionCount.value > totalQuestionCount.value) {
    alert(`题目数量不能超过题库总数 ${totalQuestionCount.value} 题`)
    return
  }

  // 关闭模态框，调用随机练习
  showRandomExerciseModal.value = false
  startRandomExercise(randomQuestionCount.value.toString())
}

// 开始随机练习（带具体数量）
async function startRandomExercise(topicNum: string) {
  if (!selectedDocument || !selectedDocument.value) {
    alert('请先选择文档')
    return
  }

  isLoading.value = true
  loadingMessage.value = `正在从 "${selectedDocument.value.name}" 随机抽取 ${topicNum} 题...`

  try {
    const response = await getQuestionBank(selectedDocument.value.name, topicNum)

    if (response.code === 200) {
      const questions: QuestionItem[] = response.data
      console.log('✅ 题库数据加载成功，共', questions.length, '道题目')

      const params: Record<string, string> = {
        type: 'random',
        data: JSON.stringify(questions)
      }

      router.push({
        path: '/practice',
        query: params
      })
    } else {
      alert('获取题库失败：' + response.msg)
    }
  } catch (error) {
    console.error('❌ 请求失败:', error)
    alert('请求失败，请检查网络连接或后端服务是否正常')
  } finally {
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  }
}

function cancelLoading() {
  isLoading.value = false
}

async function startExercise(type: string) {
  exerciseType.value = type

  if (!selectedDocument || !selectedDocument.value) {
    alert('请先选择文档')
    return
  }

  let topicNum = 'all'
  let message = '加载题目'

  if (type === 'full') {
    topicNum = 'all'
    message = `正在从 "${selectedDocument.value.name}" 加载全部题目...`
  } else if (type === 'random') {
    // 随机练习默认10题，可根据需要修改
    topicNum = '10'
    message = `正在从 "${selectedDocument.value.name}" 随机抽取题目...`
  } else if (type === 'mistake') {
    // 错题重做
    topicNum = 'false_topic'
    message = '正在加载错题集...'
  } else if (type === 'chapter') {
    // 按章节练习（暂时先全量）
    topicNum = 'all'
    message = `正在从 "${selectedDocument.value.name}" 加载题目...`
  }

  isLoading.value = true
  loadingMessage.value = message

  try {
    // 调用题库接口
    const response = await getQuestionBank(selectedDocument.value.name, topicNum)

    if (response.code === 200) {
      let questions: QuestionItem[] = []

      // 处理错题重做的数据格式
      if (type === 'mistake' && Array.isArray(response.data)) {
        // 错题数据格式是 [{file_name, data: [...]}, ...]
        const mistakeData = response.data as unknown as Array<{file_name: string, data: QuestionItem[]}>
        
        // 根据选择的文件过滤错题，并合并相同 file_name 的数据
        const selectedFileName = selectedDocument.value.name
        
        // 找出所有 file_name 匹配的项并合并 data
        const matchedItems = mistakeData.filter(item => item.file_name === selectedFileName)
        
        if (matchedItems.length > 0) {
          // 合并所有匹配项的 data 数组
          questions = matchedItems.flatMap(item =>
            item.data.map(q => ({
              ...q,
              file_name: item.file_name
            }))
          )
        } else {
          // 如果没有找到匹配的文件或文件没有错题
          isLoading.value = false
          noMistakeFileName.value = selectedDocument.value.name
          showNoMistakeModal.value = true
          return
        }
      } else {
        // 普通题库数据格式
        questions = response.data as QuestionItem[]
      }

      console.log('✅ 题库数据加载成功，共', questions.length, '道题目')

      if (questions.length === 0) {
        isLoading.value = false
        if (type === 'mistake') {
          noMistakeFileName.value = selectedDocument.value.name
          showNoMistakeModal.value = true
        } else {
          alert('暂无题目可练习')
        }
        return
      }

      // 将题目数据转换为查询参数字符串
      const params: Record<string, string> = {
        type: type,
        data: JSON.stringify(questions)
      }

      // 跳转到对应的页面
      if (type === 'chapter') {
        // 背题训练跳转到复习页面
        router.push({
          path: '/review',
          query: params
        })
      } else {
        // 其他类型跳转到练习页面
        router.push({
          path: '/practice',
          query: params
        })
      }
    } else {
      alert('获取题库失败：' + response.msg)
      console.error('❌ 获取题库失败:', response.msg)
    }
  } catch (error) {
    console.error('❌ 请求失败:', error)
    alert('请求失败，请检查网络连接或后端服务是否正常')
  } finally {
    // 延迟关闭加载模态框，让用户看到成功提示
    setTimeout(() => {
      isLoading.value = false
    }, 500)
  }
}

onMounted(() => {
  console.log('ExerciseView mounted, selectedDocument:', selectedDocument?.value)
})
</script>

<style scoped>
.exercise-container {
  height: 100%;
  padding: 0.75rem;
  background: #f5f7fa;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-sizing: border-box;
}

.exercise-header {
  background: white;
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.exercise-header h2 {
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

.exercise-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.exercise-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.info-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.info-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.info-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.info-text h3 {
  font-size: 1.1rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.info-text p {
  color: #7f8c8d;
  font-size: 0.9rem;
  line-height: 1.5;
}

.exercise-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.recent-exercise {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.exercise-section h3,
.recent-exercise h3 {
  font-size: 1.3rem;
  color: #2c3e50;
  margin-bottom: 0.75rem;
}

.section-desc {
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.btn-primary,
.btn-secondary {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: #667eea;
  color: white;
  transform: translateY(-2px);
}

/* 文档选择样式 */
.document-select {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.dropdown-container {
  position: relative;
}

.document-select-btn {
  padding: 0.75rem 1.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 200px;
  text-align: left;
}

.document-select-btn:hover {
  background: #f1f5f9;
  border-color: #667eea;
  color: #667eea;
}

.dropdown-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
}

.dropdown-header {
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.dropdown-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dropdown-item:hover {
  background: #f1f5f9;
}

.file-icon {
  font-size: 1.25rem;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #334155;
}

.dropdown-empty {
  padding: 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
}

.selected-doc-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  color: #166534;
  font-size: 0.9rem;
}

.clear-btn {
  background: transparent;
  border: none;
  color: #166534;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
}

.clear-btn:hover {
  color: #dc2626;
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #95a5a6;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.empty-hint {
  font-size: 0.9rem;
  color: #bdc3c7;
}

/* 错题为空白态框 */
.no-mistake-modal-overlay {
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

.no-mistake-modal {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  padding: 2rem;
  min-width: 400px;
  max-width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  position: relative;
  animation: modalPop 0.3s ease-out;
  text-align: center;
}

.no-mistake-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.no-mistake-message {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 0.5rem;
  word-break: break-word;
}

.no-mistake-hint {
  font-size: 1rem;
  color: #94a3b8;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

/* 随机练习模态框 */
.random-exercise-modal-overlay {
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

.random-exercise-modal {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 16px;
  padding: 2rem;
  min-width: 420px;
  max-width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
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

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 1.4rem;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  padding: 0.25rem;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: #334155;
}

.modal-body {
  margin-bottom: 1.5rem;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 2rem 1rem;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p,
.error-text {
  color: #64748b;
  font-size: 1rem;
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.6rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #5a67d8;
}

.form-container {
  padding: 0.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.info-label {
  font-weight: 500;
  color: #475569;
}

.info-value {
  font-weight: 600;
  color: #667eea;
  font-size: 1.1rem;
}

.input-group {
  margin-bottom: 1rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #334155;
}

.input-group input {
  width: 100%;
  padding: 0.8rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.input-group input:focus {
  outline: none;
  border-color: #667eea;
}

.hint-text {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #fef3c7;
  border-radius: 6px;
}

.hint-text .highlight {
  font-weight: 600;
  color: #92400e;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.btn-cancel,
.btn-confirm {
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-weight: 500;
}

.btn-cancel {
  background: #e2e8f0;
  color: #475569;
}

.btn-cancel:hover {
  background: #cbd5e1;
}

.btn-confirm {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-confirm:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
