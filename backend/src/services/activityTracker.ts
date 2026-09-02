import { Octokit } from "@octokit/rest";
import { getDb, saveDatabase } from "../db.js";

export interface BranchActivity {
  teammateId: number;
  teammateName: string;
  githubUsername: string;
  branchName: string;
  status: 'not_started' | 'in_progress' | 'done';
  ownedPaths: string[];
  commitCount: number;
  lastCommitAt: string | null;
  lastCommitMessage: string | null;
  lastCommitSha: string | null;
  prStatus: 'none' | 'open' | 'merged' | 'draft' | 'closed';
  prUrl: string | null;
  prNumber: number | null;
  isStale: boolean;
  hoursSinceLastCommit: number | null;
  snapshotAt: string;
}

export interface ProjectActivityReport {
  projectId: number;
  projectName: string;
  githubRepoUrl: string | null;
  staleThresholdHours: number;
  totalCommits: number;
  activeBranchesCount: number;
  staleBranchesCount: number;
  openPrCount: number;
  isDemo: boolean;
  refreshedAt: string;
  branches: BranchActivity[];
}

/**
 * Polls GitHub API or uses cached / simulated snapshot to calculate branch activity.
 */
export async function pollProjectActivity(
  projectId: number,
  pat?: string,
  staleThresholdHours: number = 3
): Promise<ProjectActivityReport> {
  const db = getDb();

  // 1. Fetch project
  const pResult = db.exec(`SELECT * FROM projects WHERE id = ?`, [projectId]);
  if (pResult.length === 0 || pResult[0].values.length === 0) {
    throw new Error("Project not found");
  }
  const project = rowToObject(pResult[0].columns, pResult[0].values[0]);

  // 2. Fetch teammates
  const tmResult = db.exec(`SELECT * FROM teammates WHERE project_id = ?`, [projectId]);
  const teammates = tmResult.length > 0
    ? tmResult[0].values.map((row) => {
        const obj = rowToObject(tmResult[0].columns, row);
        obj.owned_paths = JSON.parse((obj.owned_paths as string) || "[]");
        return obj;
      })
    : [];

  const repoUrl = project.github_repo_url || "";
  const isDemo = !pat || !repoUrl || repoUrl.includes("demo-lead");

  const branches: BranchActivity[] = [];
  const now = new Date();

  // If real GitHub PAT is provided and real repo exists
  if (!isDemo && pat) {
    const octokit = new Octokit({ auth: pat.trim() });
    const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    const owner = repoMatch ? repoMatch[1] : "";
    const repo = repoMatch ? repoMatch[2] : "";

    for (const tm of teammates) {
      let commitCount = 0;
      let lastCommitAt: string | null = null;
      let lastCommitMessage: string | null = null;
      let lastCommitSha: string | null = null;
      let prStatus: BranchActivity["prStatus"] = "none";
      let prUrl: string | null = null;
      let prNumber: number | null = null;

      try {
        // Compare with main to find branch-specific commits
        const compare = await octokit.repos.compareCommitsWithBasehead({
          owner,
          repo,
          basehead: `main...${tm.branch_name}`,
        });

        commitCount = compare.data.ahead_by;
        if (compare.data.commits.length > 0) {
          const latestCommit = compare.data.commits[compare.data.commits.length - 1];
          lastCommitAt = latestCommit.commit.author?.date || null;
          lastCommitMessage = latestCommit.commit.message;
          lastCommitSha = latestCommit.sha.slice(0, 7);
        }

        // Check for Pull Requests
        const pulls = await octokit.pulls.list({
          owner,
          repo,
          head: `${owner}:${tm.branch_name}`,
          state: "all",
        });

        if (pulls.data.length > 0) {
          const pr = pulls.data[0];
          prNumber = pr.number;
          prUrl = pr.html_url;
          if (pr.merged_at) {
            prStatus = "merged";
          } else if (pr.draft) {
            prStatus = "draft";
          } else if (pr.state === "open") {
            prStatus = "open";
          } else {
            prStatus = "closed";
          }
        }
      } catch (e: any) {
        console.warn(`Could not poll branch ${tm.branch_name}:`, e.message);
        // Fallback to cached snapshot
        const cached = getLatestSnapshot(db, tm.id);
        if (cached) {
          commitCount = cached.commit_count;
          lastCommitAt = cached.last_commit_at;
          prStatus = (cached.pr_status as any) || "none";
          prUrl = cached.pr_url;
        }
      }

      // Calculate staleness
      const { isStale, hoursSinceLastCommit } = computeStaleness(
        project.created_at,
        lastCommitAt,
        commitCount,
        staleThresholdHours
      );

      // Record snapshot in SQLite
      insertSnapshot(db, tm.id, commitCount, lastCommitAt, prStatus, prUrl);

      branches.push({
        teammateId: tm.id,
        teammateName: tm.name,
        githubUsername: tm.github_username,
        branchName: tm.branch_name,
        status: tm.status,
        ownedPaths: tm.owned_paths,
        commitCount,
        lastCommitAt,
        lastCommitMessage,
        lastCommitSha,
        prStatus,
        prUrl,
        prNumber,
        isStale,
        hoursSinceLastCommit,
        snapshotAt: now.toISOString(),
      });
    }
  } else {
    // Demo / Simulated mode — use database snapshots or initialize simulated values
    for (const tm of teammates) {
      let cached = getLatestSnapshot(db, tm.id);
      let commitCount = cached ? cached.commit_count : 0;
      let lastCommitAt = cached ? cached.last_commit_at : null;
      let prStatus = (cached?.pr_status as any) || (commitCount > 2 ? "open" : "none");
      let prUrl = cached?.pr_url || (prStatus === "open" ? `${repoUrl}/pull/${tm.id}` : null);

      const { isStale, hoursSinceLastCommit } = computeStaleness(
        project.created_at,
        lastCommitAt,
        commitCount,
        staleThresholdHours
      );

      branches.push({
        teammateId: tm.id,
        teammateName: tm.name,
        githubUsername: tm.github_username,
        branchName: tm.branch_name,
        status: tm.status,
        ownedPaths: tm.owned_paths,
        commitCount,
        lastCommitAt,
        lastCommitMessage: commitCount > 0 ? `feat(${tm.owned_paths[0] || 'core'}): implement task updates` : null,
        lastCommitSha: commitCount > 0 ? `a${tm.id}8f3c` : null,
        prStatus,
        prUrl,
        prNumber: prStatus === "open" ? tm.id : null,
        isStale,
        hoursSinceLastCommit,
        snapshotAt: now.toISOString(),
      });
    }
  }

  saveDatabase();

  const totalCommits = branches.reduce((sum, b) => sum + b.commitCount, 0);
  const activeBranchesCount = branches.filter((b) => b.commitCount > 0).length;
  const staleBranchesCount = branches.filter((b) => b.isStale).length;
  const openPrCount = branches.filter((b) => b.prStatus === "open").length;

  return {
    projectId,
    projectName: project.name,
    githubRepoUrl: project.github_repo_url,
    staleThresholdHours,
    totalCommits,
    activeBranchesCount,
    staleBranchesCount,
    openPrCount,
    isDemo,
    refreshedAt: now.toISOString(),
    branches,
  };
}

