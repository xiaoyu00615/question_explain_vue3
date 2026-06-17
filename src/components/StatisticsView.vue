<script setup lang="ts">
import { ref, computed, onMounted, inject, watch, type Ref } from 'vue'
import {
    TrendChart,
    PieChart,
    BarChart,
    RadarChart,
    ScoreDistChart,
    ComparisonChart,
    EfficiencyChart
} from './charts'

interface Document {
    id: string
    name: string
    type: string
    uploadTime: string
}

interface QuestionAnalysis {
    type: string
    total: number
    correct: number
    rate: number
}

interface ExerciseRecord {
    id: string
    date: string
    totalQuestions: number
    correctCount: number
    wrongCount: number
    totalScore: number
    duration: number
    fileName: string
    questionTypes?: {
        单选题?: { total: number; correct: number }
        多选题?: { total: number; correct: number }
        判断题?: { total: number; correct: number }
        填空题?: { total: number; correct: number }
        简答题?: { total: number; correct: number }
    }
}

// 后端返回的数据结构
interface BackendExerciseRecord {
    id: string
    topic_true_num: number
    totalQuestions: number
    topic_false_num: number
    topic_null_num: number
    answer_total_time: number
    accuracy_raet: number
    average_answer_time: number
    test_type: string
    createTime: string
    total_score: number
    file_name: string
    ai_evaluation?: string
}

interface WeaknessAnalysis {
    type: string
    wrongCount: number
    wrongRate: number
    trend: 'up' | 'down' | 'stable'
}

interface EfficiencyMetric {
    date: string
    score: number
    duration: number
    efficiency: number
}

const documentList = inject<Ref<Document[]>>('documentList', ref([]))
const selectedFile = ref<string>('all')
const activeTab = ref<string>('overview')
const isLoading = ref(true)
const exerciseRecords = ref<ExerciseRecord[]>([])

const filteredRecords = computed(() => {
    if (selectedFile.value === 'all') {
        return exerciseRecords.value
    }
    return exerciseRecords.value.filter(record => record.fileName === selectedFile.value)
})

const stats = computed(() => {
    const records = filteredRecords.value
    if (records.length === 0) {
        return {
            totalExercises: 0, totalQuestions: 0, averageScore: 0,
            averageDuration: 0, correctRate: 0, bestScore: 0, worstScore: 0,
            totalCorrect: 0, totalWrong: 0, improvement: 0
        }
    }

    const totalExercises = records.length
    const totalQuestions = records.reduce((sum, r) => sum + r.totalQuestions, 0)
    const totalScore = records.reduce((sum, r) => sum + r.totalScore, 0)
    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0)
    const totalCorrect = records.reduce((sum, r) => sum + r.correctCount, 0)
    const totalWrong = records.reduce((sum, r) => sum + r.wrongCount, 0)
    const scores = records.map(r => r.totalScore)

    const firstHalf = records.slice(0, Math.floor(records.length / 2))
    const secondHalf = records.slice(Math.floor(records.length / 2))
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, r) => sum + r.totalScore, 0) / firstHalf.length : 0
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, r) => sum + r.totalScore, 0) / secondHalf.length : 0
    const improvement = firstHalfAvg > 0 ? Math.round((secondHalfAvg - firstHalfAvg) * 10) / 10 : 0

    return {
        totalExercises, totalQuestions,
        averageScore: Math.round(totalScore / totalExercises * 10) / 10,
        averageDuration: Math.round(totalDuration / totalExercises),
        correctRate: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        bestScore: Math.max(...scores), worstScore: Math.min(...scores),
        totalCorrect, totalWrong, improvement
    }
})

const questionTypeAnalysis = computed<QuestionAnalysis[]>(() => {
    const records = filteredRecords.value
    const typeStats: { [key: string]: { total: number; correct: number } } = {}

    records.forEach(record => {
        if (record.questionTypes) {
            Object.entries(record.questionTypes).forEach(([type, data]) => {
                if (!typeStats[type]) typeStats[type] = { total: 0, correct: 0 }
                typeStats[type].total += data.total
                typeStats[type].correct += data.correct
            })
        }
    })

    if (Object.keys(typeStats).length === 0) {
        return [
            { type: '单选题', total: 120, correct: 95, rate: 79 },
            { type: '多选题', total: 80, correct: 52, rate: 65 },
            { type: '判断题', total: 100, correct: 82, rate: 82 },
            { type: '填空题', total: 45, correct: 31, rate: 69 },
            { type: '简答题', total: 30, correct: 18, rate: 60 }
        ]
    }

    return Object.entries(typeStats).map(([type, data]) => ({
        type, total: data.total, correct: data.correct,
        rate: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
    }))
})

