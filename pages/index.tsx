'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, BarData, HistogramData } from 'lightweight-charts';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, X, Loader2, Maximize2, Star, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WatchlistModal } from '../components/WatchlistModal';

import nifty50Data from '../public/nifty50.json';
import niftyNext50Data from '../public/niftynext50.json';
import midcap150Data from '../public/midcap150.json';
import smallcap250Data from '../public/smallcap250.json';
import microCap250Data from '../public/microcap250.json';
import othersData from '../public/others.json';

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

const getChartColors = () => ({
  backgroundColor: '#0f172a', // slate-900
  textColor: '#e2e8f0', // slate-200
  upColor: '#10b981', // emerald-500
  downColor: '#ef4444', // red-500
  borderColor: '#334155', // slate-700
});

export default function StockChart() {
  const [indexData] = useState<IndexData[]>([
    { label: 'Nifty 50', data: nifty50Data },
    { label: 'Nifty Next 50', data: niftyNext50Data },
    { label: 'Midcap 150', data: midcap150Data },
    { label: 'Smallcap 250', data: smallcap250Data },
    { label: 'MicroCap 250', data: microCap250Data },
    { label: 'Others', data: othersData },
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
  const [watchlist, setWatchlist] = useState<{ stock_name: string }[]>([]);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const barSeriesRef = useRef<ISeriesApi<"Bar"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const getChartHeight = useCallback(() => {
    return window.innerWidth < 640 ? 300 : window.innerWidth < 1024 ? 400 : 600;
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
        vertLines: { color: chartColors.borderColor },
        horzLines: { color: chartColors.borderColor },
      },
      rightPriceScale: {
        borderColor: chartColors.borderColor,
        mode: 1, // 0 is linear (default), 1 is logarithmic
      },
      timeScale: {
        borderColor: chartColors.borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    const barSeries = chart.addBarSeries({
      upColor: chartColors.upColor,
      downColor: chartColors.downColor,
      priceScaleId: 'right',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    barSeriesRef.current = barSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: chartColors.upColor,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeriesRef.current = volumeSeries;

    barSeries.setData(chartData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    } as BarData)));

    volumeSeries.setData(chartData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? chartColors.upColor : chartColors.downColor,
    } as HistogramData)));

    barSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      },
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
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

  const handleFullScreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if ((document.documentElement as any).webkitRequestFullscreen) { // Safari
      (document.documentElement as any).webkitRequestFullscreen();
    }
  };

  const toggleWatchlist = async (stock: Stock) => {
    try {
      if (watchlist.some(item => item.stock_name === stock.symbol)) {
        await axios.delete('/api/watchlist', { data: { stock_name: stock.symbol } });
        setWatchlist(prev => prev.filter(item => item.stock_name !== stock.symbol));
      } else {
        await axios.post('/api/watchlist', { stock_name: stock.symbol });
        setWatchlist(prev => [...prev, { stock_name: stock.symbol }]);
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    try {
      await axios.delete('/api/watchlist', { data: { stock_name: symbol } });
      setWatchlist(prev => prev.filter(item => item.stock_name !== symbol));
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
    }
  };

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const response = await axios.get('/api/watchlist');
        setWatchlist(response.data.watchlist);
      } catch (error) {
        console.error('Failed to fetch watchlist:', error);
      }
    };

    fetchWatchlist();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-slate-800/80 backdrop-blur-sm p-2 sm:p-4 border-b border-slate-700">
        <div className="text-lg font-bold text-emerald-500">dotChart</div>
        <div className="flex items-center space-x-2">
          <div className="relative hidden sm:block" ref={searchRef}>
            <Input
              type="text"
              placeholder="Search stocks..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              className="w-64 pr-8 text-sm h-9 bg-slate-700 text-slate-200 border-slate-600 focus:border-emerald-500"
              aria-label="Search stocks"
            />
            {searchTerm ? (
              <X
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-slate-200 cursor-pointer"
                onClick={() => {
                  setSearchTerm('');
                  setShowDropdown(false);
                }}
              />
            ) : (
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            )}
            {showDropdown && searchTerm && (
              <div className="absolute w-full mt-1 py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50 left-0">
                {filteredStocks.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => {
                      const stockIndex = stocks.findIndex((s) => s.symbol === stock.symbol);
                      setCurrentStockIndex(stockIndex);
                      setSearchTerm('');
                      setShowDropdown(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700 transition-colors"
                  >
                    <div className="font-medium text-sm">{stock.symbol}</div>
                    <div className="text-sm text-slate-400 truncate">{stock.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-200 hover:text-emerald-500 hover:bg-slate-700"
            onClick={handleFullScreen}
          >
            <Maximize2 className="h-5 w-5" />
            <span className="sr-only">Full Screen</span>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:hidden text-slate-200 hover:text-emerald-500 hover:bg-slate-700">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-slate-800 border-l border-slate-700">
              <SheetHeader>
                <SheetTitle className="text-slate-200">Menu</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="mobile-search" className="text-sm font-medium text-slate-200">Search Stocks</label>
                  <Input
                    id="mobile-search"
                    type="text"
                    placeholder="Search stocks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 border-slate-600 focus:border-emerald-500"
                  />
                </div>
                {searchTerm && (
                  <div className="space-y-2">
                    {filteredStocks.map((stock) => (
                      <button
                        key={stock.symbol}
                        onClick={() => {
                          const stockIndex = stocks.findIndex((s) => s.symbol === stock.symbol);
                          setCurrentStockIndex(stockIndex);
                          setSearchTerm('');
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors rounded-md"
                      >
                        <div className="font-medium text-sm">{stock.symbol}</div>
                        <div className="text-sm text-slate-400 truncate">{stock.name}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="mobile-index" className="text-sm font-medium text-slate-200">Select Index</label>
                  <Select
                    value={selectedIndexId.toString()}
                    onValueChange={(value) => setSelectedIndexId(parseInt(value))}
                  >
                    <SelectTrigger id="mobile-index" className="w-full bg-slate-700 border-slate-600 text-slate-200">
                      <SelectValue placeholder="Select Index" />
                    </SelectTrigger>
                    <SelectContent>
                      {indexData.map((item, index) => (
                        <SelectItem key={index} value={index.toString()} className="text-slate-200 hover:bg-slate-700">
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="mobile-interval" className="text-sm font-medium text-slate-200">Select Interval</label>
                  <Select
                    value={selectedInterval}
                    onValueChange={(value) => setSelectedInterval(value)}
                  >
                    <SelectTrigger id="mobile-interval" className="w-full bg-slate-700 border-slate-600 text-slate-200">
                      <SelectValue placeholder="Select Interval" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVALS.map((interval) => (
                        <SelectItem key={interval.value} value={interval.value} className="text-slate-200 hover:bg-slate-700">
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsWatchlistOpen(true)}
                  className="w-full bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
                >
                  Open Watchlist
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <main className="flex-1 relative overflow-hidden">
        {/* Stock Info Overlay */}
        {currentStock && (
          <div className="absolute top-2 left-2 z-10 bg-slate-800/80 backdrop-blur-sm p-2 rounded-lg">
            <div className="flex items-center gap-2">
              <h4 className="text-md font-bold text-emerald-500">{currentStock.name.toUpperCase()}</h4>
              <Button
                variant="ghost"
                size="sm"
                className="p-0"
                onClick={() => toggleWatchlist(currentStock)}
              >
                <Star
                  className={`h-4 w-4 ${
                    watchlist.some(item => item.stock_name === currentStock.symbol)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-slate-400'
                  }`}
                />
              </Button>
            </div>
            <h5 className="text-sm font-light text-slate-400">NSE:{currentStock.symbol.toUpperCase()}</h5>

            <div className="text-sm">
              <span className={`text-[14px] font-medium ${
                currentStock.todayChange && currentStock.todayChange >= 0 ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {currentStock.price?.toFixed(2)}
              </span>
              <span className={`text-[14px] ml-1 ${
                currentStock.todayChange && currentStock.todayChange >= 0 ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {currentStock.todayChange && currentStock.todayChange >= 0 ? '↑' : '↓'} {Math.abs(currentStock.todayChange || 0).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div className="h-full" ref={chartContainerRef}></div>
      </main>

      {/* Sticky Footer */}
      <footer className="sticky bottom-0 w-full bg-slate-800/80 backdrop-blur supports-[backdrop-filter]:bg-slate-800/60 border-t border-slate-700">
        <div className="mx-auto px-2 sm:px-4">
          <div className="flex justify-between items-center py-2 sm:py-4">
            <div className="hidden sm:flex items-center space-x-2">
              <Select
                value={selectedIndexId.toString()}
                onValueChange={(value) => setSelectedIndexId(parseInt(value))}
              >
                <SelectTrigger className="h-9 text-sm bg-slate-700 border-slate-600 text-slate-200 w-36">
                  <SelectValue placeholder="Select Index" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {indexData.map((item, index) => (
                    <SelectItem key={index} value={index.toString()} className="text-sm hover:bg-slate-700">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedInterval}
                onValueChange={(value) => setSelectedInterval(value)}
              >
                <SelectTrigger className="w-28 h-9 text-sm bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {INTERVALS.map((interval) => (
                    <SelectItem key={interval.value} value={interval.value} className="text-sm hover:bg-slate-700">
                      {interval.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setIsWatchlistOpen(true)}
                className="h-9 text-sm bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
              >
                Watchlist
              </Button>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStockIndex === 0}
                className="h-9 px-2 sm:px-3 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Prev</span>
              </Button>

              <div className="flex items-center justify-center min-w-[60px] sm:min-w-[80px]">
                <span className="text-sm sm:text-base text-slate-400 whitespace-nowrap">
                  <span className="font-medium">{currentStockIndex + 1}</span>
                  <span className="text-slate-500 mx-1">/</span>
                  <span className="text-slate-500">{stocks.length}</span>
                </span>
              </div>

              <Button
                variant="ghost"
                onClick={handleNext}
                disabled={currentStockIndex === stocks.length - 1}
                className="h-9 px-2 sm:px-3 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              >
                <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </footer>
      <WatchlistModal
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        watchlist={watchlist}
        onRemoveFromWatchlist={removeFromWatchlist}
      />
    </div>
  );
}

