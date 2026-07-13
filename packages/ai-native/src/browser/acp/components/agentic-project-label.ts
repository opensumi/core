import type { AgenticProjectRecord } from '../agentic-task-registry.service';

export function getAgenticProjectDisplayLabel(project: AgenticProjectRecord): string {
  return project.label?.trim() || project.workspacePath;
}
