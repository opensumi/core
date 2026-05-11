import { Autowired, Injectable } from '@opensumi/di';
import { WorkspaceTrustService, WorkspaceTrustState } from '@opensumi/ide-core-browser';
import { ContributionProvider, createContributionProvider } from '@opensumi/ide-core-common';

/**
 * Base allowed extension IDs in restricted mode
 */
export const DEFAULT_ALLOWED_EXTENSION_IDS = ['vscode.theme-defaults', 'vscode.typescript-language-features'];

/**
 * Contribution token for allowed extensions registration
 */
export const AllowedExtensionsContribution = Symbol('AllowedExtensionsContribution');

export interface IAllowedExtensionsContribution {
  /**
   * Return additional extension IDs allowed in restricted mode
   */
  getAllowedExtensionIds(): string[];
}

@Injectable()
export class AllowedExtensionService {
  @Autowired(WorkspaceTrustService)
  private readonly workspaceTrustService: WorkspaceTrustService;

  @Autowired(AllowedExtensionsContribution)
  private readonly contributions: ContributionProvider<IAllowedExtensionsContribution>;

  /**
   * Get all allowed extension IDs (base + contributions)
   */
  getAllowedExtensionIds(): string[] {
    const allIds = new Set<string>(DEFAULT_ALLOWED_EXTENSION_IDS);
    const contribs = this.contributions.getContributions();
    for (const c of contribs) {
      for (const id of c.getAllowedExtensionIds()) {
        allIds.add(id);
      }
    }
    return Array.from(allIds);
  }

  /**
   * Filter extension metadata to only include allowed extensions in restricted mode
   */
  filterExtensions<T extends { id: string }>(extensions: T[]): T[] {
    if (!this.workspaceTrustService.isRestricted()) {
      return extensions;
    }
    const allowedIds = new Set(this.getAllowedExtensionIds());
    return extensions.filter((ext) => allowedIds.has(ext.id));
  }

  /**
   * Wait for trust decision then filter extensions
   */
  async filterExtensionsAfterTrustDecided<T extends { id: string }>(extensions: T[]): Promise<T[]> {
    await this.workspaceTrustService.whenTrustDecided();
    return this.filterExtensions(extensions);
  }
}
