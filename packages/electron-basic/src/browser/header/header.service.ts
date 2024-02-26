import { Autowired, Injectable } from '@opensumi/di';
import {
  AppConfig,
  DisposableCollection,
  Emitter,
  OnEvent,
  WithEventBus,
  isMacintosh,
  localize,
  replaceLocalizePlaceholder,
} from '@opensumi/ide-core-browser';
import { ResourceDidUpdateEvent, WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { basename, dirname, posix, toSlashes } from '@opensumi/ide-utils/lib/path';
import { template } from '@opensumi/ide-utils/lib/strings';

import { IElectronHeaderService } from '../../common/header';

// "● "
export const TITLE_DIRTY = '\u25cf ';
export const SEPARATOR = ' - ';

export let DEFAULT_TEMPLATE = '${dirty}${activeEditorShort}${separator}${rootName}';

if (isMacintosh) {
  DEFAULT_TEMPLATE = '${activeEditorShort}${separator}${rootName}';
}

@Injectable()
export class ElectronHeaderService extends WithEventBus implements IElectronHeaderService {
  disposableCollection = new DisposableCollection();

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private _onTitleChanged = new Emitter<string>();
  onTitleChanged = this._onTitleChanged.event;

  private _appTitle: string;

  separator = SEPARATOR;

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
    super();
    this.disposableCollection.push(
      this.editorService.onActiveResourceChange(() => {
        this.updateAppTitle();
      }),
    );
  }

  @OnEvent(ResourceDidUpdateEvent)
  onResourceDidUpdateEvent() {
    this.updateAppTitle();
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

    const workspaceDir = appConfig.workspaceDir ? appConfig.workspaceDir : '';
    const workspaceBasename = basename(workspaceDir);
    const activeEditorFull = currentResource?.name ?? '';
    const activeEditorRelative =
      activeEditorFull && workspaceDir ? makeRelativePath(workspaceDir, activeEditorFull) : '';
    const activeFolderFull = activeEditorFull ? dirname(activeEditorFull) : '';
    const activeFolderRelative =
      activeFolderFull && workspaceDir ? makeRelativePath(workspaceDir, activeFolderFull) : '';

    const activeEditorShort = basename(activeEditorFull);
    const activeEditorMedium = activeEditorRelative;
    const activeEditorLong = activeEditorFull;
    const activeFolderShort = basename(activeFolderFull);
    const activeFolderMedium = activeFolderRelative;
    const activeFolderLong = activeFolderFull;
    const folderName = workspaceBasename;
    const folderPath = workspaceDir;
    const rootName = workspaceBasename;
    const rootPath = workspaceDir;
    const appName = replaceLocalizePlaceholder(appConfig.appName) ?? '';
    // TODO: 当前 OpenSumi 还不支持 Remote 名字
    const remoteName = '';
    const dirty = currentEditor?.currentDocumentModel?.dirty ? TITLE_DIRTY : '';

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
        separator: this.separator,
      },
    );

    return result;
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}

function makeRelativePath(workspaceDir: string, path: string) {
  if (!path || !workspaceDir) {
    return '';
  }

  workspaceDir = toSlashes(workspaceDir);
  path = toSlashes(path);

  if (!workspaceDir.endsWith(posix.sep)) {
    workspaceDir += posix.sep;
  }

  if (path.startsWith(workspaceDir)) {
    return path.substring(workspaceDir.length);
  }

  return path;
}
