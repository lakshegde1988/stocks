import React, { useEffect, useRef } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'

const Chart = ({ data }) => {
  const chartContainerRef = useRef(null)

  useEffect(() => {
    if (!chartContainerRef.current || !data.length) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: 'solid', color: 'var(--background)' },
        textColor: 'var(--foreground)',
      },
      crosshair: { mode: CrosshairMode.Normal },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      timeScale: {
        timezone: 'Asia/Kolkata',
        timeVisible: true,
        borderColor: 'var(--border)',
      },
      rightPriceScale: {
        borderColor: 'var(--border)',
      },
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: 'var(--success)',
      downColor: 'var(--destructive)',
      borderUpColor: 'var(--success)',
      borderDownColor: 'var(--destructive)',
      wickUpColor: 'var(--success)',
      wickDownColor: 'var(--destructive)',
    })

    candlestickSeries.setData(data)

    const volumeSeries = chart.addHistogramSeries({
      color: 'var(--success)',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    volumeSeries.setData(
      data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'var(--success)' : 'var(--destructive)',
      }))
    )

    chart.timeScale().fitContent()

    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data])

  return <div ref={chartContainerRef} className="w-full h-[400px]" />
}

export default Chart
