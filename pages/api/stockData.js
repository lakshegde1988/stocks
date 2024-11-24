import axios from 'axios';

// Cache object to store API responses
const cache = new Map();

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
        params: { range, interval, events: 'history', includeAdjustedClose: true },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      }
    );

    const result = response.data;

    // Validate response
    if (!result.chart || !result.chart.result || !result.chart.result[0]) {
      return res.status(404).json({ details: 'No data available for this symbol' });
    }

    const quotes = result.chart.result[0];
    const timestamps = quotes.timestamp;
    const ohlcv = quotes.indicators.quote[0];

    // Process the data into the desired format
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

      const date = new Date(timestamp * 1000);

      // Adjust timestamp for weekly or monthly data
      if (interval === '1wk') {
        const dayOfWeek = date.getUTCDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        date.setUTCDate(date.getUTCDate() - daysToSubtract);
      } else if (interval === '1mo') {
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

    // Add or update incomplete candles for weekly and monthly data
    if (interval === '1wk' || interval === '1mo') {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);

      let currentPeriodStart;
      if (interval === '1wk') {
        const dayOfWeek = now.getUTCDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentPeriodStart = new Date(now);
        currentPeriodStart.setUTCDate(now.getUTCDate() - daysToSubtract);
      } else if (interval === '1mo') {
        currentPeriodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
      }

      const currentPeriodData = processedData.filter(
        d => new Date(d.time) >= currentPeriodStart
      );

      if (currentPeriodData.length > 0) {
        const currentCandle = {
          time: currentPeriodStart.toISOString().split('T')[0],
          open: currentPeriodData[0].open,
          high: Math.max(...currentPeriodData.map(d => d.high)),
          low: Math.min(...currentPeriodData.map(d => d.low)),
          close: currentPeriodData[currentPeriodData.length - 1].close,
          volume: currentPeriodData.reduce((sum, d) => sum + d.volume, 0),
        };

        processedData = processedData.filter(
          d => new Date(d.time) < currentPeriodStart
        );
        processedData.push(currentCandle);
      }
    }

    // Store response in cache
    cache.set(cacheKey, processedData);

    // Limit cache size to 100 entries
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    // Send the processed data
    res.status(200).json(processedData);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);

    // Error handling
    if (error.response?.status === 404) {
      return res.status(404).json({ details: 'Stock symbol not found' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ details: 'Too many requests. Please try again later.' });
    }

    res.status(500).json({ details: 'Error fetching stock data', error: error.message });
  }
}

// Configure API route
export const config = {
  api: {
    externalResolver: true,
  },
};
