import { Event } from '@opensumi/ide-core-browser';
export const IElectronHeaderService = Symbol('IElectronHeaderService');

export interface IElectronHeaderService {
  /**
   * 如果你的 template 中包含自定义变量，请先通过 setTemplateVariables 注入变量后，再调用该函数。
   */
  titleTemplate: string;
  /**
   * 占位符 ${separator} 的值
   */
  separator: string;
  appTitle: string;
  onTitleChanged: Event<string>;
  /**
   * 可以让集成方定义可替换的 variables。
   * 如小程序开发者工具注入了一个 ${projectName}，含义为用户当前项目的名字。
   */
  setTemplateVariables(key: string, value: string | undefined): void;

  /**
   * 默认支持的变量有下面这些，也支持集成方通过 setTemplateVariables 自己注入
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
  formatAppTitle(): string;
}
