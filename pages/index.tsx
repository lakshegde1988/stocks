'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, HistogramData } from 'lightweight-charts';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, X, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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

const getCssVariableColor = (variableName: string): string => {
  if (typeof window === 'undefined') return '#000000';
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const cssVariable = computedStyle.getPropertyValue(variableName).trim();
  
  if (cssVariable.startsWith('#') || cssVariable.startsWith('rgb')) {
    return cssVariable;
  }
  
  const cssValues = cssVariable.split(',').map(v => v.trim());
  if (cssValues.length === 3 && cssValues.every(v => !isNaN(Number(v)))) {
    return `hsl(${cssValues.join(',')})`;
  }
  
  const fallbacks: Record<string, string> = {
    '--background': '#ffffff',
    '--foreground': '#000000',
    '--border': '#e5e7eb',
    '--success': '#089981',
    '--destructive': '#ef4444',
  };
  
  return fallbacks[variableName] || '#000000';
};

const chartColors = {
  upColor: getCssVariableColor('--success'),
  downColor: getCssVariableColor('--destructive'),
  backgroundColor: getCssVariableColor('--background'),
  textColor: getCssVariableColor('--foreground'),
  borderColor: getCssVariableColor('--border'),
};

export default function StockChart() {
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
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const getChartHeight = useCallback(() => {
    return window.innerWidth < 640 ? 550 : window.innerWidth < 1024 ? 350 : 650;
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
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        borderColor: chartColors.borderColor,
      },
      timeScale: {
        borderColor: chartColors.borderColor,
        timeVisible: false,
        rightOffset: 5,
        minBarSpacing: 3,
      },
    });

    chartInstanceRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      borderVisible: false,
      wickUpColor: chartColors.upColor,
      wickDownColor: chartColors.downColor,
    });

    candlestickSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: chartColors.upColor,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeriesRef.current = volumeSeries;

    candlestickSeries.setData(chartData as CandlestickData[]);
    volumeSeries.setData(chartData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? chartColors.upColor : chartColors.downColor,
    } as HistogramData)));

    candlestickSeries.priceScale().applyOptions({
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

  return (
    <div className="flex flex-col	max-w-screen max-w-6xl mx-auto w-full flex justify-between items-center min-h-screen bg-background text-foreground">
      <nav className="top-0 z-20 bg-background border-b border-slate-200/5">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">dotcharts</h1>
            <div className="relative w-48" ref={searchRef}>
              <Input
                type="text"
                placeholder="Search stocks..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                className="pr-8 text-sm h-9"
                aria-label="Search stocks"
              />
              {searchTerm ? (
                <X 
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" 
                  onClick={() => {
                    setSearchTerm('');
                    setShowDropdown(false);
                  }}
                />
              ) : (
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}

              {showDropdown && searchTerm && (
                <div className="absolute w-full mt-1 py-1 bg-background border border-slate-200/5 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                  {filteredStocks.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => {
                        const stockIndex = stocks.findIndex(s => s.symbol === stock.symbol);
                        setCurrentStockIndex(stockIndex);
                        setSearchTerm('');
                        setShowDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-medium text-xs">{stock.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{stock.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <header className="top-[57px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-slate-200/5">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <Select 
              value={selectedIndexId.toString()} 
              onValueChange={(value) => setSelectedIndexId(parseInt(value))}
            >
              <SelectTrigger className="w-[140px] text-sm bg-background">
                <SelectValue placeholder="Select Index" />
              </SelectTrigger>
              <SelectContent>
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
                  className="text-xs px-2 h-7"
                  title={`Show ${interval.label === 'D' ? 'Daily' : interval.label === 'W' ? 'Weekly' : 'Monthly'} data`}
                >
                  {interval.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 sticky container mx-auto px-4 py-4">
        {currentStock && (
         <Card className="mb-4 border border-slate-200/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold truncate">{currentStock.symbol}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {currentStock.name}
                </p>
              </div>
              <div className="flex flex-col items-end ml-4">
                <div className="text-lg font-semibold">{currentStock.price?.toFixed(2)}</div>
                <Badge 
                  variant={currentStock.todayChange && currentStock.todayChange >= 0 ? "default" : "destructive"}
                  className="text-xs mt-1"
                >
                  {currentStock.todayChange && currentStock.todayChange >= 0 ? '↑' : '↓'} {Math.abs(currentStock.todayChange || 0).toFixed(2)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        <Card className="mb-4 border border-slate-200/5">
          <CardContent className="p-0">
            {loading ? (
              <div className="h-[600px] sm:h-[550px] md:h-[600px] flex flex-col items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Loading stock data...</p>
              </div>
            ) : error ? (
              <div className="h-[600px] sm:h-[550px] md:h-[600px] flex flex-col items-center justify-center">
                <div className="text-destructive text-sm mb-2">{error}</div>
                <p className="text-xs text-muted-foreground">Please try again later or select a different stock.</p>
              </div>
            ) : (
              <div ref={chartContainerRef} className="h-[600px] sm:h-[550px] md:h-[600px]" />
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-slate-200/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStockIndex === 0}
              className="h-8 px-2 text-sm"
              aria-label="Previous stock"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
            
            <span className="text-xs">
              <span className="font-medium">{currentStockIndex + 1}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-muted-foreground">{stocks.length}</span>
            </span>
            
            <Button
              variant="ghost"
              onClick={handleNext}
              disabled={currentStockIndex === stocks.length - 1}
              className="h-8 px-2 text-sm"
              aria-label="Next stock"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
