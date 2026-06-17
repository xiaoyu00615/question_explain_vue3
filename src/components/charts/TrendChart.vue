<script setup lang="ts">
import { computed, type Ref } from 'vue'
import EChartsBase from './EChartsBase.vue'

interface TrendData {
    dates: string[]
    scores: number[]
    durations: number[]
}

interface Props {
    data: TrendData
}

const props = defineProps<Props>()

const chartOptions = computed(() => ({
    tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#374151' }
    },
    legend: {
        data: ['得分', '用时(分钟)'],
        top: 15,
        textStyle: { color: '#64748b' },
        itemGap: 20
    },
    grid: {
        left: '5%', right: '5%', bottom: '10%', top: 70, containLabel: true
    },
    xAxis: {
        type: 'category' as const,
        data: props.data.dates,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', margin: 10 }
    },
    yAxis: [
        {
            type: 'value' as const,
            name: '得分',
            min: 0,
            max: 100,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', formatter: '{value}分', margin: 10 },
            splitLine: { lineStyle: { color: '#f1f5f9' } }
        },
        {
            type: 'value' as const,
            name: '用时',
            min: 0,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', formatter: '{value}分钟', margin: 10 },
            splitLine: { show: false }
        }
    ],
    series: [
        {
            name: '得分',
            type: 'line' as const,
            smooth: true,
            data: props.data.scores,
            lineStyle: { color: '#667eea', width: 3 },
            itemStyle: { color: '#667eea' },
            areaStyle: {
                color: {
                    type: 'linear' as const,
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
                        { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
                    ]
                }
            },
            symbol: 'circle' as const,
            symbolSize: 8
        },
        {
            name: '用时(分钟)',
            type: 'bar' as const,
            yAxisIndex: 1,
            data: props.data.durations,
            itemStyle: { color: 'rgba(102, 126, 234, 0.3)' },
            barWidth: '25%'
        }
    ]
}))
</script>

<template>
    <EChartsBase :options="chartOptions" />
</template>
