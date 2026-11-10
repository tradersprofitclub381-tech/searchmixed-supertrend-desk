# Searchmixed

Live Supertrend desk for Deriv markets. Each row is a symbol with the current bias, live price, entry, stop, and two targets.

## Open the live desk

[Searchmixed Supertrend desk](https://cdn.jsdelivr.net/gh/tradersprofitclub381-tech/searchmixed-supertrend-desk@main/docs/index.html)

That page is a normal website. Quotes, buy and sell signals, stops, and targets update from Deriv in the browser.

## What it shows

- Public Deriv prices over the current public websocket (`wss://api.derivws.com/trading/v1/options/ws/public`)
- Supertrend bias from ATR bands (default ATR 10, multiplier 3) on 15-minute candles
- Entry at the flip candle, initial stop on the band, TP1 at 1.5R, TP2 at 2.5R
- A trailing stop that follows the live Supertrend
- Follow list saved in the browser

Sign up and log in open the Deriv gateway. Buy VPS, WhatsApp, and the MQL5 tool listings are in the header and under Tools.

## Run

```bash
npm install
npm run dev
```

This is a study tool. It is not a broker and it is not financial advice.
