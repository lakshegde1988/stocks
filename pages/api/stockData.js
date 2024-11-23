import axios from 'axios';

// Cache object to store API responses
const cache = new Map();

// Helper to aggregate daily data into monthly candles
function aggregateToMonthly(data) {
  const monthlyData = [];
  let currentMonth = null;
  let currentCandle = null;

  for (const point of data) {
    const date = new Date(point.time);
    const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

    if (monthKey !== currentMonth) {
      if (currentCandle) {
        monthlyData.push(currentCandle);
      }
      currentMonth = monthKey;
      currentCandle = {
        time: `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-01`,
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
  }

  if (currentCandle) {
    monthlyData.push(currentCandle);
  }

  return monthlyData;
}

// Helper to fix incomplete weekly/monthly candles
function fixIncompleteCandle(data, interval) {
  const now = new Date();
  let currentPeriodStart;

  if (interval === '1wk') {
    const dayOfWeek = now.getUTCDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentPeriodStart = new Date(now);
    currentPeriodStart.setUTCDate(now.getUTCDate() - daysToSubtract);
  } else if (interval === '1mo') {
    currentPeriodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }

  const lastCandle = data[data.length - 1];
  const lastCandleDate = new Date(lastCandle.time);

  if (lastCandleDate < currentPeriodStart) {
    // Add a new candle for the current period
    const currentCandle = {
      time: currentPeriodStart.toISOString().split('T')[0],
      open: lastCandle.close,
      high: lastCandle.close,
      low: lastCandle.close,
      close: lastCandle.close,
      volume: 0,
    };
    data.push(currentCandle);
  }

  return data;
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

    // Fetch stock data from Yahoo Finance API
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
    if (interval === '1mo') {
      processedData = aggregateToMonthly(dailyData);
    } else if (interval === '1wk') {
      processedData = aggregateToWeekly(dailyData); // Implement similar aggregation for weeks.
    }

    // Fix incomplete candles
    processedData = fixIncompleteCandle(processedData, interval);

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
