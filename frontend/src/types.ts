// ---- Shared types for Branchout ----

export interface TeammateInput {
  name: string;
  github_username: string;
  task_description: string;
  owned_paths: string[];
}

export interface ProjectInput {
  name: string;
  description: string;
  tech_stack: string;
  shared_conventions: string;
  teammates: TeammateInput[];
}

export interface Teammate extends TeammateInput {
  id: number;
  project_id: number;
  branch_name: string;
  status: 'not_started' | 'in_progress' | 'done';
}

export interface Project {
  id: number;
  name: string;
  description: string;
  tech_stack: string;
  shared_conventions: string;
  github_repo_url: string | null;
  created_at: string;
  teammates: Teammate[];
}

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

// ---- Validation types ----

export interface OwnershipConflict {
  path: string;
  owners: string[];
}

export interface BalanceWarning {
  message: string;
  details: string;
}

