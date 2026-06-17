<script setup lang="ts">
import { computed } from 'vue'
import EChartsBase from './EChartsBase.vue'

interface WeekData {
    count: number
    score: number
    rate: number
}

interface Props {
    thisWeek: WeekData
    lastWeek: WeekData
}

const props = defineProps<Props>()

const chartOptions = computed(() => ({
    tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        axisPointer: { type: 'shadow' as const }
    },
    legend: {
        data: ['本周', '上周'],
        top: 15,
        textStyle: { color: '#64748b' },
        itemGap: 20
    },
    grid: {
        left: '5%', right: '5%', bottom: '10%', top: 70, containLabel: true
    },
    xAxis: {
        type: 'category' as const,
        data: ['练习次数', '平均得分', '正确率'],
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', margin: 10 }
    },
    yAxis: [
        {
            type: 'value' as const,
            name: '次数/分数',
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', margin: 10 },
            splitLine: { lineStyle: { color: '#f1f5f9' } }
        },
        {
            type: 'value' as const,
            name: '正确率',
            min: 0,
            max: 100,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', formatter: '{value}%', margin: 10 },
            splitLine: { show: false }
        }
    ],
    series: [
        {
            name: '本周',
            type: 'bar' as const,
            data: [props.thisWeek.count, props.thisWeek.score, props.thisWeek.rate],
            itemStyle: {
                color: {
                    type: 'linear' as const,
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                        { offset: 0, color: '#667eea' },
                        { offset: 1, color: '#764ba2' }
                    ]
                },
                borderRadius: [4, 4, 0, 0]
            },
            barWidth: '30%'
        },
        {
            name: '上周',
            type: 'bar' as const,
            data: [props.lastWeek.count, props.lastWeek.score, props.lastWeek.rate],
            itemStyle: {
                color: {
                    type: 'linear' as const,
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                        { offset: 0, color: '#10b981' },
                        { offset: 1, color: '#34d399' }
                    ]
                },
                borderRadius: [4, 4, 0, 0]
            },
            barWidth: '30%'
        }
    ]
}))
</script>

<template>
    <EChartsBase :options="chartOptions" />
</template>
