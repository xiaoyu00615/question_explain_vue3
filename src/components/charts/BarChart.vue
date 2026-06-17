<script setup lang="ts">
import { computed } from 'vue'
import EChartsBase from './EChartsBase.vue'

interface BarDataItem {
    name: string
    value: number
    secondValue?: number
}

interface Props {
    data: BarDataItem[]
    xAxisName?: string
    yAxisName?: string
    secondYAxisName?: string
    showLine?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    showLine: false
})

const chartOptions = computed(() => ({
    tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        axisPointer: { type: 'shadow' as const }
    },
    legend: {
        data: props.secondYAxisName ? [props.yAxisName || '数值', props.secondYAxisName] : undefined,
        top: 10,
        textStyle: { color: '#64748b' },
        itemGap: 20
    },
    grid: {
        left: '6%', right: '6%', bottom: '12%', top: 70, containLabel: true
    },
    xAxis: {
        type: 'category' as const,
        data: props.data.map((item) => item.name),
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', margin: 12, fontSize: 12 }
    },
    yAxis:
        props.secondYAxisName
            ? [
                  {
                      type: 'value' as const,
                      name: props.yAxisName,
                      axisLine: { lineStyle: { color: '#e2e8f0' } },
                      axisLabel: { color: '#64748b', margin: 12, fontSize: 12 },
                      splitLine: { lineStyle: { color: '#f1f5f9' } }
                  },
                  {
                      type: 'value' as const,
                      name: props.secondYAxisName,
                      axisLine: { lineStyle: { color: '#e2e8f0' } },
                      axisLabel: { color: '#64748b', margin: 12, fontSize: 12 },
                      splitLine: { show: false }
                  }
              ]
            : [
                  {
                      type: 'value' as const,
                      name: props.yAxisName,
                      axisLine: { lineStyle: { color: '#e2e8f0' } },
                      axisLabel: { color: '#64748b', margin: 12, fontSize: 12 },
                      splitLine: { lineStyle: { color: '#f1f5f9' } }
                  }
              ],
    series: [
        {
            name: props.yAxisName || '数值',
            type: 'bar' as const,
            data: props.data.map((item) => item.value),
            barWidth: props.data.length > 8 ? '25%' : '40%',
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
            }
        },
        props.showLine && props.secondYAxisName
            ? [
                  {
                      name: props.secondYAxisName,
                      type: 'line' as const,
                      yAxisIndex: 1,
                      data: props.data.map((item) => item.secondValue || 0),
                      lineStyle: { color: '#10b981', width: 3 },
                      itemStyle: { color: '#10b981' },
                      symbol: 'circle' as const,
                      symbolSize: 8
                  }
              ]
            : []
    ].flat()
}))
</script>

<template>
    <EChartsBase :options="chartOptions" />
</template>
