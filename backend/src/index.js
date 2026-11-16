require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { clerk } = require("./middleware/auth");
const { initEventListener, startDeadlineChecker } = require("./services/events");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(clerk);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public config — exposes the relayer address so frontend can use it as on-chain validator
app.get("/api/config", (req, res) => {
  res.json({
    relayerAddress: process.env.RELAYER_ADDRESS || "",
    contractAddress: process.env.CONTRACT_ADDRESS || "",
  });
});

// Routes
app.use("/api/users", require("./routes/users"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/leaderboard", require("./routes/leaderboard"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/wallet", require("./routes/wallet"));

// ETH/USD price proxy (CoinGecko primary, Binance fallback, 60s cache)
let ethPriceCache = { price: null, fetchedAt: 0 };

async function fetchEthPrice() {
  // Try CoinGecko first
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await r.json();
    const price = data?.ethereum?.usd;
    if (typeof price === "number") return price;
  } catch {
    // fall through to Binance
  }

  // Binance public API — no auth required
  const r = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT",
    { signal: AbortSignal.timeout(5000) }
  );
  const data = await r.json();
  const price = parseFloat(data?.price);
  if (isFinite(price) && price > 0) return price;
  throw new Error("All price sources failed");
}

app.get("/api/price/eth", async (req, res) => {
  const now = Date.now();
  if (ethPriceCache.price && now - ethPriceCache.fetchedAt < 60_000) {
    return res.json({ usd: ethPriceCache.price });
  }
  try {
    const price = await fetchEthPrice();
    ethPriceCache = { price, fetchedAt: now };
    return res.json({ usd: price });
  } catch (err) {
    // Return stale cache rather than failing if we have any prior value
    if (ethPriceCache.price) return res.json({ usd: ethPriceCache.price });
    res.status(503).json({ error: "Price unavailable" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`TaskStaker API running on port ${PORT}`);

  // Start blockchain event listeners
  initEventListener();
  const triggerDeadlineCheck = startDeadlineChecker();

  // Debug: manually re-run the deadline check via GET /api/debug/deadline-check
  app.get("/api/debug/deadline-check", async (req, res) => {
    console.log("[Debug] Manual deadline check triggered");
    await triggerDeadlineCheck();
    res.json({ ok: true, message: "Deadline check complete — see server logs" });
  });
});
