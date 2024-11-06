'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import nifty50Data from '/public/nifty50.json'
import niftyNext50Data from '/public/niftynext50.json'
import midcap150Data from '/public/midcap150.json'
import smallcap250Data from '/public/smallcap250.json'
import microCap250Data from '/public/microcap250.json'

// Dynamically import the Chart component to avoid SSR issues
const Chart = dynamic(() => import('./chart'), { ssr: false })

const TIME_PERIODS = [
  { label: '1Y', range: '1y', autoInterval: 'daily' },
  { label: '5Y', range: '5y', autoInterval: 'weekly' },
  { label: 'MAX', range: 'max', autoInterval: 'monthly' },
]

const INTERVALS = [
  { label: 'D', value: 'daily', interval: '1d', autoTimeframe: '1Y' },
  { label: 'W', value: 'weekly', interval: '1wk', autoTimeframe: '5Y' },
  { label: 'M', value: 'monthly', interval: '1mo', autoTimeframe: 'Max' },
]

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
  const [stocks, setStocks] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('1Y')
  const [selectedInterval, setSelectedInterval] = useState('daily')
  const [currentStock, setCurrentStock] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

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
      const interval = INTERVALS.find(i => i.value === selectedInterval)

      const response = await axios.get('/api/stockData', {
        params: {
          symbol: currentStock.symbol,
          range: period.range,
          interval: interval.interval
        }
      })

      if (response.data && Array.isArray(response.data)) {
        setChartData(response.data)
        setCurrentStock({
          name: currentStock.name,
          symbol: currentStock.symbol,
          industry: currentStock.industry,
          price: response.data[response.data.length - 1]?.close,
          change: ((response.data[response.data.length - 1]?.close - response.data[0]?.open) / response.data[0]?.open) * 100,
          todayChange: ((response.data[response.data.length - 1]?.close - response.data[response.data.length - 2]?.close) / response.data[response.data.length - 2]?.close) * 100
        })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch stock data')
    } finally {
      setLoading(false)
    }
  }, [stocks, currentStockIndex, selectedPeriod, selectedInterval])

  useEffect(() => {
    fetchStockData()
  }, [fetchStockData])

  const handlePeriodChange = (newPeriod) => {
    setSelectedPeriod(newPeriod)
    const autoInterval = TIME_PERIODS.find((p) => p.label === newPeriod)?.autoInterval
    if (autoInterval) {
      setSelectedInterval(autoInterval)
    }
  }

  const handleIntervalChange = (newInterval) => {
    const autoTimeframe = INTERVALS.find((i) => i.value === newInterval)?.autoTimeframe
    setSelectedInterval(newInterval)
    if (autoTimeframe) {
      setSelectedPeriod(autoTimeframe)
    }
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
    <div className="flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-5xl p-2 sm:p-4 space-y-4">
        <header className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <Select
            value={selectedIndexId.toString()}
            onValueChange={(value) => setSelectedIndexId(parseInt(value))}
          >
            <SelectTrigger className="w-full sm:w-48">
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

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-64 justify-start">
                {searchTerm || "Search stocks..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full sm:w-64 p-0">
              <Command>
                <CommandInput placeholder="Search stocks..." value={searchTerm} onValueChange={setSearchTerm} />
                <CommandEmpty>No stocks found.</CommandEmpty>
                <CommandGroup>
                  {stocks
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
                    ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </header>

        <main>
          {currentStock && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">{currentStock.symbol}</h2>
                    <p className="text-muted-foreground">{currentStock.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">₹{currentStock.price?.toFixed(2)}</p>
                    <p className={`text-sm ${currentStock.todayChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {currentStock.todayChange >= 0 ? '↑' : '↓'} {Math.abs(currentStock.todayChange?.toFixed(2))}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardContent className="p-0">
              <Chart data={chartData} />
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-2">
            {TIME_PERIODS.map((period) => (
              <Button
                key={period.label}
                variant={selectedPeriod === period.label ? "default" : "outline"}
                onClick={() => handlePeriodChange(period.label)}
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
          >
            Next <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </footer>
      </div>
    </div>
  )
                             }
