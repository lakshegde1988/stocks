'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Search, X, Loader2, TrendingUp, ChevronDown, Check } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import nifty50Data from '/public/nifty50.json';
import niftyNext50Data from '/public/niftynext50.json';
import midcap150Data from '/public/midcap150.json';
import smallcap250Data from '/public/smallcap250.json';
import microCap250Data from '/public/microcap250.json';

const getComputedColor = (cssVariable) => {
  if (typeof window === 'undefined') return '#000000';
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue(cssVariable).trim() || '#000000';
};

const IndexSelector = ({ selectedIndex, onIndexChange, indexData }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-52 justify-between font-normal"
        >
          {indexData[selectedIndex]?.label ?? "Select Index"}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0">
        <Command>
          <CommandGroup>
            {indexData.map((item, index) => (
              <CommandItem
                key={index}
                onSelect={() => {
                  onIndexChange(index);
                  setOpen(false);
                }}
                className="flex items-center justify-between px-4 py-2 cursor-pointer"
              >
                <span className={selectedIndex === index ? "font-medium" : ""}>{item.label}</span>
                {selectedIndex === index && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const TIME_PERIODS = [
  { label: '1Y', range: '1y', autoInterval: 'daily' },
  { label: '5Y', range: '5y', autoInterval: 'weekly' },
  { label: 'MAX', range: 'max', autoInterval: 'monthly' },
];

const INTERVALS = [
  { label: 'D', value: 'daily', interval: '1d', autoTimeframe: '1Y' },
  { label: 'W', value: 'weekly', interval: '1wk', autoTimeframe: '5Y' },
  { label: 'M', value: 'monthly', interval: '1mo', autoTimeframe: 'Max' },
];

const AnimatedNumber = ({ value, decimals = 2 }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  return (
    <span className="tabular-nums transition-all duration-500">
      {typeof displayValue === 'number' ? displayValue.toFixed(decimals) : '-.--'}
    </span>
  );
};

// Utility function to get color value
const getColorValue = (variableName, fallback) => {
  if (typeof window !== 'undefined') {
    const bodyStyles = window.getComputedStyle(document.body);
    return bodyStyles.getPropertyValue(variableName).trim() || fallback;
  }
  return fallback;
};

const StockChart = () => {
  const [indexData] = useState([
    { label: 'Nifty 50', data: nifty50Data },
    { label: 'Nifty Next 50', data: niftyNext50Data },
    { label: 'Midcap 150', data: midcap150Data },
    { label: 'Smallcap 250', data: smallcap250Data },
    { label: 'MicroCap 250', data: microCap250Data },
  ]);
  
  const [selectedIndexId, setSelectedIndexId] = useState(0);
  const [currentStockIndex, setCurrentStockIndex] = useState(0);
  const [stocks, setStocks] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [currentStock, setCurrentStock] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const searchRef = useRef(null);

  const getChartHeight = useCallback(() => {
    return window.innerWidth < 768 ? 500 : 600;
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
      const period = TIME_PERIODS.find(p => p.label === selectedPeriod);
      const interval = INTERVALS.find(i => i.value === selectedInterval);

      const response = await axios.get('/api/stockData', {
        params: {
          symbol: currentStock.symbol,
          range: period.range,
          interval: interval.interval
        }
      });

      if (response.data && Array.isArray(response.data)) {
        setChartData(response.data);
        setCurrentStock({
          name: currentStock.name,
          symbol: currentStock.symbol,
          industry: currentStock.industry,
          price: response.data[response.data.length - 1]?.close,
          volume: response.data[response.data.length - 1]?.volume,
          change: ((response.data[response.data.length - 1]?.close - response.data[0]?.open) / response.data[0]?.open) * 100,
          todayChange: ((response.data[response.data.length - 1]?.close - response.data[response.data.length - 2]?.close) / response.data[response.data.length - 2]?.close) * 100
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  }, [stocks, currentStockIndex, selectedPeriod, selectedInterval]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData.length) return;

    const backgroundColor = getComputedColor('--background');
    const textColor = getComputedColor('--foreground');
    const successColor = getComputedColor('--success');
    const destructiveColor = getComputedColor('--destructive');
    
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: getChartHeight(),
      layout: {
        background: { 
          type: 'solid', 
          color: backgroundColor 
        },
        textColor: textColor,
      },
      crosshair: { 
        mode: CrosshairMode.Normal,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      timeScale: {
        timezone: 'Asia/Kolkata',
        timeVisible: true,
        rightOffset: 5,
        minBarSpacing: 10,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      }
      
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: successColor,
      downColor: destructiveColor,
      borderUpColor: successColor,
      borderDownColor: destructiveColor,
      wickUpColor: successColor,
      wickDownColor: destructiveColor,
    });

    candlestickSeries.setData(chartData);

    const volumeSeries = chart.addHistogramSeries({
      color: successColor,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    volumeSeries.setData(
      chartData.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? successColor : destructiveColor,
      }))
    );

    chart.timeScale().fitContent();

    chartInstanceRef.current = chart;

    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: getChartHeight(),
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData, getChartHeight]);

  const handlePeriodChange = (newPeriod) => {
    setSelectedPeriod(newPeriod);
    const autoInterval = TIME_PERIODS.find((p) => p.label === newPeriod)?.autoInterval;
    if (autoInterval) {
      setSelectedInterval(autoInterval);
    }
  };

  const handleIntervalChange = (newInterval) => {
    const autoTimeframe = INTERVALS.find((i) => i.value === newInterval)?.autoTimeframe;
    setSelectedInterval(newInterval);
    if (autoTimeframe) {
      setSelectedPeriod(autoTimeframe);
    }
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
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <TrendingUp className="h-6 w-6 text-primary" />
              <Select 
                value={selectedIndexId.toString()} 
                onValueChange={(value) => setSelectedIndexId(parseInt(value))}
              >
                <SelectTrigger className="w-40 bg-background">
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

            <div className="relative w-72" ref={searchRef}>
              <Input
                type="text"
                placeholder="Search stocks..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                className="pr-8"
              />
              {searchTerm ? (
                <X 
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" 
                  onClick={() => {
                    setSearchTerm('');
                    setShowDropdown(false);
                  }}
                />
              ) : (
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}

              {showDropdown && searchTerm && (
                <Card className="absolute w-full mt-1 z-50">
                  <ScrollArea className="h-64">
                    <div className="p-2">
                      {filteredStocks.map((stock) => (
                        <button
                          key={stock.symbol}
                          onClick={() => {
                            const stockIndex = stocks.findIndex(s => s.symbol === stock.symbol);
                            setCurrentStockIndex(stockIndex);
                            setSearchTerm('');
                            setShowDropdown(false);
                          }}
                          className="w-full p-3 text-left hover:bg-muted rounded-lg transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium group-hover:text-primary transition-colors">{stock.symbol}</div>
                              <div className="text-sm text-muted-foreground truncate">{stock.name}</div>
                            </div>
                            <Badge variant="secondary" className="ml-2">{stock.industry}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl mx-auto px-4 py-6">
        {currentStock && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <h2 className="text-2xl font-bold">{currentStock.symbol}</h2>
                    <Badge variant="outline">{currentStock.industry}</Badge>
                  </div>
                  <p className="text-muted-foreground">{currentStock.name}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold mb-1">
                    ₹<AnimatedNumber value={currentStock.price} />
                  </div>
                  <div className="flex items-center justify-end space-x-2">
                    <Badge 
                      variant={currentStock.todayChange >= 0 ? "success" : "destructive"}
                      className="text-sm"
                    >
                      {currentStock.todayChange >= 0 ? '↑' : '↓'} 
                      <AnimatedNumber value={Math.abs(currentStock.todayChange)} />%
                    </Badge>
                    <Badge variant="secondary" className="text-sm">
                      Vol: {(currentStock.volume / 1000000).toFixed(1)}M
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <Tabs 
                defaultValue="1Y"
                value={selectedPeriod}
                onValueChange={handlePeriodChange}
                className="w-full"
              >
                <TabsList className="grid grid-cols-6">
                  {TIME_PERIODS.map((period) => (
                    <TabsTrigger
                      key={period.label}
                      value={period.label}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {period.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {loading ? (
              <div className="h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading chart data...</p>
                </div>
              </div>
            ) : error ? (
              <div className="h-[600px] flex items-center justify-center">
                <div className="text-center text-destructive">
                  <p className="font-medium mb-2">Error loading chart</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            ) : (
              <div ref={chartContainerRef} className="h-[600px]" />
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStockIndex === 0}
              className="space-x-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-sm">
                <span className="font-medium">{currentStockIndex + 1}</span>
                <span className="mx-1">/</span>
                <span>{stocks.length}</span>
              </Badge>
            </div>
            
            <Button
              variant="ghost"
              onClick={handleNext}
              disabled={currentStockIndex === stocks.length - 1}
              className="space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StockChart;
