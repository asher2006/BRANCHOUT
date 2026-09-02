import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDatabase } from "./db.js";
import projectRoutes from "./routes/projects.js";
import githubRoutes from "./routes/github.js";
import teammateRoutes from "./routes/teammates.js";
import activityRoutes from "./routes/activity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Middleware
app.use(cors());
app.use(express.json());

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

// In production, serve the frontend build
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");

if (process.env.NODE_ENV === "production") {
  app.use(express.static(FRONTEND_DIST));

  // SPA catch-all: serve index.html for any non-API route
  app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
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