const scoreDistribution = computed(() => {
    const records = filteredRecords.value
    const distribution: { [key: string]: number } = {
        '0-20分': 0, '21-40分': 0, '41-60分': 0, '61-80分': 0, '81-100分': 0
    }

    records.forEach(record => {
        const score = record.totalScore ?? 0
        if (score <= 20) distribution['0-20分'] = (distribution['0-20分'] || 0) + 1
        else if (score <= 40) distribution['21-40分'] = (distribution['21-40分'] || 0) + 1
        else if (score <= 60) distribution['41-60分'] = (distribution['41-60分'] || 0) + 1
        else if (score <= 80) distribution['61-80分'] = (distribution['61-80分'] || 0) + 1
        else distribution['81-100分'] = (distribution['81-100分'] || 0) + 1
    })

    return distribution
})

const recentTrend = computed(() => {
    const records = [...filteredRecords.value]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10).reverse()

    if (records.length === 0) {
        return { dates: ['5/23', '5/24', '5/25', '5/26', '5/27', '5/28', '5/29'], scores: [78, 82, 80, 85, 83, 84, 87], durations: [25, 30, 28, 32, 29, 35, 30] }
    }

    return {
        dates: records.map(r => {
            const d = new Date(r.date)
            return `${d.getMonth() + 1}/${d.getDate()}`
        }),
        scores: records.map(r => r.totalScore),
        durations: records.map(r => Math.round(r.duration / 60))
    }
})

const abilityRadar = computed(() => {
    const analysis = questionTypeAnalysis.value
    if (analysis.length === 0) {
        return {
            indicators: [{ name: '单选题', max: 100 }, { name: '多选题', max: 100 }, { name: '判断题', max: 100 }, { name: '填空题', max: 100 }, { name: '简答题', max: 100 }],
            values: [79, 65, 82, 69, 60]
        }
    }
    return {
        indicators: analysis.map(q => ({ name: q.type, max: 100 })),
        values: analysis.map(q => q.rate)
    }
})

const weaknessAnalysis = computed<WeaknessAnalysis[]>(() => {
    return questionTypeAnalysis.value
        .filter(q => q.rate < 70)
        .sort((a, b) => a.rate - b.rate)
        .map(q => ({
            type: q.type, wrongCount: q.total - q.correct,
            wrongRate: 100 - q.rate,
            trend: q.rate >= 80 ? 'up' as const : q.rate >= 60 ? 'stable' as const : 'down' as const
        }))
})

const weeklyComparison = computed(() => {
    const records = [...filteredRecords.value].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const thisWeek = records.filter(r => new Date(r.date) >= oneWeekAgo)
    const lastWeek = records.filter(r => {
        const date = new Date(r.date)
        return date >= twoWeeksAgo && date < oneWeekAgo
    })

    const calcAvg = (arr: ExerciseRecord[]) => {
        if (arr.length === 0) return { score: 0, count: 0, rate: 0 }
        const avgScore = arr.reduce((sum, r) => sum + r.totalScore, 0) / arr.length
        const totalQ = arr.reduce((sum, r) => sum + r.totalQuestions, 0)
        const correctQ = arr.reduce((sum, r) => sum + r.correctCount, 0)
        return { score: Math.round(avgScore * 10) / 10, count: arr.length, rate: Math.round((correctQ / totalQ) * 100) }
    }

    return { thisWeek: calcAvg(thisWeek), lastWeek: calcAvg(lastWeek) }
})

const monthlyTrend = computed(() => {
    const records = [...filteredRecords.value].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const monthlyData: { [key: string]: { scores: number[]; avgScore: number } } = {}

    records.forEach(record => {
        const date = new Date(record.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { scores: [], avgScore: 0 }
        monthlyData[monthKey].scores.push(record.totalScore)
    })

    Object.keys(monthlyData).forEach(key => {
        const data = monthlyData[key]
        if (!data || !data.scores || data.scores.length === 0) return
        const scores = data.scores
        data.avgScore = Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
    })

    return Object.entries(monthlyData).map(([month, data]) => ({ month, avgScore: data.avgScore, count: data.scores.length }))
        .sort((a, b) => a.month.localeCompare(b.month))
})

const efficiencyAnalysis = computed<EfficiencyMetric[]>(() => {
    return filteredRecords.value
        .map(record => ({
            date: formatDate(record.date), score: record.totalScore,
            duration: Math.round(record.duration / 60),
            efficiency: Math.round((record.totalScore / (record.duration / 60)) * 10) / 10
        }))
        .slice(-10).reverse()
})

const streakInfo = computed(() => {
    const records = [...filteredRecords.value].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    let currentStreak = 0, bestStreak = 0, tempStreak = 0
    let lastDate: Date | null = null

    records.forEach(record => {
        const date = new Date(record.date)
        date.setHours(0, 0, 0, 0)

        if (lastDate === null) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const diffDays = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
            if (diffDays <= 1) { currentStreak = 1; tempStreak = 1 }
        } else {
            const diffDays = Math.floor((lastDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
            if (diffDays === 1) { tempStreak++; if (currentStreak > 0) currentStreak++ }
            else { bestStreak = Math.max(bestStreak, tempStreak); tempStreak = 1; if (currentStreak > 0) currentStreak = 0 }
        }
        lastDate = date
    })

    bestStreak = Math.max(bestStreak, tempStreak)
    return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak) }
})

