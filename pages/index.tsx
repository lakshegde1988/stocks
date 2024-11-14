'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, BarData, HistogramData, CrosshairMode } from 'lightweight-charts';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, X, Loader2 ,BarChart} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Import JSON data
import nifty50Data from '../public/nifty50.json';
import niftyNext50Data from '../public/niftynext50.json';
import midcap150Data from '../public/midcap150.json';
import smallcap250Data from '../public/smallcap250.json';
import microCap250Data from '../public/microcap250.json';


interface StockData {
  Symbol: string;
  "Company Name": string;
  Industry: string;
}

interface Stock {
  symbol: string;
  name: string;
  industry: string;
}

interface IndexData {
  label: string;
  data: StockData[];
}

interface CurrentStock extends Stock {
  price?: number;
  change?: number;
  todayChange?: number;
}

interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVALS = [
  { label: 'D', value: 'daily', interval: '1d', range: '1y' },
  { label: 'W', value: 'weekly', interval: '1wk', range: '5y' },
  { label: 'M', value: 'monthly', interval: '1mo', range: 'max' },
];

const chartColors = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  backgroundColor: '#f3f4f6',
  textColor: '#1f2937', // Darker text color for better visibility
  gridColor: '#e5e7eb',
  crosshairColor: '#9ca3af',
}

