import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  AppConfig,
  localize,
  replaceLocalizePlaceholder,
  Emitter,
  DisposableCollection,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { basename } from '@opensumi/ide-utils/lib/path';
import { template } from '@opensumi/ide-utils/lib/strings';

import { IElectronHeaderService } from '../../common/header';

// "● "
export const TITLE_DIRTY = '\u25cf ';
export const SEPARATOR = ' - ';

export const DEFAULT_TEMPLATE = '${dirty}${activeEditorShort}${separator}${rootName}${separator}${appName}';

@Injectable()
export class ElectronHeaderService implements IElectronHeaderService {
  disposableCollection = new DisposableCollection();

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(AppConfig)
  appConfig: AppConfig;

  private _onTitleChanged = new Emitter<string>();
  onTitleChanged = this._onTitleChanged.event;

  private _appTitle: string;

  private _titleTemplate = DEFAULT_TEMPLATE;
  get titleTemplate() {
    return this._titleTemplate;
  }

  set titleTemplate(value: string) {
    this._titleTemplate = value;
    this.updateAppTitle();
  }

  private _templateVariables = {} as Record<string, string | undefined>;
  setTemplateVariables(key: string, value: string | undefined) {
    this._templateVariables[key] = value;
  }

  constructor() {
    this.disposableCollection.push(
      this.editorService.onActiveResourceChange(() => {
        this.updateAppTitle();
      }),
    );
  }

  updateAppTitle() {
    this._onTitleChanged.fire(this.appTitle);
  }

  get appTitle() {
    const formatted = this.formatAppTitle();

    let result = formatted;

    if (this.appConfig.extensionDevelopmentHost) {
      result = `[${localize('workspace.development.title')}] ${result}`;
    }
    if (this.appConfig.isRemote) {
      result = `[${localize('common.remoteMode')}] ${result}`;
    }

    this._appTitle = result;
    return this._appTitle;
  }

  formatAppTitle() {
    const { appConfig } = this;
    const currentResource = this.editorService.currentResource;
    const currentEditor = this.editorService.currentEditor;

    const workspaceDirname = appConfig.workspaceDir ? basename(appConfig.workspaceDir) : '';
    const activeEditorFull = currentResource?.name ?? '';
    const activeFolderFull = activeEditorFull ? basename(activeEditorFull) : '';

    const activeEditorShort = activeEditorFull;
    const activeEditorMedium = activeEditorFull;
    const activeEditorLong = activeEditorFull;
    const activeFolderShort = activeFolderFull;
    const activeFolderMedium = activeFolderFull;
    const activeFolderLong = activeFolderFull;
    const folderName = workspaceDirname;
    const folderPath = workspaceDirname;
    const rootName = workspaceDirname;
    const rootPath = workspaceDirname;
    const appName = replaceLocalizePlaceholder(appConfig.appName) ?? '';
    // TODO: 当前 OpenSumi 还不支持 Remote 名字
    const remoteName = '';
    const dirty = currentEditor?.currentDocumentModel?.dirty ? TITLE_DIRTY : '';
    const separator = SEPARATOR;

    const result = template(
      this.titleTemplate,
      {
        activeEditorShort,
        activeEditorMedium,
        activeEditorLong,
        activeFolderShort,
        activeFolderMedium,
        activeFolderLong,
        folderName,
        folderPath,
        rootName,
        rootPath,
        appName,
        remoteName,
        dirty,
        ...this._templateVariables,
      },
      {
        separator,
      },
    );

    return result;
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}
