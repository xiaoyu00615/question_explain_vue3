<script setup lang="ts">
import { computed } from 'vue'
import EChartsBase from './EChartsBase.vue'

interface RadarIndicator {
    name: string
    max: number
}

interface Props {
    indicators: RadarIndicator[]
    values: number[]
}

const props = defineProps<Props>()

const chartOptions = computed(() => ({
    tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        formatter: (params: unknown) => {
            const p = params as { name?: string; value?: number }
            const name = p.name || ''
            const value = typeof p.value === 'number' ? p.value : 0
            return `${name}: ${value}%`
        }
    },
    radar: {
        indicator: props.indicators,
        center: ['50%', '55%'],
        radius: '55%',
        axisName: { color: '#64748b', fontSize: 13, padding: [5, 5] },
        splitArea: {
            areaStyle: {
                color: ['rgba(102, 126, 234, 0.05)', 'rgba(102, 126, 234, 0.1)']
            }
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        splitLine: { lineStyle: { color: '#e2e8f0' } }
    },
    series: [
        {
            type: 'radar' as const,
            data: [
                {
                    value: props.values,
                    name: '掌握程度',
                    areaStyle: { color: 'rgba(102, 126, 234, 0.3)' },
                    lineStyle: { color: '#667eea', width: 2 },
                    itemStyle: { color: '#667eea' }
                }
            ]
        }
    ]
}))
</script>

<template>
    <EChartsBase :options="chartOptions" />
</template>
