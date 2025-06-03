import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { AppConfig } from '@opensumi/ide-core-browser/lib/react-providers/config-provider';
import { AINativeSettingSectionsId, IApplicationService, RulesServiceToken } from '@opensumi/ide-core-common';
import { WithEventBus } from '@opensumi/ide-core-common/lib/event-bus/event-decorator';
import { MarkerSeverity } from '@opensumi/ide-core-common/lib/types/markers/markers';
import { Emitter, OperatingSystem, URI, parseGlob } from '@opensumi/ide-core-common/lib/utils';
import {
  EditorDocumentModelCreationEvent,
  EditorDocumentModelRemovalEvent,
  EditorDocumentModelSavedEvent,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser/doc-model/types';
import { EditorSelectionChangeEvent } from '@opensumi/ide-editor/lib/browser/types';
import { FileType, IFileServiceClient } from '@opensumi/ide-file-service';
import { IMarkerService } from '@opensumi/ide-markers/lib/common/types';
import { Range } from '@opensumi/ide-monaco';
import { ITerminalApiService } from '@opensumi/ide-terminal-next';
import { isString, match } from '@opensumi/ide-utils';

import { AttachFileContext, FileContext, LLMContextService, SerializedContext } from '../../common/llm-context';
import { ProjectRule } from '../../common/types';
import { RulesService } from '../rules/rules.service';

@Injectable()
export class LLMContextServiceImpl extends WithEventBus implements LLMContextService {
  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(IEditorDocumentModelService)
  protected readonly docModelManager: IEditorDocumentModelService;

  @Autowired(IMarkerService)
  protected readonly markerService: IMarkerService;

  @Autowired(IFileServiceClient)
  protected readonly fileService: IFileServiceClient;

  @Autowired(RulesServiceToken)
  protected readonly rulesService: RulesService;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(ITerminalApiService)
  protected readonly terminalService: ITerminalApiService;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  private isAutoCollecting = false;

  private contextVersion = 0;

  private readonly maxAttachFilesLimit = 10;
  private readonly maxAttachFoldersLimit = 10;
  private readonly maxViewFilesLimit = 20;
  private attachedFiles: FileContext[] = [];
  private attachedFolders: FileContext[] = [];
  private attachedRules: ProjectRule[] = [];
  private readonly recentlyViewFiles: FileContext[] = [];
  private readonly onDidContextFilesChangeEmitter = new Emitter<{
    viewed: FileContext[];
    attached: FileContext[];
    attachedFolders: FileContext[];
    attachedRules: ProjectRule[];
    version: number;
  }>();
  private hasUserManualReference = false;
  onDidContextFilesChangeEvent = this.onDidContextFilesChangeEmitter.event;

  private addFileToList(file: FileContext, list: FileContext[], maxLimit: number) {
    const existingIndex = list.findIndex(
      (f) =>
        f.uri.toString() === file.uri.toString() &&
        f.selection?.[0] === file.selection?.[0] &&
        f.selection?.[1] === file.selection?.[1],
    );
    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
    }

    list.push(file);
    if (list.length > maxLimit) {
      list.shift();
    }
  }

  private addFolderToList(folder: FileContext, list: FileContext[], maxLimit: number) {
    const existingIndex = list.findIndex((f) => f.uri.toString() === folder.uri.toString());
    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
    }

    list.push(folder);
    if (list.length > maxLimit) {
      list.shift();
    }
  }

  addRuleToContext(uri: URI): void {
    if (!uri) {
      return;
    }

    if (this.attachedRules.some((rule) => rule.path === uri.toString())) {
      return;
    }

    const rule = this.rulesService.projectRules.find((rule) => rule.path === uri.toString());
    if (!rule) {
      return;
    }

    this.attachedRules.push(rule);
    this.notifyContextChange();
  }

  addFileToContext(uri: URI, selection?: [number, number], isManual = false): void {
    if (!uri) {
      return;
    }

    const file = { uri, selection };
    const targetList = isManual ? this.attachedFiles : this.recentlyViewFiles;
    const maxLimit = isManual ? this.maxAttachFilesLimit : this.maxViewFilesLimit;

    if (isManual) {
      this.docModelManager.createModelReference(uri);
      this.hasUserManualReference = true;
    }

    this.addFileToList(file, targetList, maxLimit);
    this.notifyContextChange();
  }

  addFolderToContext(uri: URI): void {
    if (!uri) {
      return;
    }

    const file = { uri };

    this.addFolderToList(file, this.attachedFolders, this.maxAttachFoldersLimit);
    this.notifyContextChange();
  }

  private notifyContextChange(): void {
    this.onDidContextFilesChangeEmitter.fire(this.getAllContextFiles());
  }

  cleanFileContext() {
    this.attachedFiles = [];
    this.attachedFolders = [];
    this.hasUserManualReference = false;
    this.attachedRules = [];
    this.notifyContextChange();
  }

  private getAllContextFiles() {
    return {
      viewed: this.recentlyViewFiles,
      attached: this.attachedFiles,
      attachedFolders: this.attachedFolders,
      attachedRules: this.attachedRules,
      version: this.contextVersion++,
    };
  }

  removeFileFromContext(uri: URI, isManual = false): void {
    const targetList = isManual ? this.attachedFiles : this.recentlyViewFiles;
    const index = targetList.findIndex((file) => file.uri.toString() === uri.toString());
    if (index > -1) {
      targetList.splice(index, 1);
    }
    if (isManual) {
      if (this.attachedFiles.length === 0) {
        this.hasUserManualReference = false;
      }
    }
    this.notifyContextChange();
  }

  removeFolderFromContext(uri: URI): void {
    const targetList = this.attachedFolders;
    const index = targetList.findIndex((folder) => folder.uri.toString() === uri.toString());
    if (index > -1) {
      targetList.splice(index, 1);
    }
    this.notifyContextChange();
  }

  removeRuleFromContext(uri: URI): void {
    const targetList = this.attachedRules;
    const index = targetList.findIndex((rule) => rule.path === uri.toString());
    if (index > -1) {
      targetList.splice(index, 1);
    }
    this.notifyContextChange();
  }

  startAutoCollection(): void {
    if (this.isAutoCollecting) {
      return;
    }
    this.isAutoCollecting = true;

    this.startAutoCollectionInternal();
  }

  private startAutoCollectionInternal(): void {
    this.disposables.push(
      this.eventBus.on(EditorDocumentModelCreationEvent, (event) => {
        if (event.payload.uri.scheme !== 'file') {
          return;
        }
        this.addFileToContext(event.payload.uri, undefined, false);
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorDocumentModelRemovalEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }

        this.removeFileFromContext(event.payload, false);
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorDocumentModelSavedEvent, (event) => {
        if (event.payload.scheme !== 'file') {
          return;
        }
        // TODO: 保存文件的逻辑
      }),
    );

    this.disposables.push(
      this.eventBus.on(EditorSelectionChangeEvent, (event) => {
        if (event.payload.selections.length > 0) {
          const selection = [
            event.payload.selections[0].selectionStartLineNumber,
            event.payload.selections[0].positionLineNumber,
          ].sort() as [number, number];

          if (!this.hasUserManualReference) {
            // 当没有用户手动引用时，才自动收集
            if (selection[0] === selection[1]) {
              this.addFileToContext(event.payload.editorUri, undefined, false);
            } else {
              this.addFileToContext(
                event.payload.editorUri,
                selection.sort((a, b) => a - b),
                false,
              );
            }
          }
        }
      }),
    );
  }

  stopAutoCollection(): void {
    this.dispose();
  }

  async serialize(): Promise<SerializedContext> {
    const files = this.getAllContextFiles();
    const workspaceRoot = URI.file(this.appConfig.workspaceDir);

    return {
      recentlyViewFiles: this.serializeRecentlyViewFiles(files.viewed, workspaceRoot),
      attachedFiles: this.serializeAttachedFiles(files.attached, workspaceRoot),
      attachedFolders: await this.serializeAttachedFolders(files.attachedFolders),
      attachedRules: this.serializeAttachedRules(files.attachedRules),
      globalRules: this.serializeGlobalRules(),
    };
  }

  private async serializeAttachedFolders(folders: FileContext[]): Promise<string[]> {
    // 去重
    const folderPath = Array.from(new Set(folders.map((folder) => folder.uri.toString())));
    const header = 'Here are some folder(s) I manually attached to my message:';
    const folderSections = await Promise.all(
      folderPath.map(async (folder) => {
        const folderUri = new URI(folder);
        const absolutePath = folderUri.codeUri.fsPath;
        const folderStructure = await this.getFormattedFolderStructure(absolutePath);

        return `Folder: ${absolutePath}
Contents of directory:

${folderStructure}`;
      }),
    );
    if (folderSections.length > 0) {
      return [header, ...folderSections, ''];
    }
    return [];
  }

  private async getFormattedFolderStructure(folder: string): Promise<string> {
    const result: string[] = [];
    try {
      const stat = await this.fileService.getFileStat(folder);

      for (const child of stat?.children || []) {
        const relativePath = new URI(folder).relative(new URI(child.uri))!.toString();

        if (child.isSymbolicLink) {
          // 处理软链接
          const target = await this.fileService.getFileStat(child.realUri || child.uri);
          if (target) {
            result.push(`[link] ${relativePath} -> ${target}`);
          } else {
            result.push(`[link] ${relativePath} (broken)`);
          }
          continue;
        }

        if (child.type === FileType.Directory) {
          // 计算目录下的项目数量
          const childStat = await this.fileService.getFileStat(child.uri);
          const itemCount = childStat?.children?.length || 0;
          result.push(`[dir]  ${relativePath}/ (${itemCount} items)`);
        } else if (child.type === FileType.File) {
          result.push(`[file] ${relativePath}`);
        }
      }
    } catch {
      return '';
    }

    return result.join('\n');
  }

  private serializeRecentlyViewFiles(files: FileContext[], workspaceRoot: URI): string[] {
    return files
      .map((file) => workspaceRoot.relative(file.uri)?.toString() || file.uri.parent.toString())
      .filter(Boolean);
  }

  private serializeAttachedFiles(files: FileContext[], workspaceRoot: URI): AttachFileContext[] {
    return files
      .map((file) => this.serializeAttachedFile(file, workspaceRoot))
      .filter(Boolean) as unknown as AttachFileContext[];
  }

  private serializeAttachedFile(file: FileContext, workspaceRoot: URI) {
    try {
      const ref = this.docModelManager.getModelReference(file.uri);
      if (!ref) {
        return null;
      }

      return {
        content: ref.instance.getText(file.selection && new Range(file.selection[0], 0, file.selection[1], Infinity)),
        lineErrors: this.getFileErrors(file.uri),
        path: workspaceRoot.relative(file.uri)!.toString(),
        language: ref.instance.languageId!,
        selection: file.selection,
      };
    } catch (e) {
      return null;
    }
  }

  private getFileErrors(uri: URI): string[] {
    return this.markerService
      .getManager()
      .getMarkers({
        resource: uri.toString(),
        severities: MarkerSeverity.Error,
      })
      .map((marker) => marker.message);
  }

  private serializeGlobalRules(): string[] {
    const globalRules = this.preferenceService.get<string>(AINativeSettingSectionsId.GlobalRules);
    if (!globalRules) {
      return [];
    }

    const platform =
      this.applicationService.backendOS === OperatingSystem.Windows
        ? 'windows'
        : this.applicationService.backendOS === OperatingSystem.Linux
        ? 'linux'
        : 'darwin';
    const shell = this.preferenceService.get<string>('terminal.type', 'zsh');
    let shellName = shell;
    if (shell === 'default') {
      shellName = this.applicationService.backendOS === OperatingSystem.Windows ? 'cmd' : 'zsh';
    }
    const userInfoSection = `<user_info>
The user's OS version is ${platform}. The absolute path of the user's workspace is ${this.appConfig.workspaceDir}. The user's shell is /bin/${shellName}.
</user_info>`;

    const rulesSection = `

<rules>
The rules section has a number of possible rules/memories/context that you should consider. In each subsection, we provide instructions about what information the subsection contains and how you should consider/follow the contents of the subsection.


<user_specific_rule description="This is a rule set by the user that the agent must follow.">
${globalRules}
</user_specific_rule>

</rules>`;

    return [userInfoSection, rulesSection];
  }

  private findApplicableRules(): ProjectRule[] {
    const requestedByAgentRules = this.rulesService.projectRules.filter((rule) => rule.description);
    const alwaysApplyRules = this.rulesService.projectRules.filter((rule) => rule.alwaysApply);
    const requestedByFileRules = this.findFileMatchingRules();

    return [...requestedByFileRules, ...requestedByAgentRules, ...alwaysApplyRules];
  }
  private findFileMatchingRules(): ProjectRule[] {
    const requestedByFileRules = this.rulesService.projectRules.filter((rule) => rule.globs);
    const filePaths = this.attachedFiles.map((file) => file.uri.toString());
    const folderPaths = this.attachedFolders.map((folder) => folder.uri.toString());

    return requestedByFileRules.filter((rule) => {
      const globs = this.normalizeGlobs(rule.globs || []);
      const patterns = globs.map((pattern) => parseGlob(pattern));
      return patterns.some((match) => filePaths.some((path) => match(path)) || folderPaths.some((path) => match(path)));
    });
  }
  private normalizeGlobs(globs: string | string[]): string[] {
    const globArray = isString(globs) ? globs.split(',') : globs || [];
    return globArray.map((glob) => {
      const p = glob.trim();
      return p.startsWith('**') ? p : `**/${p}`;
    });
  }

  private serializeAttachedRules(rules: ProjectRule[] = []): string[] {
    if (rules.length === 0) {
      rules = this.findApplicableRules();
    }

    const header =
      '\n<rules_context>\n\nRules are extra documentation provided by the user to help the AI understand the codebase.\nUse them if they seem useful to the users most recent query, but do not use them if they seem unrelated.\n\n';

    const rulesSections = rules
      .map((rule) => {
        const ruleName =
          rule.path
            .split('/')
            .pop()
            ?.replace(/.md(c)?$/, '') || 'Unnamed Rule';
        return `Rule Name: ${ruleName}\nDescription: \n${rule.description || rule.content}`;
      })
      .join('\n\n');

    const footer = '\n</rules_context>\n';

    return [header, rulesSections, footer];
  }
}
