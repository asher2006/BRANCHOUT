import { Router } from "express";
import { getDb, saveDatabase } from "../db.js";

const router = Router();

// POST /api/projects — Create a new project with teammates
router.post("/", (req, res) => {
  const { name, description, tech_stack, shared_conventions, teammates } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  if (!teammates || !Array.isArray(teammates) || teammates.length === 0) {
    res.status(400).json({ error: "At least one teammate is required" });
    return;
  }

  const db = getDb();

  try {
    // Insert project
    db.run(
      `INSERT INTO projects (name, description, tech_stack, shared_conventions) VALUES (?, ?, ?, ?)`,
      [name.trim(), description || "", tech_stack || "", shared_conventions || ""]
    );

    // Get the inserted project ID
    const result = db.exec("SELECT last_insert_rowid() as id");
    const projectId = result[0].values[0][0] as number;

    // Insert teammates
    for (const mate of teammates) {
      if (!mate.name?.trim() || !mate.github_username?.trim()) {
        continue;
      }

      const ownedPathsJson = JSON.stringify(
        (mate.owned_paths || []).filter((p: string) => p.trim())
      );

      // Generate branch name: slugified task + github username
      const taskSlug = (mate.task_description || "task")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
      const branchName = `${taskSlug}-${mate.github_username.trim().toLowerCase()}`;

      db.run(
        `INSERT INTO teammates (project_id, name, github_username, task_description, owned_paths, branch_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          mate.name.trim(),
          mate.github_username.trim(),
          mate.task_description || "",
          ownedPathsJson,
          branchName,
        ]
      );
    }

    saveDatabase();

    // Fetch the created project with teammates
    const project = db.exec(
      `SELECT * FROM projects WHERE id = ?`,
      [projectId]
    );
    const teammatRows = db.exec(
      `SELECT * FROM teammates WHERE project_id = ?`,
      [projectId]
    );

    const projectData = rowToObject(project[0].columns, project[0].values[0]);
    const teammatesData = teammatRows.length > 0
      ? teammatRows[0].values.map((row) => {
          const obj = rowToObject(teammatRows[0].columns, row);
          obj.owned_paths = JSON.parse((obj.owned_paths as string) || "[]");
          return obj;
        })
      : [];

    res.status(201).json({ ...projectData, teammates: teammatesData });
  } catch (err) {
    console.error("Failed to create project:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects — List all projects
router.get("/", (_req, res) => {
  const db = getDb();

  try {
    const result = db.exec(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM teammates t WHERE t.project_id = p.id) as teammate_count
      FROM projects p 
      ORDER BY p.created_at DESC
    `);

    if (result.length === 0) {
      res.json([]);
      return;
    }

    const projects = result[0].values.map((row) =>
      rowToObject(result[0].columns, row)
    );

    res.json(projects);
  } catch (err) {
    console.error("Failed to fetch projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// GET /api/projects/:id — Get a single project with teammates
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const db = getDb();

  try {
    const projectResult = db.exec(`SELECT * FROM projects WHERE id = ?`, [id]);

    if (projectResult.length === 0 || projectResult[0].values.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const project = rowToObject(projectResult[0].columns, projectResult[0].values[0]);

    const teammateResult = db.exec(
      `SELECT * FROM teammates WHERE project_id = ?`,
      [id]
    );

    const teammates =
      teammateResult.length > 0
        ? teammateResult[0].values.map((row) => {
            const obj = rowToObject(teammateResult[0].columns, row);
            obj.owned_paths = JSON.parse((obj.owned_paths as string) || "[]");
            return obj;
          })
        : [];

    res.json({ ...project, teammates });
  } catch (err) {
    console.error("Failed to fetch project:", err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// POST /api/projects/:id/provision — Provision real GitHub repo, commit conventions & cut branches
router.post("/:id/provision", async (req, res) => {
  const { id } = req.params;
  const { pat, repoName, isPrivate, isDemo } = req.body;
  const db = getDb();

  try {
    const projectResult = db.exec(`SELECT * FROM projects WHERE id = ?`, [id]);
    if (projectResult.length === 0 || projectResult[0].values.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const project = rowToObject(projectResult[0].columns, projectResult[0].values[0]);

    const teammateResult = db.exec(
      `SELECT * FROM teammates WHERE project_id = ?`,
      [id]
    );

    const teammates =
      teammateResult.length > 0
        ? teammateResult[0].values.map((row) => {
            const obj = rowToObject(teammateResult[0].columns, row);
            obj.owned_paths = JSON.parse((obj.owned_paths as string) || "[]");
            return obj;
          })
        : [];

    const { provisionGitHubRepo } = await import("../services/github.js");

    const result = await provisionGitHubRepo({
      pat: pat ? pat.trim() : undefined,
      projectName: project.name,
      description: project.description,
      techStack: project.tech_stack,
      sharedConventions: project.shared_conventions,
      repoName: repoName ? repoName.trim() : undefined,
      isPrivate: !!isPrivate,
      isDemo: !!isDemo,
      teammates: teammates.map((tm: any) => ({
        name: tm.name,
        github_username: tm.github_username,
        task_description: tm.task_description,
        branch_name: tm.branch_name,
        owned_paths: tm.owned_paths,
      })),
    });

    // Update project github_repo_url in database
    db.run(`UPDATE projects SET github_repo_url = ? WHERE id = ?`, [
      result.repoUrl,
      id,
    ]);
    saveDatabase();

    res.json({
      ...result,
      projectId: Number(id),
    });
  } catch (err: any) {
    console.error("Provisioning error:", err);
    res.status(500).json({
      error: err.message || "Failed to provision repository",
    });
  }
});

// Helper: convert sql.js row array to object
function rowToObject(columns: string[], values: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, i) => {
    obj[col] = values[i];
  });
  return obj;
}

export default router;
