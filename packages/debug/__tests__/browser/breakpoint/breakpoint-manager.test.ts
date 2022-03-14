import { URI, StorageProvider, IFileServiceClient } from '@opensumi/ide-core-browser';
import { DebugBreakpoint, BreakpointManager, BREAKPOINT_KIND } from '@opensumi/ide-debug/lib/browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks';
import { IWorkspaceStorageService } from '@opensumi/ide-workspace';

describe('Breakpoints Manager', () => {
  const mockInjector = createBrowserInjector([]);
  let breakpointManager: BreakpointManager;

  const testUri = URI.file('test.js');
  const lineOneBreakpoint = DebugBreakpoint.create(testUri, { line: 1 }, true);
  const lineTwoBreakpoint = DebugBreakpoint.create(testUri, { line: 2 }, true);
  const lineThreeBreakpoint = DebugBreakpoint.create(testUri, { line: 3 }, false);
  const getFn = jest.fn(() => ({ breakpointsEnabled: true }));
  const setFn = jest.fn();

  beforeAll(() => {
    mockInjector.overrideProviders({
      token: StorageProvider,
      useValue: () => ({ get: getFn, set: setFn }),
    });
    mockInjector.overrideProviders({
      token: IWorkspaceStorageService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IFileServiceClient,
      useClass: MockFileServiceClient,
    });
    breakpointManager = mockInjector.get(BreakpointManager);
  });

  afterAll(() => {
    getFn.mockReset();
    setFn.mockReset();
  });

  it('should have enough API', () => {
    expect(breakpointManager.getKind()).toBe(BREAKPOINT_KIND);
    expect(breakpointManager.selectedBreakpoint).toBeUndefined();
    expect(Array.isArray(breakpointManager.affected)).toBeTruthy();
    expect(typeof breakpointManager.onDidChangeBreakpoints).toBe('function');
    expect(typeof breakpointManager.onDidChangeExceptionsBreakpoints).toBe('function');
    expect(typeof breakpointManager.setMarkers).toBe('function');
    expect(typeof breakpointManager.getBreakpoint).toBe('function');
    expect(typeof breakpointManager.setBreakpoints).toBe('function');
    expect(typeof breakpointManager.addBreakpoint).toBe('function');
    expect(typeof breakpointManager.delBreakpoint).toBe('function');
    expect(typeof breakpointManager.clearBreakpoints).toBe('function');
    expect(typeof breakpointManager.updateBreakpoint).toBe('function');
    expect(typeof breakpointManager.updateBreakpoints).toBe('function');
    expect(typeof breakpointManager.enableAllBreakpoints).toBe('function');
    expect(typeof breakpointManager.load).toBe('function');
    expect(typeof breakpointManager.save).toBe('function');
    expect(typeof breakpointManager.setExceptionBreakpoints).toBe('function');
    expect(typeof breakpointManager.getExceptionBreakpoints).toBe('function');
    expect(typeof breakpointManager.updateExceptionBreakpoints).toBe('function');
    expect(typeof breakpointManager.updateExceptionBreakpoints).toBe('function');
  });

  it('setBreakpoints should be work', async (done) => {
    const breakpoints = [lineOneBreakpoint];
    const dispose = breakpointManager.onDidChangeBreakpoints((event) => {
      expect(event.added.length).toBe(1);
      expect(event.affected[0].toString()).toBe(testUri.toString());
      dispose.dispose();
      done();
    });
    breakpointManager.setBreakpoints(testUri, breakpoints);
  });

  it('getBreakpoints should be work', () => {
    const breakpoints = breakpointManager.getBreakpoints(testUri);
    expect(breakpoints.length).toBe(1);
  });

  it('getBreakpoint should be work', () => {
    let breakpoints = breakpointManager.getBreakpoint(testUri, 10);
    expect(breakpoints).toBeUndefined();
    breakpoints = breakpointManager.getBreakpoint(testUri, 1);
    expect(breakpoints).toBeDefined();
  });

  it('addBreakpoint should be work', async (done) => {
    const dispose = breakpointManager.onDidChangeBreakpoints((event) => {
      expect(event.added.length).toBe(1);
      expect(event.changed[0].uri).toBe(testUri.toString());
      dispose.dispose();
      done();
    });
    breakpointManager.addBreakpoint(lineTwoBreakpoint);
  });

  it('delBreakpoint should be work', () => {
    let breakpoints = breakpointManager.getBreakpoints(testUri);
    expect(breakpoints.length).toBe(2);
    breakpointManager.delBreakpoint(lineOneBreakpoint);
    breakpoints = breakpointManager.getBreakpoints(testUri);
    expect(breakpoints.length).toBe(1);
  });

  it('clearBreakpoints should be work', async (done) => {
    const breakpoints = breakpointManager.getBreakpoints(testUri);
    expect(breakpoints.length).toBe(1);
    const dispose = breakpointManager.onDidChangeBreakpoints((event) => {
      expect(event.added.length).toBe(0);
      expect(event.changed.length).toBe(0);
      expect(event.added.length).toBe(0);
      expect(event.removed.length).toBe(1);
      dispose.dispose();
      done();
    });
    breakpointManager.clearBreakpoints();
  });

  it('updateBreakpoints should be work', async (done) => {
    const dispose = breakpointManager.onDidChangeBreakpoints((event) => {
      expect(event.affected.length).toBe(1);
      expect(event.changed.length).toBe(2);
      expect(event.added.length).toBe(0);
      expect(event.removed.length).toBe(0);
      expect(event.statusUpdated).toBe(false);
      dispose.dispose();
      done();
    });
    breakpointManager.updateBreakpoints([lineOneBreakpoint, lineTwoBreakpoint]);
  });

  it('updateBreakpoint should be work', async (done) => {
    const dispose = breakpointManager.onDidChangeBreakpoints((event) => {
      expect(event.affected.length).toBe(1);
      expect(event.changed.length).toBe(1);
      expect(event.added.length).toBe(0);
      expect(event.removed.length).toBe(0);
      expect(event.statusUpdated).toBe(false);
      dispose.dispose();
      done();
    });
    breakpointManager.updateBreakpoint(lineThreeBreakpoint);
  });

  it('enableAllBreakpoints should be work', async (done) => {
    const dispose = breakpointManager.onDidChangeMarkers((event) => {
      expect(event.toString()).toBe(testUri.toString());
      dispose.dispose();
      done();
    });
    breakpointManager.addBreakpoint(lineThreeBreakpoint);
    breakpointManager.enableAllBreakpoints(true);
  });

  it('breakpointsEnabled should be work', () => {
    expect(breakpointManager.breakpointsEnabled).toBeTruthy();
    breakpointManager.breakpointsEnabled = false;
    expect(breakpointManager.breakpointsEnabled).toBeFalsy();
  });

  it('load should be work', async (done) => {
    await breakpointManager.load();
    expect(getFn).toBeCalledTimes(1);
    done();
  });

  it('save should be work', async (done) => {
    await breakpointManager.save();
    expect(setFn).toBeCalledTimes(1);
    done();
  });

  it('setExceptionBreakpoints should be work', async (done) => {
    const filter = [{ filter: 'testFilter', label: 'test' }];
    const dispose = breakpointManager.onDidChangeExceptionsBreakpoints(() => {
      dispose.dispose();
      done();
    });
    breakpointManager.setExceptionBreakpoints(filter);
  });

  it('getExceptionBreakpoints should be work', async (done) => {
    const filter = [{ filter: 'testFilter', label: 'test' }];
    breakpointManager.setExceptionBreakpoints(filter);
    const breakpoints = breakpointManager.getExceptionBreakpoints();
    expect(breakpoints.length).toBe(1);
    done();
  });

  it('updateExceptionBreakpoints should be work', async (done) => {
    const filter = [{ filter: 'testFilter', label: 'test' }];
    const dispose = breakpointManager.onDidChangeExceptionsBreakpoints(() => {
      dispose.dispose();
      done();
    });
    breakpointManager.updateExceptionBreakpoints(filter[0].filter, true);
  });
});
