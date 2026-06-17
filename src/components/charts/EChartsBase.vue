<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'
import * as echarts from 'echarts'

interface Props {
    options: echarts.EChartsOption
    autoResize?: boolean
    height?: string
}

const props = withDefaults(defineProps<Props>(), {
    autoResize: true,
    height: '100%'
})

const emit = defineEmits<{
    click: [params: echarts.DefaultLabelFormatterCallbackParams]
}>()

const chartRef = ref<HTMLDivElement | null>(null)
const chartInstance = ref<echarts.ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

function initChart() {
    if (!chartRef.value) return

    const rect = chartRef.value.getBoundingClientRect()
    if (rect.width < 10 || rect.height < 10) {
        setTimeout(initChart, 100)
        return
    }

    if (chartInstance.value) {
        chartInstance.value.dispose()
    }

    chartInstance.value = echarts.init(chartRef.value)
    chartInstance.value.setOption(props.options, true)

    chartInstance.value.on('click', (params) => {
        emit('click', params)
    })
}

function handleResize() {
    if (chartInstance.value) {
        chartInstance.value.resize()
    }
}

watch(() => props.options, (newOptions) => {
    if (chartInstance.value) {
        chartInstance.value.setOption(newOptions, true)
    }
}, { deep: true })

onMounted(() => {
    nextTick(() => {
        initChart()
        if (props.autoResize) {
            window.addEventListener('resize', handleResize)
            
            if (chartRef.value) {
                resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        const { width, height } = entry.contentRect
                        if (width > 0 && height > 0) {
                            handleResize()
                        }
                    }
                })
                resizeObserver.observe(chartRef.value)
            }
        }
    })
})

onUnmounted(() => {
    if (props.autoResize) {
        window.removeEventListener('resize', handleResize)
    }
    if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
    }
    if (chartInstance.value) {
        chartInstance.value.dispose()
        chartInstance.value = null
    }
})

defineExpose({
    instance: chartInstance as Ref<echarts.ECharts | null>
})
</script>

<template>
    <div ref="chartRef" :style="{ height: height, width: '100%', minHeight: '200px' }"></div>
</template>