export default function Component() {
  const [selectedIndexId, setSelectedIndexId] = useState(0)
  const [currentStockIndex, setCurrentStockIndex] = useState(0)
  const [stocks, setStocks] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedInterval, setSelectedInterval] = useState('daily')
  const [currentStock, setCurrentStock] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const chartContainerRef = useRef(null)
  const chartInstanceRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    // Simulating stock data fetch
    setStocks(nifty50Data.map(item => ({
      symbol: item.Symbol,
      name: item["Company Name"],
      industry: item.Industry
    })))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (stocks.length > 0) {
      setCurrentStock(stocks[currentStockIndex])
    }
  }, [stocks, currentStockIndex])

  useEffect(() => {
    if (currentStock) {
      fetchStockData()
    }
  }, [currentStock, selectedInterval])

  const fetchStockData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Simulating API call
      const response = await new Promise(resolve => setTimeout(() => resolve({
        data: Array.from({ length: 30 }, (_, i) => ({
          time: `2023-${(i + 1).toString().padStart(2, '0')}-01`,
          open: Math.random() * 100 + 50,
          high: Math.random() * 100 + 60,
          low: Math.random() * 100 + 40,
          close: Math.random() * 100 + 50,
        }))
      }), 1000))

      setChartData(response.data)
      updateChart(response.data)
    } catch (err) {
      setError("Failed to fetch stock data")
    } finally {
      setLoading(false)
    }
  }

  const updateChart = (data) => {
    if (chartInstanceRef.current) {
      const series = chartInstanceRef.current.series()[0]
      series.setData(data)
      chartInstanceRef.current.timeScale().fitContent()
    }
  }

  useEffect(() => {
    if (chartContainerRef.current && chartData.length > 0) {
      const handleResize = () => {
        chartInstanceRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }

      chartInstanceRef.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { type: ColorType.Solid, color: chartColors.backgroundColor },
          textColor: chartColors.textColor,
        },
        grid: {
          vertLines: { color: chartColors.gridColor },
          horzLines: { color: chartColors.gridColor },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: chartColors.crosshairColor },
          horzLine: { color: chartColors.crosshairColor },
        },
        rightPriceScale: {
          borderColor: chartColors.gridColor,
        },
        timeScale: {
          borderColor: chartColors.gridColor,
          timeVisible: true,
          secondsVisible: false,
        },
      })

      const candlestickSeries = chartInstanceRef.current.addCandlestickSeries({
        upColor: chartColors.upColor,
        downColor: chartColors.downColor,
      })

      candlestickSeries.setData(chartData)

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        chartInstanceRef.current.remove()
      }
    }
  }, [chartData])

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

  const handleSearch = (term) => {
    setSearchTerm(term)
    if (term) {
      const filteredStocks = stocks.filter(stock => 
        stock.symbol.toLowerCase().includes(term.toLowerCase()) ||
        stock.name.toLowerCase().includes(term.toLowerCase())
      )
      if (filteredStocks.length > 0) {
        const index = stocks.findIndex(stock => stock.symbol === filteredStocks[0].symbol)
        setCurrentStockIndex(index)
        setShowDropdown(false)
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 text-gray-900">
      <header className="sticky top-0 z-10 bg-white shadow-md">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <BarChart className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                dotcharts
              </h1>
            </div>
            <div className="relative w-64" ref={searchRef}>
              <Input
                type="text"
                placeholder="Search stocks..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pr-8 text-sm h-10 bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500 rounded-full"
                aria-label="Search stocks"
              />
              {searchTerm ? (
                <X 
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 hover:text-gray-700 cursor-pointer" 
                  onClick={() => handleSearch('')}
                />
              ) : (
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-grow">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <nav className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
            <Select 
              value={selectedIndexId.toString()} 
              onValueChange={(value) => setSelectedIndexId(parseInt(value))}
            >
              <SelectTrigger className="w-[180px] text-sm bg-gray-100 border-gray-300 text-gray-900 rounded-md">
                <SelectValue placeholder="Select Index" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300 text-gray-900">
                {[{ label: 'Nifty 50' }].map((item, index) => (
                  <SelectItem key={index} value={index.toString()} className="text-sm">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex space-x-2">
              {INTERVALS.map((interval) => (
                <Button
                  key={interval.value}
                  variant={selectedInterval === interval.value ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setSelectedInterval(interval.value)}
                  className={`text-xs px-3 py-1 rounded-full ${
                    selectedInterval === interval.value
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {interval.label}
                </Button>
              ))}
            </div>
          </nav>

          <main className="space-y-6">
            {currentStock && (
              <Card className="border-gray-200 bg-white overflow-hidden shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{currentStock.symbol}</h2>
                      <p className="text-sm text-gray-600">{currentStock.name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">
                        {chartData.length > 0 ? chartData[chartData.length - 1].close.toFixed(2) : 'N/A'}
                      </div>
                      <Badge 
                        variant={chartData.length > 1 && chartData[chartData.length - 1].close > chartData[chartData.length - 2].close ? "default" : "destructive"}
                        className={`text-sm mt-1 ${
                          chartData.length > 1 && chartData[chartData.length - 1].close > chartData[chartData.length - 2].close
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {chartData.length > 1 ? (
                          chartData[chartData.length - 1].close > chartData[chartData.length - 2].close ? '↑' : '↓'
                        ) : ''} 
                        {chartData.length > 1 
                          ? ((chartData[chartData.length - 1].close - chartData[chartData.length - 2].close) / chartData[chartData.length - 2].close * 100).toFixed(2)
                          : 0
                        }%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-gray-200 bg-white shadow-sm">
              <CardContent className="p-0 sm:p-2">
                {loading ? (
                  <div className="h-[500px] flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                    <p className="text-sm text-gray-600">Loading stock data...</p>
                  </div>
                ) : error ? (
                  <div className="h-[500px] flex flex-col items-center justify-center">
                    <div className="text-red-600 text-sm mb-2">{error}</div>
                    <p className="text-xs text-gray-600">Please try again later or select a different stock.</p>
                  </div>
                ) : (
                  <div ref={chartContainerRef} className="h-[500px]" />
                )}
              </CardContent>
            </Card>
          </main>

          <footer className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStockIndex === 0}
              className="h-10 px-4 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            
            <span className="text-sm text-gray-600">
              <span className="font-medium">{currentStockIndex + 1}</span>
              <span className="mx-1">/</span>
              <span>{stocks.length}</span>
            </span>
            
            <Button
              variant="ghost"
              onClick={handleNext}
              disabled={currentStockIndex === stocks.length - 1}
              className="h-10 px-4 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          </footer>
        </div>
      </div>
    </div>
  )
}
