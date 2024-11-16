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
        params: { range, interval, events: 'history', includeAdjustedClose: true },
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
    const adjClose = quotes.indicators.adjclose?.[0]?.adjclose || ohlcv.close;

    // Get the current date
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    // Process the data into the format needed by the chart
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

      // Convert timestamp to Date object
      const date = new Date(timestamp * 1000);
      
      // For weekly data, adjust the timestamp to Monday of that week
      if (interval === '1wk') {
        const dayOfWeek = date.getUTCDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        date.setUTCDate(date.getUTCDate() - daysToSubtract);
      }
      // For monthly data, adjust the timestamp to the first day of the month
      else if (interval === '1mo') {
        date.setUTCDate(1);
      }

      return {
        time: date.toISOString().split('T')[0],
        open: parseFloat(ohlcv.open[index].toFixed(2)),
        high: parseFloat(ohlcv.high[index].toFixed(2)),
        low: parseFloat(ohlcv.low[index].toFixed(2)),
        close: parseFloat(ohlcv.close[index].toFixed(2)),
        volume: parseInt(ohlcv.volume[index]),
      };
    }).filter(item => item !== null);

    // Handle incomplete candles for weekly and monthly intervals
    if (interval === '1wk' || interval === '1mo') {
      // For weekly interval, get the current week's Monday
      if (interval === '1wk') {
        const dayOfWeek = now.getUTCDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        now.setUTCDate(now.getUTCDate() - daysToSubtract);
      }
      // For monthly interval, get the first day of the current month
      else if (interval === '1mo') {
        now.setUTCDate(1);
      }

      // Adjust the last candle to represent the current period
      const lastCandle = processedData[processedData.length - 1];
      const lastCandleDate = new Date(lastCandle.time);

      if (lastCandleDate.getTime() === now.getTime()) {
        // The last candle is the current period, update its time to now
        lastCandle.time = now.toISOString().split('T')[0];
      } else if (lastCandleDate < now) {
        // The last candle is from a previous period, add a new candle for the current period
        processedData.push({
          time: now.toISOString().split('T')[0],
          open: lastCandle.close,
          high: lastCandle.close,
          low: lastCandle.close,
          close: lastCandle.close,
          volume: 0,
        });
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
