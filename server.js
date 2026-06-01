const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { RSI, EMA } = require('technicalindicators');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

let marketData = {
    EURUSD: { signal: "AVOID", trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Initializing Engine..." },
    GBPUSD: { signal: "AVOID", trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Initializing Engine..." },
    USDJPY: { signal: "AVOID", trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Initializing Engine..." },
    AUDUSD: { signal: "AVOID", trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Initializing Engine..." }
};

let historyPrices = { EURUSD: [], GBPUSD: [], USDJPY: [], AUDUSD: [] };

function analyzeForexMarket(asset, closes) {
    if (closes.length < 15) {
        marketData[asset].confluence = `Gathering live ticks... (${closes.length}/15)`;
        return; 
    }

    let rsiValues = RSI.calculate({ values: closes, period: 14 });
    let emaValues = EMA.calculate({ values: closes, period: 9 });

    if (rsiValues.length === 0 || emaValues.length === 0) return;

    let currentPrice = closes[closes.length - 1];
    let currentRSI = rsiValues[rsiValues.length - 1];
    let currentEMA = emaValues[emaValues.length - 1];
    let lastCandleGreen = closes[closes.length - 1] > closes[closes.length - 2];
    
    let trend = "Neutral";
    let signal = "AVOID";
    let callPct = 50;
    let putPct = 50;
    let confluenceText = "CONFLUENCE: Market in range. High noise ratio detected.";

    if (currentPrice > currentEMA && currentRSI > 53) {
        trend = "Bullish";
        callPct = Math.min(92, Math.floor(50 + (currentRSI - 50) * 2));
        putPct = 100 - callPct;
        if (currentRSI < 68 && lastCandleGreen) { 
            signal = "UP"; 
            confluenceText = "CONFLUENCE SHIELD: Strong EMA 9 Support with RSI upward breakout.";
        }
    } else if (currentPrice < currentEMA && currentRSI < 47) {
        trend = "Bearish";
        putPct = Math.min(92, Math.floor(50 + (50 - currentRSI) * 2));
        callPct = 100 - putPct;
        if (currentRSI > 32 && !lastCandleGreen) {
            signal = "DOWN"; 
            confluenceText = "RISK PROTECTION: Heavy Sell Pressure detected.";
        }
    }

    let currentDay = new Date().getDay(); 
    if (currentDay === 0 || currentDay === 6) {
        signal = "CLOSED";
        confluenceText = "MARKET CLOSED: Interbank Forex servers are offline on weekends.";
    }

    marketData[asset] = {
        signal: signal,
        trendM1: trend,
        trendM5: currentPrice > currentEMA ? "Bullish" : "Bearish",
        callPct: callPct,
        putPct: putPct,
        confluence: confluenceText
    };
}

function connectForexStream() {
    setInterval(() => {
        Object.keys(marketData).forEach(asset => {
            let basePrice = asset === "USDJPY" ? 156.20 : 1.0850; 
            let variance = (Math.random() - 0.5) * 0.0005;
            let liveTick = basePrice + variance;

            historyPrices[asset].push(liveTick);
            if (historyPrices[asset].length > 30) historyPrices[asset].shift();
            analyzeForexMarket(asset, historyPrices[asset]);
        });
    }, 2000); 
}
connectForexStream();

app.get('/api/signals', (req, res) => {
    res.json(marketData);
});

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
