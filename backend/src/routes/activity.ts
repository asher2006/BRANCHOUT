import { Router } from "express";
import { pollProjectActivity, simulateBranchCommit } from "../services/activityTracker.js";
import { sendWebhookNudge } from "../services/notifications.js";
import { generateMarkdownSummary, generateCsvSummary } from "../services/summaryExporter.js";
import { getDb } from "../db.js";

const router = Router();

// GET /api/projects/:id/activity — Get activity report
router.get("/:id/activity", async (req, res) => {
  const { id } = req.params;
  const { pat, threshold } = req.query;
  const staleThreshold = threshold ? parseFloat(threshold as string) : 3;

  try {
    const report = await pollProjectActivity(
      Number(id),
      pat as string | undefined,
      staleThreshold
    );
    res.json(report);
  } catch (err: any) {
    console.error("Error polling activity:", err);
    res.status(500).json({ error: err.message || "Failed to poll project activity" });
  }
});

// POST /api/projects/:id/activity/refresh — Force refresh
router.post("/:id/activity/refresh", async (req, res) => {
  const { id } = req.params;
  const { pat, threshold } = req.body;
  const staleThreshold = threshold ? parseFloat(threshold) : 3;

  try {
    const report = await pollProjectActivity(
      Number(id),
      pat ? pat.trim() : undefined,
      staleThreshold
    );
    res.json(report);
  } catch (err: any) {
    console.error("Error refreshing activity:", err);
    res.status(500).json({ error: err.message || "Failed to refresh activity" });
  }
});

// POST /api/projects/:id/activity/simulate-commit — Simulate commit on teammate branch
router.post("/:id/activity/simulate-commit", (req, res) => {
  const { teammateId } = req.body;
  if (!teammateId) {
    res.status(400).json({ error: "teammateId is required" });
    return;
  }

  try {
    const updatedActivity = simulateBranchCommit(Number(teammateId));
    res.json(updatedActivity);
  } catch (err: any) {
    console.error("Error simulating commit:", err);
    res.status(500).json({ error: err.message || "Failed to simulate commit" });
  }
});

// POST /api/projects/:id/notify-webhook — Send stale branch alert to Discord / Slack
router.post("/:id/notify-webhook", async (req, res) => {
  const { webhookUrl, projectName, staleBranches } = req.body;

  if (!webhookUrl) {
    res.status(400).json({ error: "webhookUrl is required" });
    return;
  }

  if (!staleBranches || !Array.isArray(staleBranches) || staleBranches.length === 0) {
    res.status(400).json({ error: "No stale branches to notify about" });
    return;
  }

  try {
    const result = await sendWebhookNudge({
      webhookUrl: webhookUrl.trim(),
      projectName: projectName || "Hackathon Project",
      staleBranches,
    });
    res.json(result);
  } catch (err: any) {
    console.error("Webhook notification error:", err);
    res.status(500).json({ error: err.message || "Failed to deliver webhook notification" });
  }
});

// GET /api/projects/:id/export/markdown — Export end-of-hackathon markdown summary
router.get("/:id/export/markdown", async (req, res) => {
  const { id } = req.params;
  const { pat, threshold } = req.query;
  const db = getDb();

  try {
    const report = await pollProjectActivity(
      Number(id),
      pat as string | undefined,
      threshold ? parseFloat(threshold as string) : 3
    );

    const pResult = db.exec(`SELECT * FROM projects WHERE id = ?`, [id]);
    const project = pResult.length > 0 && pResult[0].values.length > 0 ? {
      name: pResult[0].values[0][1],
      description: pResult[0].values[0][2],
      tech_stack: pResult[0].values[0][3],
    } : undefined;

    const markdown = generateMarkdownSummary(report, project);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.send(markdown);
  } catch (err: any) {
    console.error("Export markdown error:", err);
    res.status(500).send("Failed to generate markdown export");
  }
});

// GET /api/projects/:id/export/csv — Export end-of-hackathon CSV
router.get("/:id/export/csv", async (req, res) => {
  const { id } = req.params;
  const { pat, threshold } = req.query;

  try {
    const report = await pollProjectActivity(
      Number(id),
      pat as string | undefined,
      threshold ? parseFloat(threshold as string) : 3
    );

    const csv = generateCsvSummary(report);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${report.projectName}-hackathon-summary.csv"`);
    res.send(csv);
  } catch (err: any) {
    console.error("Export CSV error:", err);
    res.status(500).send("Failed to generate CSV export");
  }
});

export default router;
