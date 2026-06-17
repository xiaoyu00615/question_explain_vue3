<script setup lang="ts">
import { computed } from 'vue'
import EChartsBase from './EChartsBase.vue'

interface PieDataItem {
    type: string
    total: number
    correct: number
    rate: number
}

interface Props {
    data: PieDataItem[]
}

const props = defineProps<Props>()

const chartOptions = computed(() => ({
    tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        formatter: (params: unknown) => {
            const p = params as { name?: string; value?: number; percent?: number }
            const name = p.name || ''
            const value = typeof p.value === 'number' ? p.value : 0
            const percent = typeof p.percent === 'number' ? p.percent : 0
            return `${name}: ${value}题 (${percent}%)`
        }
    },
    legend: {
        orient: 'horizontal' as const,
        bottom: '5%',
        left: 'center',
        textStyle: { color: '#64748b', fontSize: 12 },
        itemGap: 16,
        itemWidth: 14,
        itemHeight: 14
    },
    series: [
        {
            type: 'pie' as const,
            radius: ['30%', '70%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 8,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false },
            emphasis: {
                label: { show: true, fontSize: 14, fontWeight: 'bold' as const }
            },
            data: props.data.map((item, index) => ({
                value: item.total,
                name: `${item.type}`,
                itemStyle: {
                    color: ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'][index % 5]
                }
            }))
        }
    ]
}))
</script>

<template>
    <EChartsBase :options="chartOptions" />
</template>