const recentPerformance = computed(() => {
    const records = [...filteredRecords.value].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
    if (records.length < 2) return { trend: 'stable' as const, change: 0 }

    const recent = records.slice(0, 3)
    const previous = records.slice(3, 5)
    const recentAvg = recent.reduce((sum, r) => sum + r.totalScore, 0) / recent.length
    const previousAvg = previous.length > 0 ? previous.reduce((sum, r) => sum + r.totalScore, 0) / previous.length : recentAvg
    const change = Math.round((recentAvg - previousAvg) * 10) / 10
    const trend = change > 2 ? 'up' as const : change < -2 ? 'down' as const : 'stable' as const

    return { trend, change }
})

const bestPerformances = computed(() => {
    return [...filteredRecords.value].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3)
})

const timeAnalysisData = computed(() => {
    const records = filteredRecords.value
    const periodStats: { [key: string]: { count: number; totalScore: number } } = {}

    records.forEach(record => {
        const hour = new Date(record.date).getHours()
        let period = ''
        if (hour >= 6 && hour < 12) period = '上午 (6-12点)'
        else if (hour >= 12 && hour < 18) period = '下午 (12-18点)'
        else if (hour >= 18 && hour < 24) period = '晚上 (18-24点)'
        else period = '深夜 (0-6点)'

        if (!periodStats[period]) periodStats[period] = { count: 0, totalScore: 0 }
        const stats = periodStats[period]
        if (stats) {
            stats.count++
            stats.totalScore += record.totalScore ?? 0
        }
    })

    const data = Object.keys(periodStats).length > 0 ? Object.entries(periodStats).map(([period, data]) => ({
        period, count: data.count, avgScore: data.count > 0 ? Math.round((data.totalScore / data.count) * 10) / 10 : 0
    })).sort((a, b) => b.count - a.count) : [{ period: '晚上 (18-24点)', count: 3, avgScore: 85 }, { period: '下午 (12-18点)', count: 2, avgScore: 82 }, { period: '上午 (6-12点)', count: 1, avgScore: 80 }]

    return data.map(item => ({ name: item.period, value: item.count, secondValue: item.avgScore }))
})

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

