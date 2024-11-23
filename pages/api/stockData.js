import axios from 'axios';

// Cache object to store API responses
const cache = new Map();

// Helper to aggregate daily data into weekly/monthly candles
function aggregateData(data, interval) {
  const aggregatedData = [];
  let currentKey = null;
  let currentCandle = null;

  data.forEach((point) => {
    const date = new Date(point.time);
    const key =
      interval === '1wk'
        ? `${date.getUTCFullYear()}-${Math.floor(date.getUTCDate() / 7)}`
        : `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

    if (key !== currentKey) {
      if (currentCandle) {
        aggregatedData.push(currentCandle);
      }
      currentKey = key;
      currentCandle = { ...point };
    } else {
      currentCandle.high = Math.max(currentCandle.high, point.high);
      currentCandle.low = Math.min(currentCandle.low, point.low);
      currentCandle.close = point.close;
      currentCandle.volume += point.volume;
    }
  });

  if (currentCandle) {
    aggregatedData.push(currentCandle);
  }

  return aggregatedData;
}

// Helper to fetch today's data
async function fetchTodayData(symbol) {
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

  return {
    time: new Date(result.timestamp[0] * 1000).toISOString().split('T')[0],
    open: ohlcv.open[0],
    high: ohlcv.high[0],
    low: ohlcv.low[0],
    close: ohlcv.close[0],
    volume: ohlcv.volume[0],
  };
}

// Main API handler
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ details: 'Method not allowed' });
  }

  try {
    const { symbol, range = '2y', interval = '1d' } = req.query;

    if (!symbol) {
      return res.status(400).json({ details: 'Symbol is required' });
    }

    // Add `.NS` suffix for NSE-listed stocks
    const formattedSymbol = `${symbol}.NS`;

    // Create cache key
    const cacheKey = `${formattedSymbol}-${range}-${interval}`;

    // Check cache first
    if (cache.has(cacheKey)) {
      return res.status(200).json(cache.get(cacheKey));
    }

    // Fetch daily data
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}`,
      {
        params: { range, interval: '1d', events: 'history', includeAdjustedClose: true },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      }
    );

    const result = response.data;

    // Check if the response contains valid data
    if (!result.chart || !result.chart.result || !result.chart.result[0]) {
      return res.status(404).json({ details: 'No data available for this symbol' });
    }

    const quotes = result.chart.result[0];
    const timestamps = quotes.timestamp;
    const ohlcv = quotes.indicators.quote[0];

    // Convert daily data
    const dailyData = timestamps.map((timestamp, index) => ({
      time: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: ohlcv.open[index],
      high: ohlcv.high[index],
      low: ohlcv.low[index],
      close: ohlcv.close[index],
      volume: ohlcv.volume[index],
    }));

    // Process data into desired interval
    let processedData = dailyData;
    if (interval === '1wk' || interval === '1mo') {
      processedData = aggregateData(dailyData, interval);

      // Fetch and append today's data
      const todayData = await fetchTodayData(formattedSymbol);
      const lastCandle = processedData[processedData.length - 1];

      const lastCandleDate = new Date(lastCandle.time);
      const todayDate = new Date(todayData.time);

      if (interval === '1wk' && todayDate.getUTCDay() >= lastCandleDate.getUTCDay()) {
        lastCandle.high = Math.max(lastCandle.high, todayData.high);
        lastCandle.low = Math.min(lastCandle.low, todayData.low);
        lastCandle.close = todayData.close;
        lastCandle.volume += todayData.volume;
      } else if (interval === '1mo' && todayDate.getUTCMonth() === lastCandleDate.getUTCMonth()) {
        lastCandle.high = Math.max(lastCandle.high, todayData.high);
        lastCandle.low = Math.min(lastCandle.low, todayData.low);
        lastCandle.close = todayData.close;
        lastCandle.volume += todayData.volume;
      } else {
        processedData.push(todayData);
      }
    }

    // Store response in cache
    cache.set(cacheKey, processedData);

    // Limit cache size to 100 entries
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    // Send the processed data back to the client
    res.status(200).json(processedData);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);

    // Handle specific error cases
    if (error.response?.status === 404) {
      return res.status(404).json({ details: 'Stock symbol not found' });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({ details: 'Too many requests. Please try again later.' });
    }

    // Handle other errors
    res.status(500).json({ details: 'Error fetching stock data', error: error.message });
  }
}

// Configure API route config
export const config = {
  api: {
    externalResolver: true,
  },
};
