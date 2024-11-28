import axios from 'axios';

// Cache object to store API responses
const cache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ details: 'Method not allowed' });
  }

  try {
    const { symbol, range = '1y', interval = '1d' } = req.query;

    if (!symbol) {
      return res.status(400).json({ details: 'Symbol is required' });
    }

    const formattedSymbol = `${symbol}.NS`;
    const cacheKey = `${formattedSymbol}-${range}-${interval}`;

    // Check cache
    if (cache.has(cacheKey)) {
      return res.status(200).json(cache.get(cacheKey));
    }

    // Fetch stock data from Yahoo Finance API
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}`,
      {
        params: { range, interval, events: 'history', includeAdjustedClose: true },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      }
    );

    const result = response.data;

    if (!result.chart || !result.chart.result || !result.chart.result[0]) {
      return res.status(404).json({ details: 'No data available for this symbol' });
    }

    const quotes = result.chart.result[0];
    const timestamps = quotes.timestamp;
    const ohlcv = quotes.indicators.quote[0];

    // Process data into daily candles
    let processedData = timestamps.map((timestamp, index) => {
      if (
        !ohlcv.open[index] ||
        !ohlcv.high[index] ||
        !ohlcv.low[index] ||
        !ohlcv.close[index] ||
        !ohlcv.volume[index]
      ) {
        return null;
      }

      return {
        time: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: parseFloat(ohlcv.open[index].toFixed(2)),
        high: parseFloat(ohlcv.high[index].toFixed(2)),
        low: parseFloat(ohlcv.low[index].toFixed(2)),
        close: parseFloat(ohlcv.close[index].toFixed(2)),
        volume: parseInt(ohlcv.volume[index]),
      };
    }).filter((item) => item !== null);

    // Aggregate data for weekly or monthly intervals
    if (interval === '1wk' || interval === '1mo') {
      processedData = aggregateData(processedData, interval);

      // Fetch today's data and merge with weekly/monthly candles
      const todayData = await fetchTodayData(formattedSymbol);
      if (todayData) {
        const lastCandle = processedData[processedData.length - 1];
        const lastCandleDate = new Date(lastCandle.time);
        const todayDate = new Date(todayData.time);

        if (
          (interval === '1wk' && todayDate.getUTCDay() >= lastCandleDate.getUTCDay()) ||
          (interval === '1mo' && todayDate.getUTCMonth() === lastCandleDate.getUTCMonth())
        ) {
          // Update last candle
          lastCandle.high = Math.max(lastCandle.high, todayData.high);
          lastCandle.low = Math.min(lastCandle.low, todayData.low);
          lastCandle.close = todayData.close;
          lastCandle.volume += todayData.volume;
        } else {
          // Add a new candle for today
          processedData.push(todayData);
        }
      }
    }

    // Cache response
    cache.set(cacheKey, processedData);

    // Limit cache size
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.status(200).json(processedData);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ details: 'Stock symbol not found' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ details: 'Too many requests. Please try again later.' });
    }
    res.status(500).json({ details: 'Error fetching stock data', error: error.message });
  }
}

function aggregateData(data, interval) {
  if (interval !== '1wk' && interval !== '1mo') return data;

  const aggregatedData = [];
  let currentCandle = null;

  data.forEach((point) => {
    const date = new Date(point.time);
    let weekStart = new Date(date);
    
    // Set to Monday (if not a holiday, use the next trading day)
    const dayOfWeek = weekStart.getUTCDay();
    const daysToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Adjust to the previous Monday
    weekStart.setUTCDate(weekStart.getUTCDate() + daysToMonday);

    // Adjust to the actual first trading day of the week
    const weekStartStr = weekStart.toISOString().split('T')[0];
    if (!data.some((d) => d.time === weekStartStr)) {
      // Find the next available trading day
      weekStart = new Date(point.time);
    }

    const key = weekStart.toISOString().split('T')[0];

    if (!currentCandle || currentCandle.time !== key) {
      if (currentCandle) aggregatedData.push(currentCandle);
      currentCandle = {
        time: key,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
      };
    } else {
      currentCandle.high = Math.max(currentCandle.high, point.high);
      currentCandle.low = Math.min(currentCandle.low, point.low);
      currentCandle.close = point.close;
      currentCandle.volume += point.volume;
    }
  });

  if (currentCandle) aggregatedData.push(currentCandle);

  return aggregatedData;
}

// Fetch today's data dynamically
async function fetchTodayData(symbol) {
  try {
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      {
        params: { range: '1d', interval: '1d', events: 'history', includeAdjustedClose: true },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      }
    );

    const result = response.data.chart.result[0];
    const ohlcv = result.indicators.quote[0];
    const timestamp = result.timestamp[0];

    return {
      time: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: parseFloat(ohlcv.open[0].toFixed(2)),
      high: parseFloat(ohlcv.high[0].toFixed(2)),
      low: parseFloat(ohlcv.low[0].toFixed(2)),
      close: parseFloat(ohlcv.close[0].toFixed(2)),
      volume: parseInt(ohlcv.volume[0]),
    };
  } catch (error) {
    console.error('Error fetching today’s data:', error.message);
    return null; // Return null if today's data is unavailable
  }
}