function exportData(type: string) {
    let data = '', filename = ''

    if (type === 'csv') {
        const headers = ['日期', '文档', '总分', '正确率', '用时', '答题数']
        const rows = filteredRecords.value.map(r => [formatDate(r.date), r.fileName, r.totalScore, Math.round((r.correctCount / r.totalQuestions) * 100) + '%', formatDuration(r.duration), r.totalQuestions])
        data = [headers, ...rows].map(row => row.join(',')).join('\n')
        filename = 'practice_statistics.csv'
    } else if (type === 'json') {
        data = JSON.stringify({ summary: stats.value, records: filteredRecords.value, questionAnalysis: questionTypeAnalysis.value, exportTime: new Date().toISOString() }, null, 2)
        filename = 'practice_statistics.json'
    }

    const blob = new Blob([data], { type: type === 'csv' ? 'text/csv' : 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

watch(selectedFile, () => { })

// 将后端数据转换为前端数据格式
function mapBackendToFrontend(backendData: BackendExerciseRecord): ExerciseRecord {
    return {
        id: backendData.id,
        date: backendData.createTime,
        totalQuestions: backendData.totalQuestions,
        correctCount: backendData.topic_true_num,
        wrongCount: backendData.topic_false_num,
        totalScore: backendData.total_score,
        duration: backendData.answer_total_time,
        fileName: backendData.file_name
    }
}

// 从后端获取练习统计数据
async function fetchExerciseData() {
    try {
        isLoading.value = true
        const response = await fetch('http://localhost:8001/data/grades', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.code === 200 && Array.isArray(result.data)) {
            exerciseRecords.value = result.data.map((item: BackendExerciseRecord) => mapBackendToFrontend(item))
        } else {
            console.error('获取数据失败:', result.msg)
            exerciseRecords.value = []
        }
    } catch (error) {
        console.error('获取练习统计数据失败:', error)
        exerciseRecords.value = []
    } finally {
        isLoading.value = false
    }
}

onMounted(() => {
    fetchExerciseData()
})
</script>

<template>
    <div class="statistics-container">
        <div class="statistics-header">
            <h2>📊 练习统计分析</h2>
            <p class="subtitle">多维度数据洞察，全面了解您的学习情况</p>
        </div>

        <div class="statistics-content">
            <div class="filter-section">
                <div class="filter-bar">
                    <label class="filter-label">📂 选择文档：</label>
                    <select v-model="selectedFile" class="filter-select">
                        <option value="all">📄 全部文档</option>
                        <option v-for="doc in documentList" :key="doc.id" :value="doc.name">{{ doc.name }}</option>
                    </select>
                </div>
            </div>

            <div class="stats-overview">
                <div class="stats-cards">
                    <div class="stat-card"><div class="stat-icon">📝</div><div class="stat-info"><div class="stat-value">{{ stats.totalExercises }}</div><div class="stat-label">练习次数</div></div></div>
                    <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-info"><div class="stat-value">{{ stats.totalQuestions }}</div><div class="stat-label">答题总数</div></div></div>
                    <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-info"><div class="stat-value">{{ stats.averageScore }}</div><div class="stat-label">平均得分</div></div></div>
                    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-info"><div class="stat-value">{{ stats.correctRate }}%</div><div class="stat-label">正确率</div></div></div>
                    <div class="stat-card"><div class="stat-icon">⏱️</div><div class="stat-info"><div class="stat-value">{{ formatDuration(stats.averageDuration) }}</div><div class="stat-label">平均用时</div></div></div>
                    <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-info"><div class="stat-value" :class="stats.improvement >= 0 ? 'positive' : 'negative'">{{ stats.improvement >= 0 ? '+' : '' }}{{ stats.improvement }}</div><div class="stat-label">进步幅度</div></div></div>
                    <div class="stat-card highlight-card"><div class="stat-icon">🔥</div><div class="stat-info"><div class="stat-value">{{ streakInfo.currentStreak }}</div><div class="stat-label">连续练习</div><div class="stat-sublabel">最佳: {{ streakInfo.bestStreak }}天</div></div></div>
                    <div class="stat-card highlight-card"><div class="stat-icon">🏆</div><div class="stat-info"><div class="stat-value">{{ stats.bestScore }}</div><div class="stat-label">最高成绩</div><div class="stat-sublabel">{{ bestPerformances.length > 0 && bestPerformances[0]?.fileName ? bestPerformances[0].fileName.slice(0, 10) + '...' : '暂无记录' }}</div></div></div>
                </div>
            </div>

            <div class="stats-detailed">
                <div class="detail-card">
                    <div class="detail-header"><h3>🏆 成绩概览</h3></div>
                    <div class="detail-stats">
                        <div class="detail-item"><span class="detail-label">最高得分</span><span class="detail-value highlight">{{ stats.bestScore }}</span></div>
                        <div class="detail-item"><span class="detail-label">最低得分</span><span class="detail-value error">{{ stats.worstScore }}</span></div>
                        <div class="detail-item"><span class="detail-label">正确题数</span><span class="detail-value success">{{ stats.totalCorrect }}</span></div>
                        <div class="detail-item"><span class="detail-label">错误题数</span><span class="detail-value error">{{ stats.totalWrong }}</span></div>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-header"><h3>📊 总体正确率</h3><span class="detail-value success">{{ stats.correctRate }}%</span></div>
                    <div class="progress-bar"><div class="progress-fill" :style="{ width: stats.correctRate + '%' }"></div></div>
                    <div class="progress-labels"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>

                <div class="weakness-section" v-if="weaknessAnalysis.length > 0">
                    <div class="weakness-card">
                        <div class="weakness-header"><h3>⚠️ 薄弱环节分析</h3><span class="weakness-hint">需要加强练习的题型</span></div>
                        <div class="weakness-list">
                            <div v-for="(item, index) in weaknessAnalysis" :key="item.type" class="weakness-item">
                                <div class="weakness-rank">{{ index + 1 }}</div>
                                <div class="weakness-info"><span class="weakness-type">{{ item.type }}</span><span class="weakness-detail">错题 {{ item.wrongCount }} 道 · 错误率 {{ item.wrongRate }}%</span></div>
                                <div class="weakness-trend" :class="item.trend">
                                    <span v-if="item.trend === 'up'">📈 提升中</span>
                                    <span v-else-if="item.trend === 'down'">📉 需加强</span>
                                    <span v-else>➡️ 稳定</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="export-card">
                        <div class="export-header"><h3>💾 导出报告</h3><span class="export-hint">将统计数据导出为文件</span></div>
                        <div class="export-actions">
                            <button class="export-btn" @click="exportData('csv')"><span class="export-icon">📊</span><span class="export-text">导出 CSV</span></button>
                            <button class="export-btn" @click="exportData('json')"><span class="export-icon">📋</span><span class="export-text">导出 JSON</span></button>
                        </div>
                        <div class="recent-bests">
                            <h4>🏅 最佳成绩 TOP 3</h4>
                            <div v-for="(record, index) in bestPerformances" :key="record.id" class="best-item">
                                <div class="best-rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</div>
                                <div class="best-info"><span class="best-score">{{ record.totalScore }}分</span><span class="best-detail">{{ formatDate(record.date) }} · {{ record.totalQuestions }}题</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="tabs-section">
                <div class="tabs">
                    <button class="tab-btn" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">📈 总览</button>
                    <button class="tab-btn" :class="{ active: activeTab === 'question' }" @click="activeTab = 'question'">❓ 题型分析</button>
                    <button class="tab-btn" :class="{ active: activeTab === 'time' }" @click="activeTab = 'time'">⏰ 时间分析</button>
                    <button class="tab-btn" :class="{ active: activeTab === 'ability' }" @click="activeTab = 'ability'">🎯 能力雷达</button>
                    <button class="tab-btn" :class="{ active: activeTab === 'comparison' }" @click="activeTab = 'comparison'">📊 周对比</button>
                    <button class="tab-btn" :class="{ active: activeTab === 'efficiency' }" @click="activeTab = 'efficiency'">⚡ 效率分析</button>
                </div>

                <div class="tab-content">
                    <div v-show="activeTab === 'overview'" class="tab-panel">
                        <div class="chart-grid">
                            <div class="chart-card full-width"><div class="chart-header"><h3>📉 近期得分与用时趋势</h3><p class="chart-hint">最近10次练习的得分和用时变化</p></div><TrendChart :data="recentTrend" /></div>
                            <div class="chart-card"><div class="chart-header"><h3>📊 分数段分布</h3><p class="chart-hint">各分数段的练习次数</p></div><ScoreDistChart :distribution="scoreDistribution" /></div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'question'" class="tab-panel">
                        <div class="chart-grid">
                            <div class="chart-card"><div class="chart-header"><h3>🥧 题型占比</h3><p class="chart-hint">各题型的练习数量分布</p></div><PieChart :data="questionTypeAnalysis" /></div>
                            <div class="chart-card"><div class="chart-header"><h3>📈 题型正确率对比</h3><p class="chart-hint">不同题型的掌握程度</p></div>
                                <div class="question-stats">
                                    <div v-for="item in questionTypeAnalysis" :key="item.type" class="question-item">
                                        <div class="question-info"><span class="question-type">{{ item.type }}</span><span class="question-count">{{ item.correct }}/{{ item.total }}题</span></div>
                                        <div class="question-bar"><div class="question-fill" :style="{ width: item.rate + '%' }" :class="item.rate >= 70 ? 'good' : item.rate >= 50 ? 'medium' : 'poor'"></div></div>
                                        <span class="question-rate" :class="item.rate >= 70 ? 'good' : item.rate >= 50 ? 'medium' : 'poor'">{{ item.rate }}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'time'" class="tab-panel">
                        <div class="chart-grid">
                            <div class="chart-card full-width"><div class="chart-header"><h3>⏰ 练习时段分布</h3><p class="chart-hint">分析您的最佳学习时间段</p></div><BarChart :data="timeAnalysisData" x-axis-name="时段" y-axis-name="练习次数" second-y-axis-name="平均分" :show-line="true" /></div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'ability'" class="tab-panel">
                        <div class="chart-grid">
                            <div class="chart-card full-width"><div class="chart-header"><h3>🎯 能力雷达图</h3><p class="chart-hint">各题型的掌握程度可视化</p></div><RadarChart :indicators="abilityRadar.indicators" :values="abilityRadar.values" /></div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'comparison'" class="tab-panel">
                        <div class="chart-grid">
                            <div class="chart-card full-width"><div class="chart-header"><h3>📊 本周 vs 上周对比</h3><p class="chart-hint">对比近两周的练习数据</p></div><ComparisonChart :this-week="weeklyComparison.thisWeek" :last-week="weeklyComparison.lastWeek" /></div>
                            <div class="comparison-summary">
                                <div class="summary-card success"><div class="summary-icon">📈</div><div class="summary-content"><div class="summary-label">本周进步</div><div class="summary-value">{{ recentPerformance.change >= 0 ? '+' : '' }}{{ recentPerformance.change }}分</div><div class="summary-trend" :class="recentPerformance.trend"><span v-if="recentPerformance.trend === 'up'">最近表现上升 ↑</span><span v-else-if="recentPerformance.trend === 'down'">最近表现下降 ↓</span><span v-else>表现稳定 →</span></div></div></div>
                                <div class="summary-card info"><div class="summary-icon">🎯</div><div class="summary-content"><div class="summary-label">本周平均分</div><div class="summary-value">{{ weeklyComparison.thisWeek.score || 0 }}分</div><div class="summary-sub">共 {{ weeklyComparison.thisWeek.count || 0 }} 次练习</div></div></div>
                                <div class="summary-card warning"><div class="summary-icon">📉</div><div class="summary-content"><div class="summary-label">上周平均分</div><div class="summary-value">{{ weeklyComparison.lastWeek.score || 0 }}分</div><div class="summary-sub">共 {{ weeklyComparison.lastWeek.count || 0 }} 次练习</div></div></div>
                            </div>
                            <div class="monthly-trend" v-if="monthlyTrend.length > 0">
                                <h3>📅 月度趋势</h3>
                                <div class="trend-list">
                                    <div v-for="month in monthlyTrend" :key="month.month" class="trend-item">
                                        <div class="trend-month">{{ month.month }}</div>
                                        <div class="trend-bar"><div class="trend-fill" :style="{ width: (month.avgScore) + '%' }"></div></div>
                                        <div class="trend-value">{{ month.avgScore }}分</div>
                                        <div class="trend-count">{{ month.count }}次</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-show="activeTab === 'efficiency'" class="tab-panel">
                        <div class="chart-grid">
                            <div class="chart-card full-width"><div class="chart-header"><h3>⚡ 练习效率分析</h3><p class="chart-hint">用时与得分的关系，气泡越大表示得分越高</p></div><EfficiencyChart :data="efficiencyAnalysis" /></div>
                            <div class="efficiency-summary">
                                <h3>📊 效率洞察</h3>
                                <div class="insight-list">
                                    <div class="insight-item"><div class="insight-icon">🚀</div><div class="insight-content"><div class="insight-label">最佳效率</div><div class="insight-value">{{ efficiencyAnalysis.length > 0 ? Math.max(...efficiencyAnalysis.map(e => e.efficiency)).toFixed(1) : 0 }}分/分钟</div><div class="insight-hint">最高效的一次练习</div></div></div>
                                    <div class="insight-item"><div class="insight-icon">🐢</div><div class="insight-content"><div class="insight-label">平均效率</div><div class="insight-value">{{ efficiencyAnalysis.length > 0 ? (efficiencyAnalysis.reduce((sum, e) => sum + e.efficiency, 0) / efficiencyAnalysis.length).toFixed(1) : 0 }}分/分钟</div><div class="insight-hint">总体平均用时得分比</div></div></div>
                                    <div class="insight-item"><div class="insight-icon">⏱️</div><div class="insight-content"><div class="insight-label">平均用时</div><div class="insight-value">{{ efficiencyAnalysis.length > 0 ? Math.round(efficiencyAnalysis.reduce((sum, e) => sum + e.duration, 0) / efficiencyAnalysis.length) : 0 }}分钟</div><div class="insight-hint">每次练习的平均时长</div></div></div>
                                    <div class="insight-item"><div class="insight-icon">💯</div><div class="insight-content"><div class="insight-label">高质量练习</div><div class="insight-value">{{ efficiencyAnalysis.filter(e => e.score >= 85).length }}次</div><div class="insight-hint">得分85分以上的练习</div></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="history-section">
                <div class="history-card">
                    <div class="history-header"><h3>📋 练习历史</h3><span class="history-count">共 {{ filteredRecords.length }} 次练习</span></div>
                    <div class="history-list">
                        <div v-for="record in filteredRecords" :key="record.id" class="history-item">
                            <div class="history-main"><div class="history-date">{{ formatDate(record.date) }}</div><div class="history-file">{{ record.fileName }}</div></div>
                            <div class="history-stats"><div class="history-score" :class="record.totalScore >= 60 ? 'pass' : 'fail'">{{ record.totalScore }}分</div><div class="history-info"><span>{{ record.totalQuestions }}题</span><span>{{ formatDuration(record.duration) }}</span></div></div>
                            <div class="history-progress"><div class="progress-mini"><div class="progress-fill" :style="{ width: (record.correctCount / record.totalQuestions * 100) + '%' }" :class="record.correctCount / record.totalQuestions >= 0.6 ? 'pass' : 'fail'"></div></div><span class="progress-percent">{{ Math.round((record.correctCount / record.totalQuestions) * 100) }}%</span></div>
                        </div>
                        <div v-if="filteredRecords.length === 0" class="history-empty"><p>暂无练习记录</p></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.statistics-container { height: 100%; padding: 0.75rem; background: #f5f7fa; overflow: hidden; display: flex; flex-direction: column; gap: 0.75rem; box-sizing: border-box; }
.statistics-header { background: white; padding: 1.25rem 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); }
.statistics-header h2 { font-size: 1.75rem; font-weight: 600; color: #2c3e50; margin: 0 0 0.5rem 0; display: flex; align-items: center; gap: 0.75rem; }
.subtitle { color: #7f8c8d; font-size: 1rem; margin: 0; line-height: 1.5; }
.statistics-content { display: flex; flex-direction: column; gap: 0.75rem; flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; }
.filter-section { background: white; padding: 1rem 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); }
.filter-bar { display: flex; align-items: center; gap: 1rem; }
.filter-label { font-size: 0.95rem; font-weight: 500; color: #475569; white-space: nowrap; }
.filter-select { padding: 0.6rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; color: #374151; background: white; cursor: pointer; min-width: 250px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.filter-select:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
.stats-overview { display: flex; flex-direction: column; gap: 0.75rem; }
.stats-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.stat-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); display: flex; align-items: flex-start; gap: 1rem; transition: transform 0.3s ease, box-shadow 0.3s ease; }
.stat-card:hover { transform: translateY(-4px); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); }
.stat-card.highlight-card { background: white; }
.stat-card.highlight-card .stat-label { color: #64748b; }
.stat-card.highlight-card .stat-value { color: #667eea; }
.stat-card.highlight-card .stat-sublabel { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
.stat-icon { font-size: 2.5rem; line-height: 1; }
.stat-info { flex: 1; }
.stat-value { font-size: 1.75rem; font-weight: 700; color: #1e293b; }
.stat-value.positive { color: #10b981; }
.stat-value.negative { color: #ef4444; }
.stat-label { font-size: 0.9rem; color: #64748b; margin-top: 0.25rem; }
.stats-detailed { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
.detail-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.detail-header h3 { font-size: 1.1rem; font-weight: 600; color: #2c3e50; margin: 0; }
.detail-value { font-size: 1.5rem; font-weight: 700; }
.detail-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-top: 0.5rem; }
.detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
.detail-item .detail-label { font-size: 0.85rem; color: #64748b; }
.detail-item .detail-value { font-size: 1.25rem; font-weight: 700; }
.detail-value.success { color: #10b981; }
.detail-value.error { color: #ef4444; }
.detail-value.highlight { color: #667eea; }
.progress-bar { height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(135deg, #10b981 0%, #34d399 100%); border-radius: 6px; transition: width 0.5s ease; }
.progress-labels { display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.75rem; color: #94a3b8; }
.weakness-section { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; }
.weakness-card, .export-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.weakness-header, .export-header { margin-bottom: 1rem; }
.weakness-header h3, .export-header h3 { font-size: 1.1rem; font-weight: 600; color: #2c3e50; margin: 0 0 0.25rem 0; }
.weakness-hint, .export-hint { font-size: 0.85rem; color: #94a3b8; }
.weakness-list { display: flex; flex-direction: column; gap: 0.75rem; }
.weakness-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: 8px; }
.weakness-rank { width: 28px; height: 28px; background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600; }
.weakness-info { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
.weakness-type { font-size: 0.95rem; font-weight: 500; color: #374151; }
.weakness-detail { font-size: 0.8rem; color: #64748b; }
.weakness-trend { font-size: 0.85rem; font-weight: 500; }
.weakness-trend.up { color: #10b981; }
.weakness-trend.down { color: #ef4444; }
.weakness-trend.stable { color: #64748b; }
.export-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
.export-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; }
.export-btn:hover { background: #f1f5f9; border-color: #667eea; }
.export-icon { font-size: 1.25rem; }
.export-text { font-size: 0.9rem; color: #374151; }
.recent-bests { border-top: 1px solid #e2e8f0; padding-top: 1rem; }
.recent-bests h4 { font-size: 1rem; font-weight: 600; color: #2c3e50; margin: 0 0 1rem 0; }
.best-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; }
.best-rank { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600; color: white; }
.best-rank.rank-1 { background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%); }
.best-rank.rank-2 { background: linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%); }
.best-rank.rank-3 { background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%); }
.best-info { flex: 1; display: flex; flex-direction: column; gap: 0.125rem; }
.best-score { font-size: 0.95rem; font-weight: 600; color: #1e293b; }
.best-detail { font-size: 0.75rem; color: #94a3b8; }
.tabs-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); overflow: hidden; }
.tabs { display: flex; border-bottom: 2px solid #f1f5f9; background: #fafbfc; overflow-x: auto; }
.tab-btn { flex: 1; padding: 1rem; border: none; background: transparent; font-size: 0.95rem; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.2s ease; border-bottom: 2px solid transparent; margin-bottom: -2px; white-space: nowrap; }
.tab-btn:hover { color: #667eea; background: #f8fafc; }
.tab-btn.active { color: #667eea; border-bottom-color: #667eea; background: white; }
.tab-content { padding: 1.5rem; }
.tab-panel { width: 100%; }
.chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; }
.chart-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); min-height: 400px; height: 400px; display: flex; flex-direction: column; }
.chart-card > *:last-child { flex: 1; min-height: 0; }
.chart-card.full-width { grid-column: 1 / -1; }
.chart-header { margin-bottom: 1rem; }
.chart-header h3 { font-size: 1.1rem; font-weight: 600; color: #2c3e50; margin: 0 0 0.25rem 0; }
.chart-hint { font-size: 0.85rem; color: #94a3b8; margin: 0; line-height: 1.5; }
.question-stats { display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0; }
.question-item { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 1rem; }
.question-info { display: flex; flex-direction: column; gap: 0.25rem; }
.question-type { font-size: 0.95rem; font-weight: 500; color: #374151; }
.question-count { font-size: 0.8rem; color: #94a3b8; }
.question-bar { height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
.question-fill { height: 100%; border-radius: 5px; transition: width 0.3s ease; }
.question-fill.good { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); }
.question-fill.medium { background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); }
.question-fill.poor { background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); }
.question-rate { font-size: 1rem; font-weight: 600; min-width: 50px; text-align: right; }
.question-rate.good { color: #10b981; }
.question-rate.medium { color: #f59e0b; }
.question-rate.poor { color: #ef4444; }
.comparison-summary { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.summary-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); display: flex; align-items: flex-start; gap: 1rem; }
.summary-icon { font-size: 2.5rem; line-height: 1; }
.summary-content { flex: 1; }
.summary-label { font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem; }
.summary-value { font-size: 1.75rem; font-weight: 700; color: #1e293b; }
.summary-trend { font-size: 0.85rem; margin-top: 0.5rem; }
.summary-trend.up { color: #10b981; }
.summary-trend.down { color: #ef4444; }
.summary-trend.stable { color: #64748b; }
.summary-sub { font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem; }
.monthly-trend { grid-column: 1 / -1; background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.monthly-trend h3 { font-size: 1.1rem; font-weight: 600; color: #2c3e50; margin: 0 0 1rem 0; }
.trend-list { display: flex; flex-direction: column; gap: 0.75rem; }
.trend-item { display: grid; grid-template-columns: 80px 1fr 80px 60px; align-items: center; gap: 1rem; }
.trend-month { font-size: 0.95rem; font-weight: 500; color: #374151; }
.trend-bar { height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
.trend-fill { height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 5px; transition: width 0.3s ease; }
.trend-value { font-size: 0.95rem; font-weight: 600; color: #667eea; }
.trend-count { font-size: 0.85rem; color: #94a3b8; }
.efficiency-summary { grid-column: 1 / -1; background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.efficiency-summary h3 { font-size: 1.1rem; font-weight: 600; color: #2c3e50; margin: 0 0 1rem 0; }
.insight-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.insight-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; background: #f8fafc; border-radius: 10px; }
.insight-icon { font-size: 2rem; line-height: 1; }
.insight-content { flex: 1; }
.insight-label { font-size: 0.85rem; color: #64748b; margin-bottom: 0.25rem; }
.insight-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
.insight-hint { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
.history-section { display: flex; flex-direction: column; gap: 0.75rem; }
.history-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.history-header h3 { font-size: 1.1rem; font-weight: 600; color: #2c3e50; margin: 0; }
.history-count { font-size: 0.85rem; color: #94a3b8; }
.history-list { display: flex; flex-direction: column; gap: 0.75rem; }
.history-item { display: grid; grid-template-columns: 1.5fr 1fr 1fr; align-items: center; padding: 1rem; background: #f8fafc; border-radius: 10px; gap: 1rem; transition: background 0.2s ease; }
.history-item:hover { background: #f1f5f9; }
.history-main { display: flex; flex-direction: column; gap: 0.25rem; }
.history-date { font-size: 0.95rem; color: #374151; font-weight: 500; }
.history-file { font-size: 0.8rem; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-stats { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
.history-score { font-size: 1.25rem; font-weight: 700; }
.history-score.pass { color: #10b981; }
.history-score.fail { color: #ef4444; }
.history-info { display: flex; gap: 0.75rem; font-size: 0.8rem; color: #64748b; }
.history-progress { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; }
.progress-mini { width: 80px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
.progress-percent { font-size: 0.85rem; color: #475569; font-weight: 500; }
.history-empty { text-align: center; padding: 2rem; color: #94a3b8; }
</style>