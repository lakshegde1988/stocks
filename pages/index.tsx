'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, CrosshairMode, IChartApi } from 'lightweight-charts'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Search, ArrowUp, ArrowDown } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import nifty50Data from '../public/nifty50.json'
import niftyNext50Data from '../public/niftynext50.json'
import midcap150Data from '../public/midcap150.json'
import smallcap250Data from '../public/smallcap250.json'
import microCap250Data from '../public/microcap250.json'

const TIME_PERIODS = [
 
  { label: 'D', range: '1y', autoInterval: '1d' },
  { label: 'W', range: '5y', autoInterval: '1wk' },
  { label: 'M', range: 'max', autoInterval: '1mo' },
] as const;

type TimePeriod = typeof TIME_PERIODS[number];

interface Stock {
  symbol: string;
  name: string;
  industry: string;
}

interface CurrentStock extends Stock {
  price: number;
  change: number;
  todayChange: number;
}

interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const chartColors = {
  background: '#ffffff',
  text: '#1f2937',
  grid: '#e5e7eb',
  border: '#d1d5db',
  chart1: '#1e4620', // hsl(139, 65%, 20%)
  chart2: '#24c260', // hsl(140, 74%, 44%)
  chart3: '#26e837', // hsl(142, 88%, 28%)
  chart4: '#163d1b', // hsl(137, 55%, 15%)
  chart5: '#0d1e11', // hsl(141, 40%, 9%)
}

