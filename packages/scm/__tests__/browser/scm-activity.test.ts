import { Injectable, Injector } from '@opensumi/di';
import { StatusBarAlignment, IStatusBarService } from '@opensumi/ide-core-browser/lib/services';
import { MaybeNull, Uri, URI, Event, Emitter } from '@opensumi/ide-core-common';
import { WorkbenchEditorService, IResource } from '@opensumi/ide-editor';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { SCMService } from '../../src';
import { SCMModule } from '../../src/browser';
import { SCMBadgeController, SCMStatusBarController } from '../../src/browser/scm-activity';
import { MockSCMProvider, MockSCMResourceGroup, MockSCMResource } from '../scm-test-util';

jest.useFakeTimers();

// mock localize
jest.mock('@opensumi/ide-core-common/src/localize', () => ({
  ...jest.requireActual('@opensumi/ide-core-common/src/localize'),
  localize: (symbol: string, defaultValue?: string) => defaultValue || symbol,
}));

describe('test for packages/scm/src/browser/scm-activity.ts', () => {
  describe('test for SCMBadgeController', () => {
    let injector: MockInjector;

    let scmBadgeController: SCMBadgeController;
    let scmService: SCMService;

    const fakeSetBadge = jest.fn();
    const fakeGetTabbarHandler = jest.fn();
    fakeGetTabbarHandler.mockReturnValue({
      setBadge: fakeSetBadge,
    });

    beforeEach(() => {
      injector = createBrowserInjector(
        [SCMModule],
        new Injector([
          {
            token: IMainLayoutService,
            useValue: {
              getTabbarHandler: fakeGetTabbarHandler,
            },
          },
        ]),
      );

      scmService = injector.get(SCMService);
      scmBadgeController = injector.get(SCMBadgeController);
    });

    afterEach(() => {
      fakeSetBadge.mockReset();
    });

    it('ok for no repo', () => {
      scmBadgeController.start();
      expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked
    });

    it('ok for one repo', () => {
      scmBadgeController.start();
      expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked

      const repo0 = scmService.registerSCMProvider(new MockSCMProvider(0));
      expect(fakeSetBadge).toHaveBeenCalledTimes(1); // non-invoke

      // dispose
      repo0.dispose();
      expect(fakeSetBadge).toHaveBeenCalledWith('');
    });

    it('ok for one repo but getTabbarHandler return void', () => {
      fakeGetTabbarHandler.mockReturnValueOnce(undefined);
      scmBadgeController.start();
      expect(fakeSetBadge).toHaveBeenCalledTimes(0);

      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.count = 1;
      const repo0 = scmService.registerSCMProvider(mockProvider0);
      mockProvider0.onDidChangeEmitter.fire();
      expect(fakeSetBadge).toHaveBeenCalledTimes(1);

      fakeGetTabbarHandler.mockReturnValueOnce(undefined);
      const mockProvider1 = new MockSCMProvider(1);
      mockProvider1.count = 2;
      scmService.registerSCMProvider(mockProvider1);
      mockProvider0.onDidChangeEmitter.fire();
      expect(fakeSetBadge).toHaveBeenCalledTimes(1);

      fakeGetTabbarHandler.mockReturnValueOnce(undefined);
      // dispose
      repo0.dispose();
      expect(fakeSetBadge).toHaveBeenCalledTimes(1);
    });

    it('ok for repo provider.count changes', () => {
      scmBadgeController.start();
      expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked

      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.count = 1;
      const repo0 = scmService.registerSCMProvider(mockProvider0);
      mockProvider0.onDidChangeEmitter.fire();
      expect(fakeSetBadge).toHaveBeenCalledWith('1');

      mockProvider0.count = 2;
      mockProvider0.onDidChangeResourcesEmitter.fire();
      expect(fakeSetBadge).toHaveBeenCalledWith('2');

      // remove repo
      repo0.dispose();
      expect(fakeSetBadge).toHaveBeenCalledWith('');
    });

    it('ok for one existed repo', () => {
      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.count = 1;
      const repo0 = scmService.registerSCMProvider(mockProvider0);

      scmBadgeController.start();
      expect(fakeSetBadge).toHaveBeenCalledWith('1'); // initial invoked

      mockProvider0.count = 3;
      mockProvider0.onDidChangeResourcesEmitter.fire();
      expect(fakeSetBadge).toHaveBeenCalledWith('3');

      // remove repo
      repo0.dispose();
      expect(fakeSetBadge).toHaveBeenCalledWith('');
    });

    it('ok for repo provider.groups.elements.length changes', () => {
      scmBadgeController.start();
      expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked

      const mockProvider0 = new MockSCMProvider(0);
      // prepare data
      const mockSCMResourceGroup0 = new MockSCMResourceGroup(mockProvider0, 0);
      mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [
        new MockSCMResource(mockSCMResourceGroup0, undefined, undefined, undefined),
      ]);

      mockProvider0.groups.splice(mockProvider0.groups.elements.length, 0, [mockSCMResourceGroup0]);
      const repo0 = scmService.registerSCMProvider(mockProvider0);
      mockProvider0.onDidChangeResourcesEmitter.fire();
      expect(fakeSetBadge).toHaveBeenCalledWith('1');

      mockSCMResourceGroup0.splice(mockSCMResourceGroup0.elements.length, 0, [
        new MockSCMResource(mockSCMResourceGroup0, undefined, undefined, undefined),
      ]);
      mockProvider0.onDidChangeEmitter.fire();
      expect(fakeSetBadge).toHaveBeenCalledWith('2');

      // remove repo
      repo0.dispose();
      expect(fakeSetBadge).toHaveBeenCalledWith('');
    });

    it('ok when dispose', () => {
      scmBadgeController.start();
      expect(fakeSetBadge).toHaveBeenCalledWith(''); // initial invoked

      scmService.registerSCMProvider(new MockSCMProvider(0));
      expect(fakeSetBadge).toHaveBeenCalledTimes(1); // non-invoke

      // dispose
      scmBadgeController.dispose();
      scmService.registerSCMProvider(new MockSCMProvider(1));
      expect(fakeSetBadge).toHaveBeenCalledTimes(1); // non-invoke
    });
  });

  describe('test for SCMStatusBarController', () => {
    let injector: MockInjector;

    let scmStatusBarController: SCMStatusBarController;
    let scmService: SCMService;
    let workbenchEditorService: MockWorkbenchEditorService;

    let fakeAddElement: jest.Mock;

    @Injectable()
    class MockWorkbenchEditorService {
      public activeResourceChangeEmitter = new Emitter<void>();
      readonly onActiveResourceChange: Event<void> = this.activeResourceChangeEmitter.event;

      currentResource: MaybeNull<IResource> = {
        name: 'fakeResource',
        uri: new URI(Uri.file('/test/workspace/fakeResource.ts')),
        icon: 'fakeResourceIcon',
      };
    }

    beforeEach(() => {
      fakeAddElement = jest.fn();

      injector = createBrowserInjector(
        [SCMModule],
        new Injector([
          {
            token: WorkbenchEditorService,
            useClass: MockWorkbenchEditorService,
          },
          {
            token: IStatusBarService,
            useValue: {
              addElement: fakeAddElement,
            },
          },
        ]),
      );

      scmService = injector.get(SCMService);
      scmStatusBarController = injector.get(SCMStatusBarController);
      workbenchEditorService = injector.get(WorkbenchEditorService);
    });

    afterEach(() => {
      fakeAddElement.mockReset();
    });

    it('ok for no repo', () => {
      scmStatusBarController.start();
      expect(fakeAddElement).toHaveBeenCalledTimes(0);
    });

    it('ok for one repo (without provider.rootUri)', () => {
      scmStatusBarController.start();

      // scm provider without rootUri
      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.statusBarCommands!.push(
        {
          id: 'fake.command.id.0',
          title: 'fake.command.title.0',
          tooltip: 'fake.command.tooltip.0',
        },
        {
          id: 'fake.command.id.1',
          title: 'fake.command.title.1',
          arguments: [1, 2, 3],
        },
      );

      const repo0 = scmService.registerSCMProvider(mockProvider0);

      expect(fakeAddElement).toHaveBeenCalledTimes(2);
      // fake command 0
      expect(fakeAddElement.mock.calls[0][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[0][1]).toEqual({
        text: 'fake.command.title.0',
        priority: 10000, // copy from vscode
        arguments: undefined,
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.0',
        tooltip: 'workspace (scm_label_0) - fake.command.tooltip.0',
        id: 'status.scm',
        name: 'status-bar.scm',
      });

      // fake command 1
      expect(fakeAddElement.mock.calls[1][0]).toBe('status.scm.repo.1');
      expect(fakeAddElement.mock.calls[1][1]).toEqual({
        text: 'fake.command.title.1',
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.1',
        arguments: [1, 2, 3],
        tooltip: 'workspace (scm_label_0) - fake.command.title.1',
        id: 'status.scm',
        name: 'status-bar.scm',
      });

      // remove repo0
      repo0.dispose();
      expect(fakeAddElement).toHaveBeenCalledTimes(2); // 不会调用
    });

    it('ok for one existed repo (with provider.rootUri)', () => {
      // scm provider without rootUri
      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.rootUri = Uri.file('/test/workspace');
      mockProvider0.statusBarCommands!.push({
        id: 'fake.command.id.0',
        title: 'fake.command.title.0',
        tooltip: 'fake.command.tooltip.0',
        arguments: [1, 2, 3],
      });

      scmService.registerSCMProvider(mockProvider0);

      scmStatusBarController.start();
      expect(fakeAddElement).toHaveBeenCalledTimes(1);
      // fake command 0
      expect(fakeAddElement.mock.calls[0][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[0][1]).toEqual({
        text: 'fake.command.title.0',
        priority: 10000,
        arguments: [1, 2, 3],
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.0',
        tooltip: 'workspace (scm_label_0) - fake.command.tooltip.0',
        id: 'status.scm',
        name: 'status-bar.scm',
      });
    });

    it('ok for one repo with onDidChangeStatusBarCommands', () => {
      scmStatusBarController.start();

      // scm provider without rootUri
      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.statusBarCommands!.push({
        id: 'fake.command.id.0',
        title: 'fake.command.title.0',
        tooltip: 'fake.command.tooltip.0',
      });

      scmService.registerSCMProvider(mockProvider0);

      expect(fakeAddElement).toHaveBeenCalledTimes(1);
      // fake command 0
      expect(fakeAddElement.mock.calls[0][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[0][1]).toEqual({
        text: 'fake.command.title.0',
        priority: 10000, // copy from vscode
        arguments: undefined,
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.0',
        tooltip: 'workspace (scm_label_0) - fake.command.tooltip.0',
        id: 'status.scm',
        name: 'status-bar.scm',
      });

      mockProvider0.statusBarCommands = [
        {
          id: 'fake.command.id.1',
          title: 'fake.command.title.1',
          arguments: [1, 2, 3],
        },
      ];
      mockProvider0.onDidChangeStatusBarCommandsEmitter.fire(mockProvider0.statusBarCommands);

      // fake command 1
      // statusbar elements 的 uid 不变
      expect(fakeAddElement.mock.calls[1][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[1][1]).toEqual({
        text: 'fake.command.title.1',
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.1',
        arguments: [1, 2, 3],
        tooltip: 'workspace (scm_label_0) - fake.command.title.1',
        id: 'status.scm',
        name: 'status-bar.scm',
      });

      // statusBarCommands 为 []
      mockProvider0.statusBarCommands = [];
      mockProvider0.onDidChangeStatusBarCommandsEmitter.fire([]);
      expect(fakeAddElement).toHaveBeenCalledTimes(2); // 不再调用

      // statusBarCommands 为 undefined
      mockProvider0.statusBarCommands = undefined;
      mockProvider0.onDidChangeStatusBarCommandsEmitter.fire([]);
      expect(fakeAddElement).toHaveBeenCalledTimes(2); // 不再调用
    });

    it('ok for one repo without statusBarCommands', () => {
      scmStatusBarController.start();

      // scm provider without rootUri
      const mockProvider0 = new MockSCMProvider(0);
      scmService.registerSCMProvider(mockProvider0);

      expect(fakeAddElement).toHaveBeenCalledTimes(0);
    });

    it('ok for multi repos', () => {
      scmStatusBarController.start();

      // scm provider0 without rootUri
      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.rootUri = undefined;
      mockProvider0.statusBarCommands!.push({
        id: 'fake.command.id.0',
        title: 'fake.command.title.0',
        tooltip: 'fake.command.tooltip.0',
      });
      scmService.registerSCMProvider(mockProvider0);
      expect(fakeAddElement).toHaveBeenCalledTimes(1);
      // fake command 0
      expect(fakeAddElement.mock.calls[0][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[0][1]).toEqual({
        text: 'fake.command.title.0',
        priority: 10000, // copy from vscode
        arguments: undefined,
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.0',
        tooltip: 'scm_label_0 - fake.command.tooltip.0',
        id: 'status.scm',
        name: 'status-bar.scm',
      });

      // scm provider1 with rootUri
      const mockProvider1 = new MockSCMProvider(1);
      mockProvider1.rootUri = Uri.file('/test/workspace/another-ws');
      mockProvider1.statusBarCommands!.push({
        id: 'fake.command.id.1',
        title: 'fake.command.title.1',
        arguments: [1, 2, 3],
      });
      scmService.registerSCMProvider(mockProvider1);
      expect(fakeAddElement).toHaveBeenCalledTimes(1);

      // change currentResource#uri and fire onActiveResourceChange
      // and trigger focusedRepo changing
      workbenchEditorService.currentResource!.uri = new URI(Uri.file('/test/workspace/another-ws/tfolder/cc.ts'));
      workbenchEditorService.activeResourceChangeEmitter.fire();

      expect(fakeAddElement).toHaveBeenCalledTimes(2);
      // fake command 1
      expect(fakeAddElement.mock.calls[1][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[1][1]).toEqual({
        text: 'fake.command.title.1',
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.1',
        arguments: [1, 2, 3],
        tooltip: 'another-ws (scm_label_1) - fake.command.title.1',
        id: 'status.scm',
        name: 'status-bar.scm',
      });

      // change currentResource#uri and fire onActiveResourceChange
      // and doesnot trigger focusedRepo changing
      workbenchEditorService.currentResource!.uri = new URI(Uri.file('/test/workspace/another-ws/tfolder/dd.ts'));
      workbenchEditorService.activeResourceChangeEmitter.fire();
      expect(fakeAddElement).toHaveBeenCalledTimes(2);

      // change currentResource#uri and fire onActiveResourceChange
      // and doesnot match any repo/workspace
      workbenchEditorService.currentResource!.uri = new URI(
        Uri.file('/test/workspace/non-existed-folder/tfolder/dd.ts'),
      );
      workbenchEditorService.activeResourceChangeEmitter.fire();
      expect(fakeAddElement).toHaveBeenCalledTimes(2);

      // change currentResource to git scheme
      workbenchEditorService.currentResource!.uri = new URI('git:///test/workspace/another-ws/tfolder/cc.ts');
      workbenchEditorService.activeResourceChangeEmitter.fire();
      expect(fakeAddElement).toHaveBeenCalledTimes(2);

      // change currentResource to undefined
      workbenchEditorService.currentResource = undefined;
      workbenchEditorService.activeResourceChangeEmitter.fire();
      expect(fakeAddElement).toHaveBeenCalledTimes(2);
    });

    it('ok for multi repos when focused one removed', () => {
      scmStatusBarController.start();

      // scm provider0 without rootUri
      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.rootUri = undefined;
      mockProvider0.statusBarCommands!.push({
        id: 'fake.command.id.0',
        title: 'fake.command.title.0',
        tooltip: 'fake.command.tooltip.0',
      });
      const repo0 = scmService.registerSCMProvider(mockProvider0);
      expect(fakeAddElement).toHaveBeenCalledTimes(1);
      // fake command 0
      expect(fakeAddElement.mock.calls[0][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[0][1]).toEqual({
        text: 'fake.command.title.0',
        priority: 10000, // copy from vscode
        arguments: undefined,
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.0',
        tooltip: 'scm_label_0 - fake.command.tooltip.0',
        id: 'status.scm',
        name: 'status-bar.scm',
      });

      // scm provider1 with rootUri
      const mockProvider1 = new MockSCMProvider(1);
      mockProvider1.rootUri = Uri.file('/test/workspace/another-ws');
      mockProvider1.statusBarCommands!.push({
        id: 'fake.command.id.1',
        title: 'fake.command.title.1',
        arguments: [1, 2, 3],
      });
      scmService.registerSCMProvider(mockProvider1);
      expect(fakeAddElement).toHaveBeenCalledTimes(1);

      const repo2 = scmService.registerSCMProvider(new MockSCMProvider(2));
      // non-focused one removed --> make no sense
      repo2.dispose();
      expect(fakeAddElement).toHaveBeenCalledTimes(1);

      // focused one removed
      repo0.dispose();

      expect(fakeAddElement).toHaveBeenCalledTimes(2);
      // fake command 1
      expect(fakeAddElement.mock.calls[1][0]).toBe('status.scm.repo.0');
      expect(fakeAddElement.mock.calls[1][1]).toEqual({
        text: 'fake.command.title.1',
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        command: 'fake.command.id.1',
        arguments: [1, 2, 3],
        tooltip: 'another-ws (scm_label_1) - fake.command.title.1',
        id: 'status.scm',
        name: 'status-bar.scm',
      });
    });

    it('ok when dispose', () => {
      scmStatusBarController.start();

      // scm provider without rootUri
      const mockProvider0 = new MockSCMProvider(0);
      mockProvider0.statusBarCommands!.push({
        id: 'fake.command.id.0',
        title: 'fake.command.title.0',
        tooltip: 'fake.command.tooltip.0',
      });

      scmService.registerSCMProvider(mockProvider0);
      // workbenchEditorService.activeResourceChangeEmitter.fire();

      expect(fakeAddElement).toHaveBeenCalledTimes(1);

      // dispose
      scmStatusBarController.dispose();
      scmService.registerSCMProvider(new MockSCMProvider(1));
      expect(fakeAddElement).toHaveBeenCalledTimes(1); // non-invoke
    });
  });
});
