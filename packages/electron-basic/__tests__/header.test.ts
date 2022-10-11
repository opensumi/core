import { AppConfig } from '@opensumi/ide-core-browser';
import { Emitter } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { createElectronBasicInjector } from '../__mocks__';
import { DEFAULT_TEMPLATE, ElectronHeaderService, SEPARATOR, TITLE_DIRTY } from '../src/browser/header/header.service';

describe('header service should work', () => {
  const injector = createElectronBasicInjector();
  const emitter = new Emitter();
  const appConfig = {
    workspaceDir: '/Users/Development/myWorkspace',
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
  );

  const headerService = injector.get(ElectronHeaderService);
  it('can generate app title', () => {
    const appTitle = headerService.appTitle;
    expect(appTitle).toBeDefined();
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
    headerService.titleTemplate = DEFAULT_TEMPLATE;
    expect(headerService.appTitle).toBeDefined();
  });
});