/**
 * Simulates a commit on a teammate's branch (useful for demos and interactive testing).
 */
export function simulateBranchCommit(teammateId: number): BranchActivity {
  const db = getDb();
  const tmResult = db.exec(`SELECT * FROM teammates WHERE id = ?`, [teammateId]);
  if (tmResult.length === 0 || tmResult[0].values.length === 0) {
    throw new Error("Teammate not found");
  }
  const tm = rowToObject(tmResult[0].columns, tmResult[0].values[0]);
  tm.owned_paths = JSON.parse((tm.owned_paths as string) || "[]");

  const cached = getLatestSnapshot(db, teammateId);
  const newCommitCount = (cached?.commit_count || 0) + 1;
  const now = new Date().toISOString();

  // If commits reach 3, automatically open a simulated PR
  const newPrStatus = newCommitCount >= 3 ? "open" : "none";
  const prUrl = newPrStatus === "open" ? `https://github.com/demo-lead/repo/pull/${teammateId}` : null;

  insertSnapshot(db, teammateId, newCommitCount, now, newPrStatus, prUrl);

  // If teammate status was not_started, advance to in_progress
  if (tm.status === "not_started") {
    db.run(`UPDATE teammates SET status = 'in_progress' WHERE id = ?`, [teammateId]);
  }
  saveDatabase();

  return {
    teammateId,
    teammateName: tm.name,
    githubUsername: tm.github_username,
    branchName: tm.branch_name,
    status: tm.status === "not_started" ? "in_progress" : tm.status,
    ownedPaths: tm.owned_paths,
    commitCount: newCommitCount,
    lastCommitAt: now,
    lastCommitMessage: `feat(${tm.owned_paths[0] || 'core'}): commit #${newCommitCount}`,
    lastCommitSha: `c${Math.random().toString(16).slice(2, 8)}`,
    prStatus: newPrStatus,
    prUrl,
    prNumber: newPrStatus === "open" ? teammateId : null,
    isStale: false,
    hoursSinceLastCommit: 0,
    snapshotAt: now,
  };
}

function computeStaleness(
  projectCreatedAt: string,
  lastCommitAt: string | null,
  commitCount: number,
  staleThresholdHours: number
): { isStale: boolean; hoursSinceLastCommit: number | null } {
  const now = Date.now();
  const referenceTime = lastCommitAt ? new Date(lastCommitAt).getTime() : new Date(projectCreatedAt).getTime();
  const hoursElapsed = Math.max(0, (now - referenceTime) / (1000 * 60 * 60));

  // Branch is stale if zero commits after threshold OR last commit was longer ago than threshold
  const isStale = (commitCount === 0 && hoursElapsed >= staleThresholdHours) ||
                  (commitCount > 0 && hoursElapsed >= staleThresholdHours * 2);

  return {
    isStale,
    hoursSinceLastCommit: Math.round(hoursElapsed * 10) / 10,
  };
}

function getLatestSnapshot(db: any, teammateId: number): any {
  const res = db.exec(
    `SELECT * FROM commit_snapshots WHERE teammate_id = ? ORDER BY id DESC LIMIT 1`,
    [teammateId]
  );
  if (res.length > 0 && res[0].values.length > 0) {
    return rowToObject(res[0].columns, res[0].values[0]);
  }
  return null;
}

function insertSnapshot(
  db: any,
  teammateId: number,
  commitCount: number,
  lastCommitAt: string | null,
  prStatus: string,
  prUrl: string | null
) {
  db.run(
    `INSERT INTO commit_snapshots (teammate_id, commit_count, last_commit_at, pr_status, pr_url, snapshot_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [teammateId, commitCount, lastCommitAt, prStatus, prUrl]
  );
}

function rowToObject(columns: string[], values: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, i) => {
    obj[col] = values[i];
  });
  return obj;
}
