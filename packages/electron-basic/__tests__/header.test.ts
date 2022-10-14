import { AppConfig } from '@opensumi/ide-core-browser';
import { Emitter } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { createElectronBasicInjector } from '../__mocks__';
import { ElectronHeaderService, SEPARATOR, TITLE_DIRTY } from '../src/browser/header/header.service';
import { IElectronHeaderService } from '../src/common/header';

describe('header service should work', () => {
  const injector = createElectronBasicInjector();
  const emitter = new Emitter();
  const appConfig = {
    workspaceDir: '/Users/Development',
    appName: 'OpenSumi',
  };
  const editor = {
    onActiveResourceChange: emitter.event,
    currentResource: {
      name: '/Users/Development/myFolder/myFileFolder/myFile.txt',
    },
    currentEditor: {
      currentDocumentModel: {
        dirty: true,
      },
    },
  };
  injector.overrideProviders(
    {
      token: WorkbenchEditorService,
      useValue: editor,
    },
    {
      token: AppConfig,
      useValue: appConfig,
      override: true,
    },
    {
      token: IElectronHeaderService,
      useClass: ElectronHeaderService,
    },
  );

  const headerService = injector.get(IElectronHeaderService) as IElectronHeaderService;
  it('can generate app title', () => {
    const appTitle = headerService.appTitle;
    expect(appTitle).toBeDefined();
  });
  it('can process builtin variables correctly', () => {
    const template = [
      'activeEditorShort',
      'activeEditorMedium',
      'activeEditorLong',
      'activeFolderShort',
      'activeFolderMedium',
      'activeFolderLong',
      'folderName',
      'folderPath',
      'rootName',
      'rootPath',
      'appName',
      'dirty',
      'remoteName',
    ]
      .map((v) => `${v}|$\{${v}}|`)
      .join('${separator}');
    headerService.titleTemplate = template;
    headerService.separator = '\n';
    const data = headerService.formatAppTitle();
    expect(data).toEqual(
      `activeEditorShort|myFile.txt|
activeEditorMedium|myFolder/myFileFolder/myFile.txt|
activeEditorLong|/Users/Development/myFolder/myFileFolder/myFile.txt|
activeFolderShort|myFileFolder|
activeFolderMedium|myFolder/myFileFolder|
activeFolderLong|/Users/Development/myFolder/myFileFolder|
folderName|Development|
folderPath|/Users/Development|
rootName|Development|
rootPath|/Users/Development|
appName|OpenSumi|
dirty|● |
remoteName||`,
    );
    // restore
    headerService.separator = SEPARATOR;
  });
  it('can display dirty', () => {
    editor.currentEditor.currentDocumentModel.dirty = false;
    expect(headerService.appTitle).not.toContain(TITLE_DIRTY);
    editor.currentEditor.currentDocumentModel.dirty = true;
    expect(headerService.appTitle).toContain(TITLE_DIRTY);
  });
  it('can set template', () => {
    headerService.titleTemplate = 'hello-${appName}';
    expect(headerService.appTitle).toEqual('hello-OpenSumi');
  });
  it('can inject variable', () => {
    headerService.setTemplateVariables('projectName', 'proposed-acquisition-of-twitter');
    headerService.setTemplateVariables('userName', 'Elon Musk');
    headerService.titleTemplate = '${projectName}${separator}${userName}';
    expect(headerService.appTitle).toEqual(`proposed-acquisition-of-twitter${SEPARATOR}Elon Musk`);
  });
  it('can process empty between separator', () => {
    appConfig.workspaceDir = '';
    headerService.titleTemplate = '${activeEditorShort}${separator}${rootName}${separator}${appName}';
    expect(headerService.appTitle).toEqual('myFile.txt - OpenSumi');
  });
});
