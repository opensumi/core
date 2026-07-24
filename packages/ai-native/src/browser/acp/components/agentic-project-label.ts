import type { AgenticProjectRecord } from '../agentic-task-registry.service';

interface UnnamedProjectLabelCandidate {
  depth: number;
  project: AgenticProjectRecord;
  segments: string[];
}

function getWorkspacePathSegments(workspacePath: string): string[] {
  const normalizedPath = workspacePath.replace(/\\/g, '/');
  if (/^\/+$/u.test(normalizedPath)) {
    return [];
  }

  return normalizedPath.replace(/\/+$/u, '').split('/').filter(Boolean);
}

function getCandidateLabel(candidate: UnnamedProjectLabelCandidate): string {
  return candidate.segments.slice(-candidate.depth).join('/') || '/';
}

export function getAgenticProjectDisplayLabels(projects: AgenticProjectRecord[]): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  const pending = projects
    .filter((project) => project.availability === 'available' && !project.label?.trim())
    .map<UnnamedProjectLabelCandidate>((project) => ({
      depth: 1,
      project,
      segments: getWorkspacePathSegments(project.workspacePath),
    }));

  while (pending.length > 0) {
    const buckets = new Map<string, UnnamedProjectLabelCandidate[]>();
    pending.forEach((candidate) => {
      const label = getCandidateLabel(candidate);
      buckets.set(label, [...(buckets.get(label) || []), candidate]);
    });

    const resolved = new Set<UnnamedProjectLabelCandidate>();
    buckets.forEach((bucket, label) => {
      const exhausted = bucket.every((candidate) => candidate.depth >= candidate.segments.length);
      if (bucket.length === 1 || exhausted) {
        bucket.forEach((candidate) => {
          labels.set(candidate.project.id, label);
          resolved.add(candidate);
        });
        return;
      }

      bucket.forEach((candidate) => {
        candidate.depth = Math.min(candidate.depth + 1, candidate.segments.length);
      });
    });

    for (let index = pending.length - 1; index >= 0; index--) {
      if (resolved.has(pending[index])) {
        pending.splice(index, 1);
      }
    }
  }

  return labels;
}

export function getAgenticProjectDisplayLabel(
  project: AgenticProjectRecord,
  labels?: ReadonlyMap<string, string>,
): string {
  return (
    project.label?.trim() || labels?.get(project.id) || getWorkspacePathSegments(project.workspacePath).at(-1) || '/'
  );
}
