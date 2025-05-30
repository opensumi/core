import { Autowired, Injectable } from '@opensumi/di';
import { VALIDATE_TYPE } from '@opensumi/ide-components';
import { AppConfig, PreferenceService } from '@opensumi/ide-core-browser';
import {
  AINativeSettingSectionsId,
  Disposable,
  Emitter,
  URI,
  formatLocalize,
  localize,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMessageService } from '@opensumi/ide-overlay';
import { QuickInputService } from '@opensumi/ide-quick-open/lib/browser/quick-input-service';
import { WorkspaceService } from '@opensumi/ide-workspace/lib/browser/workspace-service';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';

import { IMDCContent, IMDCParseResult, parseMDC, serializeMDC } from '../../common';
import { ProjectRule } from '../../common/types';

@Injectable()
export class RulesService extends Disposable {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: WorkspaceService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(QuickInputService)
  private readonly quickInputService: QuickInputService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  private readonly rulesChangeEventEmitter = new Emitter<void>();

  private _globalRules: string;
  private _projectRules: ProjectRule[];

  private _projectRulesPath: string;

  get onRulesChange() {
    return this.rulesChangeEventEmitter.event;
  }

  get globalRules() {
    if (!this._globalRules) {
      this._globalRules = this.preferenceService.get<string>(AINativeSettingSectionsId.GlobalRules) || '';
    }
    return this._globalRules;
  }

  get projectRules() {
    return this._projectRules || [];
  }

  public async initProjectRules() {
    this.dispose();
    await this.workspaceService.whenReady;
    const workspace = this.workspaceService.workspace;
    // 如果存在 .sumi, 默认从 .sumi 中获取
    const sumiConfigPath = new URI(workspace?.uri)
      .resolve(this.appConfig.preferenceDirName || '.sumi')
      .resolve('rules');
    const cursorConfigPath = new URI(workspace?.uri).resolve('.cursor').resolve('rules');
    if (await this.fileServiceClient.access(sumiConfigPath.codeUri.fsPath)) {
      this._projectRulesPath = sumiConfigPath.codeUri.fsPath;
    } else if (await this.fileServiceClient.access(cursorConfigPath.codeUri.fsPath)) {
      this._projectRulesPath = cursorConfigPath.codeUri.fsPath;
    } else {
      this._projectRulesPath = sumiConfigPath.codeUri.fsPath;
    }
    const watcher = await this.fileServiceClient.watchFileChanges(new URI(this._projectRulesPath));
    this.addDispose(
      watcher.onFilesChanged((changes) => {
        if (
          changes.length > 0 &&
          changes.some((change) => change.uri.endsWith('.mdc') && change.uri.includes('rules'))
        ) {
          this.initProjectRules();
        }
      }),
    );
    const dir = await this.fileServiceClient.getFileStat(this._projectRulesPath);
    if (dir && dir.isDirectory) {
      const files = dir.children?.filter((file) => !file.isDirectory && file.uri.endsWith('.mdc'));
      if (files) {
        const rules = await Promise.all(
          files.map(async (file) => {
            const item = await this.fileServiceClient.readFile(file.uri);
            const data = this.parseMDCContent(item.content.toString());
            return {
              path: file.uri,
              ...data.frontmatter,
              content: data.content,
            };
          }),
        );
        if (rules.length > 0) {
          this._projectRules = rules;
          this.rulesChangeEventEmitter.fire();
          return;
        }
      }
    }
    this._projectRules = [];
    this.rulesChangeEventEmitter.fire();
  }

  async openRule(rule: ProjectRule) {
    this.workbenchEditorService.open(new URI(rule.path));
  }

  async createNewRule() {
    let value = await this.quickInputService.open({
      title: localize('ai.native.rules.projectRules.newRule'),
      value: '',
      placeHolder: localize('ai.native.rules.projectRules.newRule.placeholder'),
      validateInput: async (value) => {
        const invalidCharsRegex = /[<>:"/\\|?*\x00-\x1F]/;
        value = value.trim();
        if (value === '') {
          return {
            message: localize('ai.native.rules.projectRules.newRule.error.notEmpty'),
            type: VALIDATE_TYPE.ERROR,
          };
        } else if (invalidCharsRegex.test(value)) {
          return {
            message: localize('ai.native.rules.error.invalidFileName'),
            type: VALIDATE_TYPE.ERROR,
          };
        } else {
          const newRulePath = new URI(this._projectRulesPath).resolve(value + '.mdc');
          const fileExists = this.projectRules.find(
            (rule) => new URI(rule.path).codeUri.fsPath === newRulePath.codeUri.fsPath,
          );
          if (fileExists) {
            return {
              message: formatLocalize('ai.native.rules.error.fileExists', value + '.mdc'),
              type: VALIDATE_TYPE.ERROR,
            };
          }
        }
      },
    });
    value = value?.trim();
    if (value) {
      const newRulePath = new URI(this._projectRulesPath).resolve(value + '.mdc');
      await this.fileServiceClient.createFile(newRulePath.toString(), {
        content: this.serializeMDCContent({
          frontmatter: {
            description: '',
            globs: '',
            alwaysApply: false,
          },
          content: '',
        }),
      });
      this.workbenchEditorService.open(new URI(newRulePath.toString()));
      this.initProjectRules();
    }
  }

  updateGlobalRules(rules: string) {
    this._globalRules = rules;
    this.preferenceService.set(AINativeSettingSectionsId.GlobalRules, rules);
  }

  parseMDCContent(content: string): IMDCParseResult {
    try {
      return parseMDC(content);
    } catch (error) {
      return {
        frontmatter: {},
        content,
      };
    }
  }

  serializeMDCContent(mdcContent: IMDCContent): string {
    return serializeMDC(mdcContent);
  }
}
