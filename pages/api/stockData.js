import axios from 'axios';

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

    // Fetch stock data from Yahoo Finance
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}`,
      {
        params: { range, interval, events: 'div,split', includeAdjustedClose: true },
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

    const chart = result.chart.result[0];
    const timestamps = chart.timestamp;
    const ohlcv = chart.indicators.quote[0];
    const adjClose = chart.indicators.adjclose[0]?.adjclose;
    const splits = chart.events?.splits || {};
    const dividends = chart.events?.dividends || {};

    // Map split dates to ratios
    const splitAdjustments = Object.values(splits).map((split) => ({
      date: new Date(split.date * 1000),
      ratio: split.numerator / split.denominator,
    }));

    // Adjust OHLC values for splits
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

      let adjustedOpen = ohlcv.open[index];
      let adjustedHigh = ohlcv.high[index];
      let adjustedLow = ohlcv.low[index];
      let adjustedClose = adjClose ? adjClose[index] : ohlcv.close[index];
      let adjustedVolume = ohlcv.volume[index];

      // Apply split adjustments
      splitAdjustments.forEach((split) => {
        if (timestamp * 1000 < split.date.getTime()) {
          adjustedOpen /= split.ratio;
          adjustedHigh /= split.ratio;
          adjustedLow /= split.ratio;
          adjustedClose /= split.ratio;
          adjustedVolume *= split.ratio;
        }
      });

      return {
        time: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: parseFloat(adjustedOpen.toFixed(2)),
        high: parseFloat(adjustedHigh.toFixed(2)),
        low: parseFloat(adjustedLow.toFixed(2)),
        close: parseFloat(adjustedClose.toFixed(2)),
        volume: parseInt(adjustedVolume),
      };
    }).filter((item) => item !== null);

    res.status(200).json(processedData);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ details: 'Stock symbol not found' });
    }
    res.status(500).json({ details: 'Error fetching stock data', error: error.message });
  }
}
