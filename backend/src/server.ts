import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDatabase } from "./db.js";
import projectRoutes from "./routes/projects.js";
import githubRoutes from "./routes/github.js";
import teammateRoutes from "./routes/teammates.js";
import activityRoutes from "./routes/activity.js";
import aiRoutes from "./routes/ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const requestCounts = new Map<string, { count: number; resetsAt: number }>();
function apiRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const current = requestCounts.get(key);
  const bucket = !current || current.resetsAt <= now ? { count: 0, resetsAt: now + 60_000 } : current;
  bucket.count += 1;
  requestCounts.set(key, bucket);
  if (bucket.count > 120) {
    res.status(429).json({ error: "Too many requests. Try again in a minute." });
    return;
  }
  next();
}

// Middleware
app.use(cors({ origin: process.env.NODE_ENV === "production" ? allowedOrigins : true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRateLimit);

// API routes
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
});

app.use("/api/projects", projectRoutes);
app.use("/api/projects", activityRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/teammates", teammateRoutes);
app.use("/api/ai", aiRoutes);

// In production, serve the frontend build
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");

if (process.env.NODE_ENV === "production") {
  app.use(express.static(FRONTEND_DIST));

  // SPA catch-all: serve index.html for any non-API route
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  // In development, redirect browser visits from port 3001 to the Vite frontend
  app.get("/", (_req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5174";
    res.redirect(frontendUrl);
  });
}

// Initialize database then start server
async function start() {
  await initializeDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Branchout backend listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
