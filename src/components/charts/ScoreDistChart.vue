<script setup lang="ts">
import { computed } from 'vue'
import EChartsBase from './EChartsBase.vue'

interface Props {
    distribution: { [key: string]: number }
}

const props = defineProps<Props>()

const colors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981']

const chartOptions = computed(() => {
    const keys = Object.keys(props.distribution)
    const values = Object.values(props.distribution)

    return {
        tooltip: {
            trigger: 'axis' as const,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0',
            formatter: (params: unknown) => {
                const p = params as { name?: string; value?: number; percent?: number }
                const name = p.name || ''
                const value = typeof p.value === 'number' ? p.value : 0
                const percent = typeof p.percent === 'number' ? p.percent : 0
                return `${name}: ${value}次 (${percent}%)`
            }
        },
        grid: {
            left: '5%', right: '5%', bottom: '10%', top: 40, containLabel: true
        },
        xAxis: {
            type: 'category' as const,
            data: keys,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', margin: 10 }
        },
        yAxis: {
            type: 'value' as const,
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisLabel: { color: '#64748b', margin: 10 },
            splitLine: { lineStyle: { color: '#f1f5f9' } }
        },
        series: [
            {
                type: 'bar' as const,
                data: values.map((_, index) => ({
                    value: _,
                    itemStyle: {
                        color: colors[index % colors.length],
                        borderRadius: [4, 4, 0, 0]
                    }
                })),
                barWidth: '40%'
            }
        ]
    }
})
</script>

<template>
    <EChartsBase :options="chartOptions" />
</template>
