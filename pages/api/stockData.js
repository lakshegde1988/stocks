import axios from 'axios';

// Cache for API responses
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

    // Check cache
    if (cache.has(cacheKey)) {
      return res.status(200).json(cache.get(cacheKey));
    }

    // Fetch stock data
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}`,
      {
        params: { range, interval, events: 'div,split', includeAdjustedClose: true },
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    const result = response.data;
    if (!result.chart || !result.chart.result || !result.chart.result[0]) {
      return res.status(404).json({ details: 'No data available for this symbol' });
    }

    const chart = result.chart.result[0];
    const timestamps = chart.timestamp;
    const ohlcv = chart.indicators.quote[0];
    const adjClose = chart.indicators.adjclose[0]?.adjclose;
    const splits = chart.events?.splits || {};

    // Build split adjustment map
    const splitAdjustments = {};
    Object.values(splits).forEach((split) => {
      splitAdjustments[split.date] = split.numerator / split.denominator;
    });

    // Calculate cumulative adjustment factor
    let cumulativeAdjustment = 1;
    const adjustedData = timestamps.map((timestamp, index) => {
      if (
        !ohlcv.open[index] ||
        !ohlcv.high[index] ||
        !ohlcv.low[index] ||
        !ohlcv.close[index] ||
        !ohlcv.volume[index]
      ) {
        return null;
      }

      // Apply split adjustments to historical data
      if (splitAdjustments[timestamp]) {
        cumulativeAdjustment *= splitAdjustments[timestamp];
      }

      return {
        time: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: parseFloat((ohlcv.open[index] * cumulativeAdjustment).toFixed(2)),
        high: parseFloat((ohlcv.high[index] * cumulativeAdjustment).toFixed(2)),
        low: parseFloat((ohlcv.low[index] * cumulativeAdjustment).toFixed(2)),
        close: parseFloat((adjClose[index] * cumulativeAdjustment).toFixed(2)),
        volume: Math.round(ohlcv.volume[index] / cumulativeAdjustment),
      };
    }).filter((item) => item !== null);

    // Cache the processed data
    cache.set(cacheKey, adjustedData);
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    return res.status(200).json(adjustedData);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({ details: 'Stock symbol not found' });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({ details: 'Too many requests. Please try again later.' });
    }

    return res.status(500).json({ details: 'Error fetching stock data', error: error.message });
  }
}

// Config for API
export const config = {
  api: {
    externalResolver: true,
  },
};
