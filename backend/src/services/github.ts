import { Octokit } from "@octokit/rest";

export interface ProvisionRepoParams {
  pat?: string;
  projectName: string;
  description?: string;
  techStack?: string;
  sharedConventions?: string;
  repoName?: string;
  isPrivate?: boolean;
  existingRepoUrl?: string;
  teammates: Array<{
    name: string;
    github_username: string;
    task_description: string;
    branch_name: string;
    owned_paths: string[];
  }>;
  isDemo?: boolean;
}

export interface ProvisionResult {
  success: boolean;
  isDemo: boolean;
  repoUrl: string;
  owner: string;
  repoName: string;
  defaultBranch: string;
  branches: Array<{
    name: string;
    branchName: string;
    url: string;
    status: 'created' | 'failed' | 'exists';
    error?: string;
  }>;
  filesCommitted: string[];
  logs: string[];
}

export async function validateGitHubToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    return { valid: true, username: data.login };
  } catch (err: any) {
    return { valid: false, error: err.message || "Invalid GitHub token" };
  }
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const clean = url.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const match = clean.match(/(?:github\.com[/:])([^/]+)\/([^/]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  const parts = clean.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

export async function provisionGitHubRepo(params: ProvisionRepoParams): Promise<ProvisionResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`[GitHub Provisioning] ${msg}`);
  };

  // If in demo mode or no PAT provided, perform simulated provisioning
  if (params.isDemo || !params.pat) {
    log("Running in DEMO / SIMULATED mode");
    let demoOwner = "demo-lead";
    let cleanRepoName = (params.repoName || params.projectName)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/^-|-$/g, "") || "hackathon-repo";

    if (params.existingRepoUrl) {
      const parsed = parseRepoUrl(params.existingRepoUrl);
      if (parsed) {
        demoOwner = parsed.owner;
        cleanRepoName = parsed.repo;
        log(`Connected simulated environment to target repo: ${demoOwner}/${cleanRepoName}`);
      }
    }

    const repoUrl = `https://github.com/${demoOwner}/${cleanRepoName}`;

    log(`Cloud repository target: ${repoUrl}`);
    log(`Simulated commit: SHARED_CONVENTIONS.md committed to branch 'main'`);
    log(`Simulated commit: README.md committed to branch 'main'`);

    const branches = params.teammates.map((tm) => {
      log(`Simulated branch cut from 'main': ${tm.branch_name}`);
      return {
        name: tm.name,
        branchName: tm.branch_name,
        url: `${repoUrl}/tree/${tm.branch_name}`,
        status: 'created' as const,
      };
    });

    return {
      success: true,
      isDemo: true,
      repoUrl,
      owner: demoOwner,
      repoName: cleanRepoName,
      defaultBranch: "main",
      branches,
      filesCommitted: ["README.md", "SHARED_CONVENTIONS.md"],
      logs,
    };
  }

  // Real Octokit execution
  const octokit = new Octokit({ auth: params.pat });
  let owner = "";
  let repo = "";
  let repoUrl = "";
  let defaultBranch = "main";
  const filesCommitted: string[] = [];
  const branches: ProvisionResult["branches"] = [];

  try {
    // 1. Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    log(`Authenticated with GitHub as @${user.login}`);

    // 2. Connect to existing repo OR create a new repo
    if (params.existingRepoUrl && params.existingRepoUrl.trim()) {
      const parsed = parseRepoUrl(params.existingRepoUrl);
      if (!parsed) {
        throw new Error(`Invalid GitHub repository URL: "${params.existingRepoUrl}". Use https://github.com/owner/repo or owner/repo format.`);
      }
      owner = parsed.owner;
      repo = parsed.repo;
      log(`Connecting to existing cloud repository: ${owner}/${repo}`);

      const existing = await octokit.repos.get({ owner, repo });
      repoUrl = existing.data.html_url;
      defaultBranch = existing.data.default_branch || "main";
      log(`Connected successfully to cloud repo: ${repoUrl} (default branch: ${defaultBranch})`);
    } else {
      owner = user.login;
      const targetRepoName = (params.repoName || params.projectName)
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/^-|-$/g, "") || "hackathon-repo";

      repo = targetRepoName;

      // Check if repo already exists or create new
      try {
        const existing = await octokit.repos.get({ owner, repo });
        repoUrl = existing.data.html_url;
        defaultBranch = existing.data.default_branch || "main";
        log(`Found existing repository at ${repoUrl}`);
      } catch (e: any) {
        if (e.status === 404) {
          log(`Creating new ${params.isPrivate ? 'private' : 'public'} cloud repository: ${owner}/${repo}`);
          const created = await octokit.repos.createForAuthenticatedUser({
            name: repo,
            description: params.description || `Hackathon project: ${params.projectName}`,
            private: !!params.isPrivate,
            auto_init: true, // Creates initial commit on main
          });
          repoUrl = created.data.html_url;
          defaultBranch = created.data.default_branch || "main";
          log(`Created cloud repository: ${repoUrl}`);
          // Small delay to allow GitHub to initialize default branch
          await new Promise((r) => setTimeout(r, 1500));
        } else {
          throw e;
        }
      }
    }

    // 3. Commit SHARED_CONVENTIONS.md to default branch
    const conventionsContent = generateSharedConventionsDoc(params);
    log(`Committing SHARED_CONVENTIONS.md to branch '${defaultBranch}'...`);
    await commitFile(octokit, {
      owner,
      repo,
      path: "SHARED_CONVENTIONS.md",
      content: conventionsContent,
      message: "chore: add SHARED_CONVENTIONS.md for hackathon team",
      branch: defaultBranch,
    });
    filesCommitted.push("SHARED_CONVENTIONS.md");
    log("Successfully committed SHARED_CONVENTIONS.md to cloud");

    // 4. Commit or update README.md on default branch
    const readmeContent = generateReadmeDoc(params);
    log(`Updating README.md with project overview and teammate branch directory on '${defaultBranch}'...`);
    await commitFile(octokit, {
      owner,
      repo,
      path: "README.md",
      content: readmeContent,
      message: "docs: update README with team branch guide",
      branch: defaultBranch,
    });
    filesCommitted.push("README.md");
    log("Successfully committed README.md to cloud");

    // 5. Get default branch SHA
    log(`Resolving '${defaultBranch}' branch reference commit SHA...`);
    const refData = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const baseSha = refData.data.object.sha;
    log(`Base branch SHA: ${baseSha.slice(0, 7)}`);

    // 6. Cut branches for teammates off default branch
    for (const tm of params.teammates) {
      const branchRef = `heads/${tm.branch_name}`;
      try {
        log(`Cutting cloud branch '${tm.branch_name}' for ${tm.name} (@${tm.github_username})...`);
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/${branchRef}`,
          sha: baseSha,
        });
        log(`Created cloud branch: ${tm.branch_name}`);
        branches.push({
          name: tm.name,
          branchName: tm.branch_name,
          url: `${repoUrl}/tree/${tm.branch_name}`,
          status: 'created',
        });
      } catch (branchErr: any) {
        if (branchErr.status === 422) {
          log(`Cloud branch '${tm.branch_name}' already exists.`);
          branches.push({
            name: tm.name,
            branchName: tm.branch_name,
            url: `${repoUrl}/tree/${tm.branch_name}`,
            status: 'exists',
          });
        } else {
          log(`Failed to create branch '${tm.branch_name}': ${branchErr.message}`);
          branches.push({
            name: tm.name,
            branchName: tm.branch_name,
            url: `${repoUrl}/tree/${tm.branch_name}`,
            status: 'failed',
            error: branchErr.message,
          });
        }
      }
    }

    return {
      success: true,
      isDemo: false,
      repoUrl,
      owner,
      repoName: repo,
      defaultBranch,
      branches,
      filesCommitted,
      logs,
    };
  } catch (err: any) {
    log(`Provisioning failed with error: ${err.message}`);
    throw new Error(`GitHub Cloud Error: ${err.message}`);
  }
}

async function commitFile(
  octokit: Octokit,
  opts: { owner: string; repo: string; path: string; content: string; message: string; branch?: string }
) {
  const branch = opts.branch || "main";
  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({
      owner: opts.owner,
      repo: opts.repo,
      path: opts.path,
      ref: branch,
    });
    if (!Array.isArray(existing.data) && "sha" in existing.data) {
      sha = existing.data.sha;
    }
  } catch {
    // File doesn't exist yet, sha remains undefined
  }

  await octokit.repos.createOrUpdateFileContents({
    owner: opts.owner,
    repo: opts.repo,
    path: opts.path,
    message: opts.message,
    content: Buffer.from(opts.content, "utf-8").toString("base64"),
    sha,
    branch,
  });
}

function generateSharedConventionsDoc(params: ProvisionRepoParams): string {
  const parts: string[] = [];
  parts.push(`# Shared Conventions — ${params.projectName}\n`);
  parts.push(`*Generated automatically by Branchout for hackathon coordination.*\n`);

  if (params.techStack) {
    parts.push(`## Tech Stack\n\n\`${params.techStack}\`\n`);
  }

  if (params.sharedConventions?.trim()) {
    parts.push(`## Team Conventions & Standards\n\n${params.sharedConventions.trim()}\n`);
  } else {
    parts.push(`## General Guidelines\n\n- Write clean, type-safe code\n- Keep changes scoped to your assigned paths\n- Open a PR to \`main\` when ready for review\n`);
  }

  parts.push(`## Team Branch & Path Allocations\n`);
  parts.push(`| Teammate | GitHub | Assigned Branch | Owned Paths |`);
  parts.push(`| :--- | :--- | :--- | :--- |`);
  for (const tm of params.teammates) {
    const paths = tm.owned_paths.length > 0 ? tm.owned_paths.map(p => `\`${p}\``).join(', ') : '*(None specified)*';
    parts.push(`| **${tm.name}** | [@${tm.github_username}](https://github.com/${tm.github_username}) | \`${tm.branch_name}\` | ${paths} |`);
  }

  parts.push(`\n---\n*Created with Branchout*`);
  return parts.join("\n");
}

function generateReadmeDoc(params: ProvisionRepoParams): string {
  const parts: string[] = [];
  parts.push(`# ${params.projectName}\n`);

  if (params.description) {
    parts.push(`> ${params.description}\n`);
  }

  if (params.techStack) {
    parts.push(`### Tech Stack\n${params.techStack}\n`);
  }

  parts.push(`## Hackathon Team Workflow\n`);
  parts.push(`This repository is managed with **Branchout**. Each team member works in their dedicated branch:\n`);

  for (const tm of params.teammates) {
    parts.push(`### 🌿 \`${tm.branch_name}\` — ${tm.name} (@${tm.github_username})`);
    if (tm.task_description) {
      parts.push(`**Task:** ${tm.task_description}`);
    }
    if (tm.owned_paths.length > 0) {
      parts.push(`**Owned Paths:** ${tm.owned_paths.map(p => `\`${p}\``).join(', ')}`);
    }
    parts.push(``);
  }

  parts.push(`## Shared Conventions`);
  parts.push(`Please review [SHARED_CONVENTIONS.md](./SHARED_CONVENTIONS.md) before writing code.`);
  return parts.join("\n");
}
