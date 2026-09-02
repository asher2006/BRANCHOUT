import { Router } from "express";
import { pollProjectActivity, simulateBranchCommit } from "../services/activityTracker.js";
import { sendWebhookNudge } from "../services/notifications.js";

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

export default router;
