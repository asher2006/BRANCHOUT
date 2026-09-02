import { Router } from "express";
import { validateGitHubToken } from "../services/github.js";

const router = Router();

// POST /api/github/validate-token — test a personal access token
router.post("/validate-token", async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string" || !token.trim()) {
    res.status(400).json({ valid: false, error: "GitHub token is required" });
    return;
  }

  const result = await validateGitHubToken(token.trim());
  res.json(result);
});

export default router;