export default function StockChart() {
  const [indexData] = useState([
    { label: 'Nifty 50', data: nifty50Data },
    { label: 'Nifty Next 50', data: niftyNext50Data },
    { label: 'Midcap 150', data: midcap150Data },
    { label: 'Smallcap 250', data: smallcap250Data },
    { label: 'MicroCap 250', data: microCap250Data },
  ])
  
  const [selectedIndexId, setSelectedIndexId] = useState(0)
  const [currentStockIndex, setCurrentStockIndex] = useState(0)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod['label']>('D')
  const [currentStock, setCurrentStock] = useState<CurrentStock | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    const selectedIndex = indexData[selectedIndexId]
    const stocksList = selectedIndex.data.map(item => ({
      symbol: item.Symbol,
      name: item["Company Name"],
      industry: item.Industry
    }))
    setStocks(stocksList)
    setCurrentStockIndex(0)
  }, [selectedIndexId, indexData])

  const fetchStockData = useCallback(async () => {
    if (!stocks.length) return
    
    setLoading(true)
    setError(null)
    
    try {
      const currentStock = stocks[currentStockIndex]
      const period = TIME_PERIODS.find(p => p.label === selectedPeriod)

      if (!period) throw new Error('Invalid period selected')

      const response = await axios.get<ChartData[]>('/api/stockData', {
        params: {
          symbol: currentStock.symbol,
          range: period.range,
          interval: period.autoInterval
        }
      })

      if (response.data && Array.isArray(response.data)) {
        setChartData(response.data)
        setCurrentStock({
          ...currentStock,
          price: response.data[response.data.length - 1]?.close,
          change: ((response.data[response.data.length - 1]?.close - response.data[0]?.open) / response.data[0]?.open) * 100,
          todayChange: ((response.data[response.data.length - 1]?.close - response.data[response.data.length - 2]?.close) / response.data[response.data.length - 2]?.close) * 100
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data')
    } finally {
      setLoading(false)
    }
  }, [stocks, currentStockIndex, selectedPeriod])

  useEffect(() => {
    fetchStockData()
  }, [fetchStockData])

  useEffect(() => {
    if (!chartContainerRef.current || !chartData.length) return

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: chartColors.background },
        textColor: chartColors.text,
      },
      grid: {
        vertLines: { visible:false },
        horzLines: { visible:false },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: chartColors.border,
      },
      timeScale: {
        borderColor: chartColors.border,
        rightOffset: 5,
        minBarSpacing: 5,
      }
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: chartColors.chart2,
      downColor: chartColors.chart1,
      borderUpColor: chartColors.chart3,
      borderDownColor: chartColors.chart4,
      wickUpColor: chartColors.chart3,
      wickDownColor: chartColors.chart4,
    })

    candleSeries.setData(chartData)

    const volumeSeries = chart.addHistogramSeries({
      color: chartColors.chart5,
      priceFormat: {
        type: 'volume'
      },
    })

    volumeSeries.setData(
      chartData.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? chartColors.chart2 : chartColors.chart1,
      }))
    )
    candleSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      }
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
    });
    chart.timeScale().fitContent()

    window.addEventListener('resize', handleResize)

    chartRef.current = chart

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [chartData])

  const handlePeriodChange = (newPeriod: TimePeriod['label']) => {
    setSelectedPeriod(newPeriod)
  }

  const handlePrevious = () => {
    if (currentStockIndex > 0) {
      setCurrentStockIndex(prev => prev - 1)
    }
  }

  const handleNext = () => {
    if (currentStockIndex < stocks.length - 1) {
      setCurrentStockIndex(prev => prev + 1)
    }
  }

  return (
    <div className={`flex justify-center min-h-screen p-2 sm:p-4 `}>
      <div className="w-full max-w-4xl space-y-2 sm:space-y-4">
        <header className="flex justify-between items-center space-x-2">
  <div className="flex-1 min-w-0">
    <Select
      value={selectedIndexId.toString()}
      onValueChange={(value) => setSelectedIndexId(parseInt(value))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select Index" />
      </SelectTrigger>
      <SelectContent>
        {indexData.map((item, index) => (
          <SelectItem key={index} value={index.toString()}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="flex-1 min-w-0">
  <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Search className="mr-2 h-4 w-4" />
                  <span className="truncate">{searchTerm || "Search stocks..."}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search stocks..." value={searchTerm} onValueChange={setSearchTerm} />
                  <CommandEmpty>No stocks found.</CommandEmpty>
                  <CommandGroup>
                    {stocks && stocks.length > 0 ? (
                      stocks
                        .filter(stock => 
                          stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          stock.name.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .slice(0, 10)
                        .map((stock) => (
                          <CommandItem
                            key={stock.symbol}
                            onSelect={() => {
                              const stockIndex = stocks.findIndex((s) => s.symbol === stock.symbol)
                              setCurrentStockIndex(stockIndex)
                              setSearchTerm('')
                            }}
                          >
                            <span>{stock.symbol}</span>
                            <span className="ml-2 text-muted-foreground">{stock.name}</span>
                          </CommandItem>
                        ))
                    ) : (
                      <CommandItem>Loading stocks...</CommandItem>
                    )}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
  </div>

  
</header>

        <main>
          {currentStock && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">{currentStock.symbol}</h2>
                    <p className="text-sm text-muted-foreground">{currentStock.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">₹{currentStock.price?.toFixed(2)}</p>
                    <p className={`text-sm flex items-center justify-end ${currentStock.todayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {currentStock.todayChange >= 0 ? <ArrowUp className="mr-1 h-4 w-4" /> : <ArrowDown className="mr-1 h-4 w-4" />}
                      {Math.abs(currentStock.todayChange ?? 0).toFixed(2)}%

                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardContent className="p-4">
              <div ref={chartContainerRef} className="w-full h-[400px]" />
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-2 overflow-x-auto pb-2">
            {TIME_PERIODS.map((period) => (
              <Button
                key={period.label}
                variant={selectedPeriod === period.label ? "default" : "outline"}
                onClick={() => handlePeriodChange(period.label)}
                className="px-3 py-1 text-sm"
              >
                {period.label}
              </Button>
            ))}
          </div>
        </main>

        <footer className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStockIndex === 0}
            className="text-sm"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentStockIndex + 1} / {stocks.length}
          </span>
          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentStockIndex === stocks.length - 1}
            className="text-sm"
          >
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </footer>
      </div>
    </div>
  )
}
