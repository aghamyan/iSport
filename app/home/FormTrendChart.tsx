'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { FormEntry } from '@/lib/stats/types'

echarts.use([BarChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Goal-differential-per-match bar chart, oldest → newest left to right.
 * Answers one question: is scoring form trending up or down right now?
 * Colors are read live from the app's CSS variables so it follows the
 * light/dark theme toggle, which canvas fillStyle can't resolve on its own.
 */
export function FormTrendChart({ form }: { form: FormEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || form.length === 0) return
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })

    const chronological = [...form].reverse()

    function paint() {
      const win = cssVar('--win')
      const loss = cssVar('--loss')
      const draw = cssVar('--draw')
      const mutedFg = cssVar('--muted-foreground')
      const border = cssVar('--border')
      const cardBg = cssVar('--card')
      const textFg = cssVar('--foreground')

      chart.setOption({
        backgroundColor: 'transparent',
        animationDuration: 300,
        grid: { left: 8, right: 8, top: 8, bottom: 20, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: cardBg,
          borderColor: border,
          textStyle: { color: textFg, fontSize: 11 },
          axisPointer: { type: 'none' },
          formatter: (params: unknown) => {
            const p = (params as Array<{ dataIndex: number }>)[0]
            const e = chronological[p.dataIndex]
            const diff = e.goalsFor - e.goalsAgainst
            return `vs ${e.opponentName}<br/>${e.goalsFor}–${e.goalsAgainst} (${diff > 0 ? '+' : ''}${diff})`
          },
        },
        xAxis: {
          type: 'category',
          data: chronological.map((e) => e.opponentName.split(' ')[0]),
          axisLine: { lineStyle: { color: border } },
          axisTick: { show: false },
          axisLabel: { color: mutedFg, fontSize: 10, interval: 0 },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: border, type: 'dashed' } },
          axisLabel: { color: mutedFg, fontSize: 10 },
        },
        series: [
          {
            type: 'bar',
            data: chronological.map((e) => ({
              value: e.goalsFor - e.goalsAgainst,
              itemStyle: { color: e.result === 'W' ? win : e.result === 'L' ? loss : draw, borderRadius: 2 },
            })),
            barMaxWidth: 22,
            markLine: {
              symbol: 'none',
              label: { show: false },
              lineStyle: { color: border, type: 'solid', width: 1 },
              data: [{ yAxis: 0 }],
            },
          },
        ],
      })
    }

    paint()

    // The container can still be zero-sized on first paint (layout not yet
    // settled); a ResizeObserver both fixes that and keeps the chart correctly
    // sized across breakpoint/orientation changes.
    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(ref.current)

    const themeObserver = new MutationObserver(paint)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
      chart.dispose()
    }
  }, [form])

  if (form.length === 0) return null

  return <div ref={ref} className="h-32 w-full" role="img" aria-label="Goal differential trend across recent matches" />
}
