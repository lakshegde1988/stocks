'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, BarData, HistogramData, CrosshairMode } from 'lightweight-charts';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, X, Loader2 } from 'lucide-react';

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
  upColor: '#3366cc',
  downColor: '#e0407d',
  backgroundColor: '#0f172a',
  textColor: '#94a3b8',
  borderColor: '#1e293b',
  gridColor: '#1e293b',
  crosshairColor: '#475569',
  barColors: ['#3366cc', '#e0407d'],
};

export default function Component() {
  const [indexData] = useState<IndexData[]>([
    { label: 'Nifty 50', data: nifty50Data },
    { label: 'Nifty Next 50', data: niftyNext50Data },
    { label: 'Midcap 150', data: midcap150Data },
    { label: 'Smallcap 250', data: smallcap250Data },
    { label: 'MicroCap 250', data: microCap250Data },
  ]);
  
  const [selectedIndexId, setSelectedIndexId] = useState(0);
  const [currentStockIndex, setCurrentStockIndex] = useState(0);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [currentStock, setCurrentStock] = useState<CurrentStock | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [stockStats, setStockStats] = useState({
    dayHigh: 0,
    dayLow: 0,
    volume: 0,
    avgVolume: 0,
  });
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const barSeriesRef = useRef<ISeriesApi<"Bar"> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const getChartHeight = useCallback(() => {
    return window.innerWidth < 640 ? 420 : window.innerWidth < 1024 ? 500 : 600;
  }, []);

  useEffect(() => {
    const selectedIndex = indexData[selectedIndexId];
    const stocksList = selectedIndex.data.map(item => ({
      symbol: item.Symbol,
      name: item["Company Name"],
      industry: item.Industry
    }));
    setStocks(stocksList);
    setCurrentStockIndex(0);
  }, [selectedIndexId, indexData]);

  const fetchStockData = useCallback(async () => {
    if (!stocks.length) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const currentStock = stocks[currentStockIndex];
      const interval = INTERVALS.find(i => i.value === selectedInterval);

      if (!interval) throw new Error('Invalid interval');

      const response = await axios.get<ChartDataPoint[]>('/api/stockData', {
        params: {
          symbol: currentStock.symbol,
          range: interval.range,
          interval: interval.interval
        }
      });

      if (response.data && Array.isArray(response.data)) {
        setChartData(response.data);
        setCurrentStock({
          ...currentStock,
          price: response.data[response.data.length - 1]?.close,
          change: ((response.data[response.data.length - 1]?.close - response.data[0]?.open) / response.data[0]?.open) * 100,
          todayChange: ((response.data[response.data.length - 1]?.close - response.data[response.data.length - 2]?.close) / response.data[response.data.length - 2]?.close) * 100
        });
        setStockStats({
          dayHigh: Math.max(...response.data.map(d => d.high)),
          dayLow: Math.min(...response.data.map(d => d.low)),
          volume: response.data[response.data.length - 1]?.volume || 0,
          avgVolume: response.data.reduce((sum, d) => sum + d.volume, 0) / response.data.length,
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }, [stocks, currentStockIndex, selectedInterval]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData.length) return;

    const handleResize = () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current!.clientWidth,
          height: getChartHeight(),
        });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: getChartHeight(),
      layout: {
        background: { type: ColorType.Solid, color: chartColors.backgroundColor },
        textColor: chartColors.textColor,
      },
      grid: {
        vertLines: { visible:false },
        horzLines: { visible:false },
      },
      rightPriceScale: {
        borderColor: chartColors.borderColor,
      },
      timeScale: {
        borderColor: chartColors.borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        minBarSpacing: 3,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: chartColors.crosshairColor,
          labelBackgroundColor: chartColors.backgroundColor,
        },
        horzLine: {
          color: chartColors.crosshairColor,
          labelBackgroundColor: chartColors.backgroundColor,
        },
      },
    });

    chartInstanceRef.current = chart;

    const barSeries = chart.addBarSeries({
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      thinBars: false,
    });

    barSeriesRef.current = barSeries;
    barSeries.setData(chartData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    } as BarData)));

    barSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      },
    });
    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData, getChartHeight]);

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
  };

  const handlePrevious = () => {
    if (currentStockIndex > 0) {
      setCurrentStockIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentStockIndex < stocks.length - 1) {
      setCurrentStockIndex(prev => prev + 1);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStocks = stocks.filter(stock => 
    searchTerm && (
      stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ).slice(0, 10);

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a] text-slate-200">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <nav className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">dotcharts</h1>
            <div className="relative w-48" ref={searchRef}>
              <Input
                type="text"
                placeholder="Search stocks..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                className="pr-8 text-sm h-9 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                aria-label="Search stocks"
              />
              {searchTerm ? (
                <X 
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-white cursor-pointer" 
                  onClick={() => {
                    setSearchTerm('');
                    setShowDropdown(false);
                  }}
                />
              ) : (
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              )}

              {showDropdown && searchTerm && (
                <div className="absolute w-full mt-1 py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                  {filteredStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => {
                        const stockIndex = stocks.findIndex(s => s.symbol === stock.symbol);
                        setCurrentStockIndex(stockIndex);
                        setSearchTerm('');
                        setShowDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-700 transition-colors"
                    >
                      <div className="font-medium text-xs text-white">{stock.symbol}</div>
                      <div className="text-xs text-slate-400 truncate">{stock.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>

        <header className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Select 
              value={selectedIndexId.toString()} 
              onValueChange={(value) => setSelectedIndexId(parseInt(value))}
            >
              <SelectTrigger className="w-[140px] text-sm bg-slate-700/50 border-slate-600 text-white">
                <SelectValue placeholder="Select Index" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                {indexData.map((item, index) => (
                  <SelectItem key={index} value={index.toString()} className="text-sm">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex space-x-1">
              {INTERVALS.map((interval) => (
                <Button
                  key={interval.value}
                  variant={selectedInterval === interval.value ? "default" : "secondary"}
                  size="sm"
                  onClick={() => handleIntervalChange(interval.value)}
                  className={`text-xs px-2 h-7 ${
                    selectedInterval === interval.value
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {interval.label}
                </Button>
              ))}
            </div>
          </div>
        </header>

        <main className="space-y-4 bg-slate-800/50">
          {currentStock && (
            <div className="grid grid-cols-1">
              <Card className="border-slate-700 bg-slate-800/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold truncate text-white">{currentStock.symbol}</h2>
                      <p className="text-sm text-slate-400 truncate">
                        {currentStock.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end ml-4">
                      <div className="text-lg font-semibold text-white">{currentStock.price?.toFixed(2)}</div>
                      <Badge 
                        variant={currentStock.todayChange && currentStock.todayChange >= 0 ? "default" : "destructive"}
                        className={`text-xs mt-1 ${
                          currentStock.todayChange && currentStock.todayChange >= 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {currentStock.todayChange && currentStock.todayChange >= 0 ? '↑' : '↓'} {Math.abs(currentStock.todayChange || 0).toFixed(2)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="bg-slate-800/50">
            <CardContent className="p-0 sm:p-2">
              {loading ? (
                <div className="h-[600px] flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-2" />
                  <p className="text-sm text-slate-400">Loading stock data...</p>
                </div>
              ) : error ? (
                <div className="h-[600px] flex flex-col items-center justify-center">
                  <div className="text-rose-500 text-sm mb-2">{error}</div>
                  <p className="text-xs text-slate-400">Please try again later or select a different stock.</p>
                </div>
              ) : (
                <div ref={chartContainerRef} className="h-[600px]" />
              )}
            </CardContent>
          </Card>
        </main>

        <footer className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStockIndex === 0}
              className="h-8 px-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
            
            <span className="text-sm text-slate-300">
              <span className="font-medium">{currentStockIndex + 1}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-slate-500">{stocks.length}</span>
            </span>
            
            <Button
              variant="ghost"
              onClick={handleNext}
              disabled={currentStockIndex === stocks.length - 1}
              className="h-8 px-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
