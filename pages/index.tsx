'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, BarData, CrosshairMode } from 'lightweight-charts'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Search, X, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

// Import JSON data (assuming these imports are correct)
import nifty50Data from '../public/nifty50.json'
import niftyNext50Data from '../public/niftynext50.json'
import midcap150Data from '../public/midcap150.json'
import smallcap250Data from '../public/smallcap250.json'
import microCap250Data from '../public/microcap250.json'

// ... (keep all the existing interfaces)

const INTERVALS = [
  { label: 'D', value: 'daily', interval: '1d', range: '1y' },
  { label: 'W', value: 'weekly', interval: '1wk', range: '5y' },
  { label: 'M', value: 'monthly', interval: '1mo', range: 'max' },
]

const chartColors = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  borderColor: '#e5e7eb',
  gridColor: '#f3f4f6',
  crosshairColor: '#9ca3af',
  barColors: ['#3b82f6', '#ef4444'],
}

export default function Component() {
  // ... (keep all the existing state variables and refs)

  // ... (keep all the existing useEffect hooks and functions)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-blue-600">dotcharts</h1>
            <div className="relative w-full sm:w-64" ref={searchRef}>
              <Input
                type="text"
                placeholder="Search stocks..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setShowDropdown(true)
                }}
                className="pr-8 text-sm h-10 bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg"
                aria-label="Search stocks"
              />
              {searchTerm ? (
                <X 
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer" 
                  onClick={() => {
                    setSearchTerm('')
                    setShowDropdown(false)
                  }}
                />
              ) : (
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              )}
              <AnimatePresence>
                {showDropdown && filteredStocks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto"
                  >
                    {filteredStocks.map((stock, index) => (
                      <div
                        key={stock.symbol}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => {
                          setCurrentStockIndex(stocks.findIndex(s => s.symbol === stock.symbol))
                          setSearchTerm('')
                          setShowDropdown(false)
                        }}
                      >
                        <div className="font-medium">{stock.symbol}</div>
                        <div className="text-gray-500">{stock.name}</div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="space-y-8">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {currentStock && (
                <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{currentStock.symbol}</h2>
                      <p className="text-blue-100">{currentStock.name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{currentStock.price?.toFixed(2)}</div>
                      <Badge 
                        variant={currentStock.todayChange && currentStock.todayChange >= 0 ? "default" : "destructive"}
                        className={`text-sm mt-1 ${
                          currentStock.todayChange && currentStock.todayChange >= 0
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {currentStock.todayChange && currentStock.todayChange >= 0 ? (
                          <ArrowUpRight className="inline mr-1 h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="inline mr-1 h-4 w-4" />
                        )}
                        {Math.abs(currentStock.todayChange || 0).toFixed(2)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <Select value={selectedInterval} onValueChange={handleIntervalChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select interval" />
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
                {loading ? (
                  <div className="h-[400px] sm:h-[450px] lg:h-[500px] flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                    <p className="text-lg text-gray-600">Loading stock data...</p>
                  </div>
                ) : error ? (
                  <div className="h-[400px] sm:h-[450px] lg:h-[500px] flex flex-col items-center justify-center">
                    <div className="text-red-600 text-lg mb-2">{error}</div>
                    <p className="text-gray-600">Please try again later or select a different stock.</p>
                  </div>
                ) : (
                  <div ref={chartContainerRef} className="h-[400px] sm:h-[450px] lg:h-[500px]" />
                )}
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStockIndex === 0}
              className="h-10 px-4 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            
            <span className="text-sm text-gray-600">
              <span className="font-medium">{currentStockIndex + 1}</span>
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-gray-400">{stocks.length}</span>
            </span>
            
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={currentStockIndex === stocks.length - 1}
              className="h-10 px-4 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
