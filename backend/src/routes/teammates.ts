import { Router } from "express";
import { getDb, saveDatabase } from "../db.js";
import { generateMasterPrompt } from "../services/promptGenerator.js";

const router = Router();

// GET /api/teammates/:id — Get teammate details with project & generated master prompt
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    const tmResult = db.exec(`SELECT * FROM teammates WHERE id = ?`, [id]);
    if (tmResult.length === 0 || tmResult[0].values.length === 0) {
      res.status(404).json({ error: "Teammate not found" });
      return;
    }

    const teammate = rowToObject(tmResult[0].columns, tmResult[0].values[0]);
    teammate.owned_paths = JSON.parse((teammate.owned_paths as string) || "[]");

    const projectResult = db.exec(`SELECT * FROM projects WHERE id = ?`, [teammate.project_id]);
    if (projectResult.length === 0 || projectResult[0].values.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const project = rowToObject(projectResult[0].columns, projectResult[0].values[0]);

    const allTmResult = db.exec(`SELECT * FROM teammates WHERE project_id = ?`, [teammate.project_id]);
    const allTeammates = allTmResult.length > 0
      ? allTmResult[0].values.map((row) => {
          const obj = rowToObject(allTmResult[0].columns, row);
          obj.owned_paths = JSON.parse((obj.owned_paths as string) || "[]");
          return obj as any;
        })
      : [];

    const masterPrompt = generateMasterPrompt({
      projectName: project.name,
      projectDescription: project.description,
      techStack: project.tech_stack,
      sharedConventions: project.shared_conventions,
      githubRepoUrl: project.github_repo_url,
      teammate: teammate as any,
      allTeammates,
    });

    res.json({
      teammate,
      project,
      allTeammates,
      masterPrompt,
    });
  } catch (err: any) {
    console.error("Error fetching teammate:", err);
    res.status(500).json({ error: "Failed to fetch teammate details" });
  }
});

// GET /api/teammates/:id/prompt — Returns the raw master prompt text
router.get("/:id/prompt", (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    const tmResult = db.exec(`SELECT * FROM teammates WHERE id = ?`, [id]);
    if (tmResult.length === 0 || tmResult[0].values.length === 0) {
      res.status(404).send("Teammate not found");
      return;
    }

    const teammate = rowToObject(tmResult[0].columns, tmResult[0].values[0]);
    teammate.owned_paths = JSON.parse((teammate.owned_paths as string) || "[]");

    const projectResult = db.exec(`SELECT * FROM projects WHERE id = ?`, [teammate.project_id]);
    const project = rowToObject(projectResult[0].columns, projectResult[0].values[0]);

    const allTmResult = db.exec(`SELECT * FROM teammates WHERE project_id = ?`, [teammate.project_id]);
    const allTeammates = allTmResult.length > 0
      ? allTmResult[0].values.map((row) => {
          const obj = rowToObject(allTmResult[0].columns, row);
          obj.owned_paths = JSON.parse((obj.owned_paths as string) || "[]");
          return obj as any;
        })
      : [];

    const masterPrompt = generateMasterPrompt({
      projectName: project.name,
      projectDescription: project.description,
      techStack: project.tech_stack,
      sharedConventions: project.shared_conventions,
      githubRepoUrl: project.github_repo_url,
      teammate: teammate as any,
      allTeammates,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(masterPrompt);
  } catch (err: any) {
    console.error("Error fetching prompt:", err);
    res.status(500).send("Failed to generate prompt");
  }
});

// PATCH /api/teammates/:id/status — Update self-reported status
router.patch("/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["not_started", "in_progress", "done"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const db = getDb();
  try {
    db.run(`UPDATE teammates SET status = ? WHERE id = ?`, [status, id]);
    saveDatabase();
    res.json({ success: true, id: Number(id), status });
  } catch (err: any) {
    console.error("Error updating status:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

function rowToObject(columns: string[], values: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, i) => {
    obj[col] = values[i];
  });
  return obj;
}

export default router;
