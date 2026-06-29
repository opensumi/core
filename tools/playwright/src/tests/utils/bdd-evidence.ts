import { promises as fs } from 'fs';
import path from 'path';

import type { Page, TestInfo } from '@playwright/test';

type CriticalPointStatus = 'pass' | 'blocked' | 'fail';
type ScenarioVerdict = 'PASS' | 'BLOCKED' | 'FAIL';
type HardeningVerdict = 'CONVERT' | 'DEFER' | 'DO_NOT_CONVERT';

interface BddEvidenceOptions {
  sourceScenario?: string;
  profile?: string;
  executionMode?: string;
  hardeningVerdict?: HardeningVerdict;
}

interface CriticalPoint {
  id: string;
  requirement: string;
  status: CriticalPointStatus;
  evidence: string[];
  notes?: string;
}

interface Artifact {
  file: string;
  type: 'screenshot' | 'json';
  purpose: string;
}

interface FinalizeOptions {
  scenarioVerdict: ScenarioVerdict;
  hardeningVerdict?: HardeningVerdict;
  runtime?: Record<string, unknown>;
}

const ENABLED_ENV = 'OPENSUMI_BDD_EVIDENCE';
const DIR_ENV = 'OPENSUMI_BDD_EVIDENCE_DIR';
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const DEFAULT_EVIDENCE_ROOT = path.join(REPO_ROOT, 'test/bdd/evidence');

function evidenceEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[ENABLED_ENV] || '').toLowerCase());
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'artifact'
  );
}

function redactString(value: string): string {
  return value
    .replace(/\/mcp\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g, '/mcp/<redacted>')
    .replace(/(["']?(?:apiKey|api_key|token|authorization|password|secret)["']?\s*[:=]\s*["'])[^"']+/gi, '$1<redacted>')
    .replace(/\b(?:sk|xox[baprs]|gh[pousr])_[A-Za-z0-9_-]{12,}\b/g, '<redacted-token>');
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactValue(item)]),
    );
  }
  return value;
}

function relativeToEvidenceDir(evidenceDir: string, filePath: string): string {
  return path.relative(evidenceDir, filePath).replace(/\\/g, '/');
}

export class BddEvidence {
  private artifacts: Artifact[] = [];
  private criticalPoints: CriticalPoint[] = [];
  private finalized = false;

  constructor(
    private readonly enabled: boolean,
    private readonly evidenceDir: string,
    private readonly scenarioName: string,
    private readonly options: BddEvidenceOptions,
    private readonly testInfo: TestInfo,
  ) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  async captureScreenshot(page: Page, name: string, purpose: string): Promise<string | undefined> {
    if (!this.enabled) {
      return undefined;
    }
    const fileName = `${sanitizeFilename(name)}.png`;
    const filePath = path.join(this.evidenceDir, fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await page.screenshot({ path: filePath });
    const relativePath = relativeToEvidenceDir(this.evidenceDir, filePath);
    this.artifacts.push({ file: relativePath, type: 'screenshot', purpose });
    return relativePath;
  }

  async saveJson(name: string, data: unknown, purpose: string): Promise<string | undefined> {
    if (!this.enabled) {
      return undefined;
    }
    const fileName = `${sanitizeFilename(name)}.json`;
    const filePath = path.join(this.evidenceDir, fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(redactValue(data), null, 2)}\n`, 'utf8');
    const relativePath = relativeToEvidenceDir(this.evidenceDir, filePath);
    this.artifacts.push({ file: relativePath, type: 'json', purpose });
    return relativePath;
  }

  recordCriticalPoint(point: CriticalPoint): void {
    if (!this.enabled) {
      return;
    }
    this.criticalPoints.push({
      ...point,
      evidence: point.evidence.filter(Boolean),
    });
  }

  async finalize(options: FinalizeOptions): Promise<void> {
    if (!this.enabled || this.finalized) {
      return;
    }
    this.finalized = true;
    await fs.mkdir(this.evidenceDir, { recursive: true });
    const payload = {
      scenario: this.scenarioName,
      sourceScenario: this.options.sourceScenario || '',
      profile: this.options.profile || '',
      executionMode: this.options.executionMode || 'deterministic-fixture',
      testTitle: this.testInfo.title,
      createdAt: new Date().toISOString(),
      runtime: redactValue(options.runtime || {}),
      criticalPoints: this.criticalPoints,
      artifacts: this.artifacts,
      scenarioVerdict: options.scenarioVerdict,
      hardeningVerdict: options.hardeningVerdict || this.options.hardeningVerdict || 'DEFER',
    };

    await fs.writeFile(path.join(this.evidenceDir, 'evidence.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fs.writeFile(path.join(this.evidenceDir, 'report.md'), this.renderReport(payload), 'utf8');
  }

  private renderReport(payload: {
    scenario: string;
    sourceScenario: string;
    profile: string;
    executionMode: string;
    testTitle: string;
    runtime: unknown;
    criticalPoints: CriticalPoint[];
    artifacts: Artifact[];
    scenarioVerdict: ScenarioVerdict;
    hardeningVerdict: HardeningVerdict;
  }): string {
    const cpRows = payload.criticalPoints.length
      ? payload.criticalPoints
          .map(
            (point) =>
              `| ${point.id} | ${point.status.toUpperCase()} | ${point.requirement} | ${
                point.evidence.join('<br>') || '-'
              } | ${point.notes || ''} |`,
          )
          .join('\n')
      : '| - | - | No critical points recorded. | - | - |';
    const artifactRows = payload.artifacts.length
      ? payload.artifacts.map((artifact) => `| ${artifact.file} | ${artifact.type} | ${artifact.purpose} |`).join('\n')
      : '| - | - | No artifacts recorded. |';

    return `# BDD Evidence: ${payload.scenario}

**Source:** ${payload.sourceScenario || '-'}
**Profile:** ${payload.profile || '-'}
**Execution mode:** ${payload.executionMode}
**Test:** ${payload.testTitle}
**Scenario verdict:** ${payload.scenarioVerdict}
**Hardening verdict:** ${payload.hardeningVerdict}

## Runtime

\`\`\`json
${JSON.stringify(payload.runtime, null, 2)}
\`\`\`

## Critical Points

| CP | Result | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
${cpRows}

## Evidence Files

| File | Type | Purpose |
| --- | --- | --- |
${artifactRows}
`;
  }
}

export function createBddEvidence(
  testInfo: TestInfo,
  scenarioName: string,
  options: BddEvidenceOptions = {},
): BddEvidence {
  const enabled = evidenceEnabled();
  const root = process.env[DIR_ENV] ? path.resolve(process.env[DIR_ENV]) : path.join(DEFAULT_EVIDENCE_ROOT, today());
  const evidenceDir = path.join(root, sanitizeFilename(scenarioName));

  return new BddEvidence(enabled, evidenceDir, scenarioName, options, testInfo);
}
