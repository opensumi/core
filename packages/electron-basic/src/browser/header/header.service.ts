import template from 'lodash/template';

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

import { IElectronHeaderService } from '../../common/header';

// "● "
export const TITLE_DIRTY = '\u25cf ';
export const SEPARATOR = ' - ';

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

  private _titleTemplate = '${dirty}${activeEditorShort}${separator}${rootName}${separator}${appName}';
  get titleTemplate() {
    return this._titleTemplate;
  }

  /**
   * 如果你的 template 中包含自定义变量，请先通过 setTemplateVariables 注入变量后，再调用该函数。
   */
  set titleTemplate(value: string) {
    this._titleTemplate = value;
    this.updateAppTitle();
  }

  /**
   * 可以让集成方定义可替换的 variables。
   * 如小程序开发者工具注入了一个 ${projectName}，含义为用户当前项目的名字。
   */
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

  /**
   * 默认支持的变量有下面这些，用户可以自己注入
   * Controls the window title based on the active editor. Variables are substituted based on the context:
   * - `${activeEditorShort}`: the file name (e.g. myFile.txt).
   * - `${activeEditorMedium}`: the path of the file relative to the workspace folder (e.g. myFolder/myFileFolder/myFile.txt).
   * - `${activeEditorLong}`: the full path of the file (e.g. /Users/Development/myFolder/myFileFolder/myFile.txt).
   * - `${activeFolderShort}`: the name of the folder the file is contained in (e.g. myFileFolder).
   * - `${activeFolderMedium}`: the path of the folder the file is contained in, relative to the workspace folder (e.g. myFolder/myFileFolder).
   * - `${activeFolderLong}`: the full path of the folder the file is contained in (e.g. /Users/Development/myFolder/myFileFolder).
   * - `${folderName}`: name of the workspace folder the file is contained in (e.g. myFolder).
   * - `${folderPath}`: file path of the workspace folder the file is contained in (e.g. /Users/Development/myFolder).
   * - `${rootName}`: name of the opened workspace or folder (e.g. myFolder or myWorkspace).
   * - `${rootPath}`: file path of the opened workspace or folder (e.g. /Users/Development/myWorkspace).
   * - `${appName}`: e.g. VS Code.
   * - `${remoteName}`: e.g. SSH
   * - `${dirty}`: an indicator for when the active editor has unsaved changes.
   * - `${separator}`: a conditional separator (" - ") that only shows when surrounded by variables with values or static text.
   */
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
    const remoteName = '';
    const dirty = currentEditor?.currentDocumentModel?.dirty ? TITLE_DIRTY : '';
    const separator = SEPARATOR;

    const compile = template(this.titleTemplate, {
      imports: {},
    });

    const result = compile({
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
      separator,
      ...this._templateVariables,
    }).trim();

    return result;
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}
