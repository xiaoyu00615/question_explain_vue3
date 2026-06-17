<script setup lang="ts">
import { computed } from 'vue'
import EChartsBase from './EChartsBase.vue'

interface EfficiencyData {
    date: string
    score: number
    duration: number
    efficiency: number
}

interface Props {
    data: EfficiencyData[]
}

const props = defineProps<Props>()

const chartOptions = computed(() => ({
    tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        formatter: (params: unknown) => {
            const p = params as { name?: string; data?: [number, number, number, string] }
            if (!p || !p.data) return ''
            return `${p.data[3]}<br/>得分: ${p.data[0]}<br/>用时: ${p.data[1]}分钟<br/>效率: ${p.data[2]}分/分钟`
        }
    },
    polar: {
        radius: ['20%', '70%'],
        center: ['45%', '55%']
    },
    angleAxis: {
        type: 'value' as const,
        min: 0,
        max: 60,
        startAngle: 90,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    radiusAxis: {
        type: 'value' as const,
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    series: [
        {
            type: 'scatter' as const,
            symbolSize: (data: number[]) => {
                if (!data || !data[0]) return 15
                return Math.max(15, data[0] / 3)
            },
            data: props.data.map((e) => [e.duration, e.score, e.efficiency, e.date]),
            itemStyle: {
                color: (params: unknown) => {
                    const p = params as { data?: number[] }
                    if (!p.data || p.data.length < 2) return '#64748b'
                    const score = p.data[1] ?? 0
                    if (score >= 85) return '#10b981'
                    if (score >= 70) return '#f59e0b'
                    return '#ef4444'
                },
                opacity: 0.8
            },
            label: {
                show: true,
                formatter: (params: unknown): string => {
                    const p = params as { data?: [number, number, number, string] }
                    if (!p.data) return ''
                    const result = p.data[3].split(' ')[0]
                    return result || ''
                },
                fontSize: 10,
                color: '#64748b',
                distance: 5
            }
        }
    ],
    visualMap: {
        show: true,
        dimension: 1,
        min: 0,
        max: 100,
        inRange: {
            color: ['#ef4444', '#f59e0b', '#10b981']
        },
        right: 20,
        top: 'center',
        text: ['高分区', '低分区'],
        textStyle: { color: '#64748b' },
        itemWidth: 15,
        itemHeight: 120,
        calculable: true
    }
}))
</script>

<template>
    <EChartsBase :options="chartOptions" />
</template>
