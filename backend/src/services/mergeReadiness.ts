export type MergeReadiness =
  | "no_pr"
  | "draft"
  | "needs_rebase"
  | "checks_failing"
  | "checks_pending"
  | "ready"
  | "merged"
  | "blocked";

export type CheckStatus = "passing" | "failing" | "pending" | "unknown";

export interface MergeReadinessInput {
  prStatus: "none" | "open" | "merged" | "draft" | "closed";
  behindBy: number;
  mergeable: boolean | null;
  checks: CheckStatus;
}

export function evaluateMergeReadiness(input: MergeReadinessInput): MergeReadiness {
  if (input.prStatus === "merged") return "merged";
  if (input.prStatus === "none" || input.prStatus === "closed") return "no_pr";
  if (input.prStatus === "draft") return "draft";
  if (input.behindBy > 0 || input.mergeable === false) return "needs_rebase";
  if (input.checks === "failing") return "checks_failing";
  if (input.checks === "pending") return "checks_pending";
  if (input.mergeable === null || input.checks === "unknown") return "blocked";
  return "ready";
}

export function mergeReadinessLabel(readiness: MergeReadiness): string {
  const labels: Record<MergeReadiness, string> = {
    no_pr: "No PR",
    draft: "Draft PR",
    needs_rebase: "Needs rebase",
    checks_failing: "Checks failing",
    checks_pending: "Checks pending",
    ready: "Ready to merge",
    merged: "Merged",
    blocked: "Needs review",
  };
  return labels[readiness];
}
