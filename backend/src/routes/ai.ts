import { Router } from "express";
import { decomposeProblemStatement } from "../services/aiDecomposer.js";

const router = Router();

// POST /api/ai/decompose — Decomposes problem statement into structured project brief
router.post("/decompose", async (req, res) => {
  const { ideaPrompt, teamSize, teammateRoles } = req.body;

  if (!ideaPrompt || typeof ideaPrompt !== "string" || !ideaPrompt.trim()) {
    res.status(400).json({ error: "ideaPrompt is required" });
    return;
  }

  try {
    const decomposition = await decomposeProblemStatement({
      ideaPrompt: ideaPrompt.trim(),
      teamSize: teamSize ? parseInt(teamSize, 10) : 3,
      teammateRoles: Array.isArray(teammateRoles) ? teammateRoles : undefined,
    });

    res.json({
      success: true,
      data: decomposition,
    });
  } catch (err: any) {
    console.error("AI Decompose error:", err);
    res.status(500).json({ error: err.message || "Failed to decompose problem statement" });
  }
});

export default router;
