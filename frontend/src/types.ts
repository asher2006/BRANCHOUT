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

// ---- Validation types ----

export interface OwnershipConflict {
  path: string;
  owners: string[];
}

export interface BalanceWarning {
  message: string;
  details: string;
}
