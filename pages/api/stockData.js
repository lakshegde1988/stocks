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

    const formattedSymbol = `${symbol}.NS`;
    const cacheKey = `${formattedSymbol}-${range}-${interval}`;

    // Check cache first
    if (cache.has(cacheKey)) {
      return res.status(200).json(cache.get(cacheKey));
    }

    // Fetch stock data
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}`,
      {
        params: { range, interval, events: 'history', includeAdjustedClose: true },
        headers: {
          'User-Agent': 'Mozilla/5.0',
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

    // Process data
    let processedData = timestamps.map((timestamp, index) => {
      if (!ohlcv.open[index] || !ohlcv.high[index] || !ohlcv.low[index] || !ohlcv.close[index]) {
        return null;
      }

      const date = new Date(timestamp * 1000);

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

    // Handle incomplete weekly or monthly candles
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

      const lastCandle = processedData[processedData.length - 1];
      const lastCandleDate = new Date(lastCandle.time);

      if (lastCandleDate < currentPeriodStart) {
        processedData.push({
          time: currentPeriodStart.toISOString().split('T')[0],
          open: lastCandle.close,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
          volume: 0,
        });
      }
    }

    // Cache response
    cache.set(cacheKey, processedData);
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.status(200).json(processedData);
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ details: 'Error fetching stock data' });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
