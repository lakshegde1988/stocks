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

        // Always update the last candle with today's data
        lastCandle.high = Math.max(lastCandle.high, todayData.high);
        lastCandle.low = Math.min(lastCandle.low, todayData.low);
        lastCandle.close = todayData.close;
        lastCandle.volume += todayData.volume;

        // Update the time of the last candle to today's date if it's in the same week/month
        if (
          (interval === '1wk' && isSameWeek(lastCandleDate, todayDate)) ||
          (interval === '1mo' && isSameMonth(lastCandleDate, todayDate))
        ) {
          lastCandle.time = todayData.time;
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

// Aggregate data into weekly or monthly intervals
function aggregateData(data, interval) {
  const aggregatedData = [];
  let currentKey = null;
  let currentCandle = null;

  data.forEach((point) => {
    const date = new Date(point.time);
    const key =
      interval === '1wk'
        ? `${date.getUTCFullYear()}-${Math.floor((date.getUTCDate() - 1) / 7)}`
        : `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

    if (key !== currentKey) {
      if (currentCandle) {
        aggregatedData.push(currentCandle);
      }
      currentKey = key;
      currentCandle = {
        time: point.time,
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

  if (currentCandle) {
    aggregatedData.push(currentCandle);
  }

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
    console.error('Error fetching today\'s data:', error.message);
    return null; // Return null if today's data is unavailable
  }
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

