const express = require('express');
const cors = require('cors');
const { RSI, EMA } = require('technicalindicators');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Dono timeframes ka alag-alag data store hoga
let marketSignals = {
    "1m": { EURUSD: "AVOID", GBPUSD: "AVOID", USDJPY: "AVOID", AUDUSD: "AVOID" },
    "5m": { EURUSD: "AVOID", GBPUSD: "AVOID", USDJPY: "AVOID", AUDUSD: "AVOID" }
};

let marketData = {
    EURUSD: { trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Waiting for next candle..." },
    GBPUSD: { trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Waiting for next candle..." },
    USDJPY: { trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Waiting for next candle..." },
    AUDUSD: { trendM1: "Neutral", trendM5: "Neutral", callPct: 50, putPct: 50, confluence: "Waiting for next candle..." }
};

let historyPrices = { EURUSD: [], GBPUSD: [], USDJPY: [], AUDUSD: [] };

// --- MAIN ENGINE TO CALCULATE SIGNALS (Strictly on Candle Start) ---
function runTechnicalAnalysis(asset) {
    let closes = historyPrices[asset];
    if (closes.length < 15) return;

    let rsiValues = RSI.calculate({ values: closes, period: 14 });
    let emaValues = EMA.calculate({ values: closes, period: 9 });

    if (rsiValues.length === 0 || emaValues.length === 0) return;

    let currentPrice = closes[closes.length - 1];
    let currentRSI = rsiValues[rsiValues.length - 1];
    let currentEMA = emaValues[emaValues.length - 1];
    let lastCandleGreen = closes[closes.length - 1] > closes[closes.length - 2];

    let trend = currentPrice > currentEMA ? "Bullish" : "Bearish";
    let callPct = 50;
    let putPct = 50;
    let signal = "AVOID";
    let confluenceText = "CONFLUENCE: Market in range. No high probability breakout.";

    // Strategy Rules
    if (currentPrice > currentEMA && currentRSI > 53 && currentRSI < 68 && lastCandleGreen) {
        signal = "UP";
        callPct = Math.min(90, Math.floor(55 + (currentRSI - 50) * 2));
        putPct = 100 - callPct;
        confluenceText = "CONFLUENCE SHIELD: Strong EMA 9 Support with RSI upward breakout.";
    } else if (currentPrice < currentEMA && currentRSI < 47 && currentRSI > 32 && !lastCandleGreen) {
        signal = "DOWN";
        putPct = Math.min(90, Math.floor(55 + (50 - currentRSI) * 2));
        callPct = 100 - putPct;
        confluenceText = "RISK PROTECTION: Heavy Sell Pressure detected near resistance.";
    }

    // Live Metrics Update
    marketData[asset] = {
        trendM1: trend,
        trendM5: currentPrice > currentEMA ? "Bullish" : "Bearish",
        callPct: callPct,
        putPct: putPct,
        confluence: confluenceText
    };

    return signal;
}

// --- CLOCK AND TIMEFRAME SYNC LOOP ---
function startDataPipeline() {
    setInterval(() => {
        let now = new Date();
        let seconds = now.getSeconds();
        let minutes = now.getMinutes();

        // Weekend Automation Check
        let day = now.getDay();
        let isWeekend = (day === 0 || day === 6);

        // 1. Live Ticks Simulator (Har 2 second me pricing feed)
        Object.keys(marketData).forEach(asset => {
            let basePrice = asset === "USDJPY" ? 156.20 : 1.0850; 
            let variance = (Math.random() - 0.5) * 0.0004;
            historyPrices[asset].push(basePrice + variance);
            if (historyPrices[asset].length > 30) historyPrices[asset].shift();
        });

        if (isWeekend) {
            ["1m", "5m"].forEach(tf => {
                Object.keys(marketSignals[tf]).forEach(asset => {
                    marketSignals[tf][asset] = "CLOSED";
                });
            });
            return;
        }

        // 2. STRICT TIMEFRAME LOCK LOGIC (Signals trigger only at 00 seconds)
        if (seconds === 0) {
            Object.keys(marketData).forEach(asset => {
                // Har 1 minute par naya signal lock hoga
                marketSignals["1m"][asset] = runTechnicalAnalysis(asset) || "AVOID";

                // Har 5 minute par naya signal lock hoga (e.g., 00, 05, 10, 15...)
                if (minutes % 5 === 0) {
                    marketSignals["5m"][asset] = runTechnicalAnalysis(asset) || "AVOID";
                }
            });
            console.log(`[LOG] Signals locked successfully at ${minutes}:${seconds}`);
        }

    }, 1000);
}
startDataPipeline();

// --- API ENDPOINT ---
app.get('/api/signals', (req, res) => {
    res.json({
        signals: marketSignals,
        metrics: marketData
    });
});

app.listen(PORT, () => {
    console.log(`Strict Timeframe Backend initialized on port ${PORT}`);
});    console.log(`Backend Server running on port ${PORT}`);
});
