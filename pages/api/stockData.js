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

    // Process data into candles
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

    // Handle weekly and monthly data
    if (interval === '1wk' || interval === '1mo') {
      processedData = removeIncompleteLastCandle(processedData, interval);
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

function removeIncompleteLastCandle(data, interval) {
  if (data.length < 2) return data;

  const lastCandle = data[data.length - 1];
  const secondLastCandle = data[data.length - 2];
  const lastCandleDate = new Date(lastCandle.time);
  const secondLastCandleDate = new Date(secondLastCandle.time);

  if (interval === '1wk') {
    // Check if the last candle is in the same week as the second last candle
    if (isSameWeek(lastCandleDate, secondLastCandleDate)) {
      return data.slice(0, -1);
    }
  } else if (interval === '1mo') {
    // Check if the last candle is in the same month as the second last candle
    if (isSameMonth(lastCandleDate, secondLastCandleDate)) {
      return data.slice(0, -1);
    }
  }

  return data;
}

function isSameWeek(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.abs(d1 - d2) <= 6 * 24 * 60 * 60 * 1000 && d1.getDay() <= d2.getDay();
}

function isSameMonth(date1, date2) {
  return date1.getUTCFullYear() === date2.getUTCFullYear() && date1.getUTCMonth() === date2.getUTCMonth();
}

