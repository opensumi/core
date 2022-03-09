import { ProgressLocation, CommandRegistry } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../tools/dev-tool/src/mock-injector';
import { IProgressService } from '../src/progress';
import { ProgressService } from '../src/progress/progress.service';
import { StatusBarEntry } from '../src/services';

// https://stackoverflow.com/questions/52177631/jest-timer-and-promise-dont-work-well-settimeout-and-async-function
function flushPromises() {
  return Promise.resolve();
}

describe('progress service test', () => {
  let service: ProgressService;
  let injector: MockInjector;
  const mockEntryMap: Map<string, StatusBarEntry> = new Map();

  beforeAll(() => {
    jest.useFakeTimers();
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: IProgressService,
      useClass: ProgressService,
    });
    service = injector.get(IProgressService);
    const commandRegistry: CommandRegistry = injector.get(CommandRegistry);
    commandRegistry.registerCommand(
      { id: 'statusbar.addElement' },
      {
        execute: (id: string, entry: StatusBarEntry) => {
          mockEntryMap.set(id, entry);
          return {
            dispose: () => mockEntryMap.delete(id),
            update: (entry: StatusBarEntry) => {
              const original = mockEntryMap.get(id);
              mockEntryMap.set(id, {
                ...original,
                ...entry,
              });
            },
          };
        },
      },
    );
  });

  it('progress with window should work', async (done) => {
    service.withProgress(
      {
        location: ProgressLocation.Window,
        title: 'progressTitle',
      },
      async (progress) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        progress.report({
          message: 'progressMessage',
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      },
    );
    expect(mockEntryMap.get('status.progress')).toBeUndefined();
    // 低于150ms的进度不展示
    jest.advanceTimersByTime(150);
    expect(mockEntryMap.get('status.progress')!.text).toEqual('$(sync~spin) progressTitle');
    jest.advanceTimersByTime(50);
    await flushPromises();
    expect(mockEntryMap.get('status.progress')!.text).toEqual('$(sync~spin) progressTitle: progressMessage');
    jest.advanceTimersByTime(200);
    await flushPromises();
    done();
  });

  it('progress with indicator should work', async (done) => {
    service.registerProgressIndicator('scm');
    service.withProgress(
      {
        location: ProgressLocation.Scm,
        total: 100,
        delay: 200,
      },
      async (progress) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        progress.report({
          increment: 20,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
        progress.report({
          increment: 30,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    );
    const indicator = service.getIndicator('scm');
    expect(indicator?.progressModel.show).toBeFalsy();
    expect(indicator?.progressModel.total).toEqual(100);
    jest.advanceTimersByTime(200);
    expect(indicator?.progressModel.show).toBeTruthy();
    jest.advanceTimersByTime(100);
    await flushPromises();
    expect(indicator?.progressModel.worked).toEqual(20);
    jest.advanceTimersByTime(200);
    await flushPromises();
    expect(indicator?.progressModel.worked).toEqual(50);
    jest.advanceTimersByTime(200);
    done();
  });

  it('infinite progress with indicator should work', async (done) => {
    service.registerProgressIndicator('explorer');
    service.withProgress(
      {
        location: ProgressLocation.Explorer,
      },
      (_) => new Promise((resolve) => setTimeout(resolve, 400)),
    );
    const indicator = service.getIndicator('explorer');
    expect(indicator?.progressModel.total).toBeUndefined();
    expect(indicator?.progressModel.show).toBeTruthy();
    jest.advanceTimersByTime(400);
    await flushPromises();
    expect(indicator?.progressModel.show).toBeFalsy();
    done();
  });
});
