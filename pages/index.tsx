'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, BarData, HistogramData } from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, X, Maximize2, Star, Menu, TrendingUp, Calendar, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchlistModal } from '../components/WatchlistModal';

import nifty50Data from '../public/nifty50.json';
import niftyNext50Data from '../public/niftynext50.json';
import midcap150Data from '../public/midcap150.json';
import smallcap250Data from '../public/smallcap250.json';
import microCap250Data from '../public/microcap250.json';
import others350Data from '../public/others.json';

interface StockData {
  Symbol: string;
  "Company Name": string;
}

interface Stock {
  symbol: string;
  name: string;
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
  { label: 'D', value: 'daily', interval: '1d', range: '2y' },
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

const getChartColors = () => ({
  backgroundColor: '#020617', // slate-950
  textColor: '#e2e8f0', // slate-200
  upColor: '#10b981', // emerald-500
  downColor: '#ef4444', // red-500
  borderColor: '#1e293b', // slate-800
});

const swipeHandlers = useSwipeable({
  onSwipedLeft: () => handleNext(),
  onSwipedRight: () => handlePrevious(),
  preventDefaultTouchmoveEvent: true,
  trackMouse: true
});

export default function StockChart() {
  const [indexData] = useState<IndexData[]>([
    { label: 'Nifty 50', data: nifty50Data },
    { label: 'Nifty Next 50', data: niftyNext50Data },
    { label: 'Midcap 150', data: midcap150Data },
    { label: 'Smallcap 250', data: smallcap250Data },
    { label: 'MicroCap 250', data: microCap250Data },
    { label: 'Others 350', data: others350Data },
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
  const [watchlist, setWatchlist] = useState<{ symbol: string; name: string }[]>([]);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  const getChartHeight = useCallback(() => {
    return window.innerWidth < 640 ? 700 : window.innerWidth < 1024 ? 320 : 800;
  }, []);

  useEffect(() => {
    const selectedIndex = indexData[selectedIndexId];
    const stocksList = selectedIndex.data.map(item => ({
      symbol: item.Symbol,
      name: item["Company Name"]
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

    const chartColors = getChartColors();

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
        rightOffset: 10,
        minBarSpacing: 2,
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
      },
      mode: 1,
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
  }, [chartData, getChartHeight, theme]);

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

  const handleFullScreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if ((document.documentElement as any).webkitRequestFullscreen) { // Safari
      (document.documentElement as any).webkitRequestFullscreen();
    }
  };

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const toggleWatchlist = (stock: Stock) => {
    setWatchlist(prev => {
      const isInWatchlist = prev.some(item => item.symbol === stock.symbol);
      if (isInWatchlist) {
        return prev.filter(item => item.symbol !== stock.symbol);
      } else {
        return [...prev, { symbol: stock.symbol, name: stock.name }];
      }
    });
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
  };

  if (!mounted) return null

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200" {...swipeHandlers}>
      {/* Floating Action Button for Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-6 right-4 z-50 h-12 w-12 rounded-full bg-emerald-500 text-white border-0 shadow-lg hover:bg-emerald-600 sm:hidden"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl px-4">
          <div className="pt-6 pb-4">
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="w-full bg-slate-800 p-1 rounded-xl">
                <TabsTrigger value="search" className="w-1/3">Search</TabsTrigger>
                <TabsTrigger value="indexes" className="w-1/3">Indexes</TabsTrigger>
                <TabsTrigger value="watchlist" className="w-1/3">Watchlist</TabsTrigger>
              </TabsList>
              <TabsContent value="search" className="mt-4">
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Search stocks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border-slate-700 text-slate-200 h-12 rounded-xl"
                  />
                  <motion.div layout className="space-y-2">
                    <AnimatePresence>
                      {filteredStocks.map((stock) => (
                        <motion.button
                          key={stock.symbol}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          onClick={() => {
                            const stockIndex = stocks.findIndex((s) => s.symbol === stock.symbol);
                            setCurrentStockIndex(stockIndex);
                            setSearchTerm('');
                          }}
                          className="w-full p-4 text-left bg-slate-800 hover:bg-slate-700 transition-colors rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{stock.symbol}</div>
                            <div className="text-sm text-slate-400 truncate">{stock.name}</div>
                          </div>
                          <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </TabsContent>
              <TabsContent value="indexes" className="mt-4">
                <div className="grid gap-3">
                  {indexData.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedIndexId(index)}
                      className={`w-full p-4 text-left rounded-xl transition-all ${
                        selectedIndexId === index
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.label}</span>
                        <TrendingUp className={`h-5 w-5 ${
                          selectedIndexId === index ? 'text-white' : 'text-emerald-500'
                        }`} />
                      </div>
                      <div className="text-sm mt-1 opacity-80">
                        {item.data.length} stocks
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="watchlist" className="mt-4">
                <div className="space-y-3">
                  {watchlist.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Your watchlist is empty</p>
                    </div>
                  ) : (
                    watchlist.map((stock) => (
                      <div
                        key={stock.stock_name}
                        className="flex items-center justify-between p-4 bg-slate-800 rounded-xl"
                      >
                        <span className="font-medium">{stock.stock_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromWatchlist(stock.stock_name)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 relative">
        {/* Stock Info Header */}
        {currentStock && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-slate-950 via-slate-950/95 to-transparent p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-emerald-500">
                    {currentStock.symbol}
                  </h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0"
                    onClick={() => toggleWatchlist(currentStock)}
                  >
                    <Star
                      className={`h-5 w-5 ${
                        watchlist.some(item => item.stock_name === currentStock.symbol)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-slate-400'
                      }`}
                    />
                  </Button>
                </div>
                <h2 className="text-sm text-slate-400 mt-0.5">{currentStock.name}</h2>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  ₹{currentStock.price?.toFixed(2)}
                </div>
                <div className={`flex items-center justify-end gap-1 ${
                  currentStock.todayChange && currentStock.todayChange >= 0
                    ? 'text-emerald-500'
                    : 'text-red-500'
                }`}>
                  {currentStock.todayChange && currentStock.todayChange >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(currentStock.todayChange || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Time Controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <Select
                  value={selectedInterval}
                  onValueChange={setSelectedInterval}
                >
                  <SelectTrigger className="w-28 h-8 text-sm bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((interval) => (
                      <SelectItem key={interval.value} value={interval.value}>
                        {interval.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400"
                onClick={handleFullScreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Chart Container */}
        <div className="h-full pt-32" ref={chartContainerRef} />

        {/* Navigation Pills */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 bg-slate-800/90 backdrop-blur-sm rounded-full">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            disabled={currentStockIndex === 0}
            className="h-8 w-8 text-slate-400 hover:text-white disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center justify-center min-w-[60px]">
            <span className="text-sm font-medium">
              {currentStockIndex + 1}/{stocks.length}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={currentStockIndex === stocks.length - 1}
            className="h-8 w-8 text-slate-400 hover:text-white disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </main>

      <WatchlistModal
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        watchlist={watchlist}
        onRemoveFromWatchlist={removeFromWatchlist}
      />
    </div>
  );
}
