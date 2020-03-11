import { SourceBreakpoint, DebugBreakpoint, DebugExceptionBreakpoint } from '@ali/ide-debug/lib/browser';
import { URI, localize } from '@ali/ide-core-browser';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';

describe('DebugBreakpoint Model', () => {
  describe('DebugBreakpoint should be work after init', () => {
    // init and mock api
    const breakpointUri = 'file://userhome/debug.ts';
    const origin = {line: 1, column: 1, condition: 'condition', hitCondition: 'hitCondition', logMessage: 'log'};
    const source = SourceBreakpoint.create(new URI(breakpointUri), origin);

    let sessions;
    let workbenchEditorService;
    let labelProvider;
    let breakpointManager;
    let breakpointResource;

    let breakpoint: DebugBreakpoint;
    const raw: DebugProtocol.Breakpoint = {
      id: 1,
      verified: true,
      message: '',
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
    };

    beforeEach(() => {
      workbenchEditorService = {
        open: jest.fn(),
      } as any;
      labelProvider = jest.fn() as any;
      breakpointManager = {
        breakpointsEnabled: true,
        getBreakpoints: jest.fn(() => ([source])),
        setBreakpoints: jest.fn(),
        findMarkers: jest.fn((params: any) => {
          params.dataFilter({
            raw: origin,
          });
          return [source];
        }),
      } as any;
      breakpointResource = {
        open: jest.fn(),
      };
      sessions = {
        getSource: jest.fn(() => breakpointResource),
      } as any;
      breakpoint = new DebugBreakpoint(source,  labelProvider, breakpointManager, workbenchEditorService, sessions);
      // 模拟更新断点信息
      breakpoint.update({raw, origins: [source]});
    });

    afterEach(() => {
      workbenchEditorService.open.mockReset();
      breakpointManager.getBreakpoints.mockReset();
      breakpointManager.setBreakpoints.mockReset();
      breakpointManager.findMarkers.mockReset();
      sessions.getSource.mockReset();
      breakpointResource.open.mockReset();
      labelProvider.mockReset();
    });

    it ('Should have enough values', () => {
      expect(breakpoint.uri.toString()).toBe(breakpointUri);
      expect(breakpoint.origin.raw).toEqual(origin);
      expect(breakpoint.origins.length).toEqual(1);
      expect(typeof breakpoint.id).toBe('string');
      expect(typeof breakpoint.installed).toBe('boolean');
      expect(breakpoint.line).toBe(raw.line);
      expect(breakpoint.column).toBe(raw.column);
      expect(breakpoint.endLine).toBe(raw.endLine);
      expect(breakpoint.endColumn).toBe(raw.endColumn);
      expect(breakpoint.condition).toBe(origin.condition);
      expect(breakpoint.hitCondition).toBe(origin.hitCondition);
      expect(breakpoint.logMessage).toBe(origin.logMessage);
      expect(breakpoint.enabled).toBe(true);
      expect(breakpoint.installed).toBe(true);
      expect(breakpoint.verified).toBe(true);
    });

    it('setEnable method should be work', () => {
      breakpoint.setEnabled(false);
      expect(breakpointManager.getBreakpoints).toBeCalledTimes(1);
      expect(breakpoint.enabled).toBe(false);
    });

    it('open method should be work while source does not existed', async (done) => {
      breakpoint.update({raw});
      await breakpoint.open({} as any);
      expect(workbenchEditorService.open).toBeCalledTimes(1);
      expect(workbenchEditorService.open).toBeCalledWith(
        new URI(breakpointUri),
        {
          range: {
            startLineNumber: raw.line,
            startColumn: raw.column,
            endLineNumber: raw.endLine,
            endColumn: raw.endColumn,
          },
        },
      );
      done();
    });

    it('open method should be work while source existed', async (done) => {
      const newRaw: DebugProtocol.Breakpoint = {
        ...raw,
        source: {},
      };
      breakpoint.update({raw: newRaw});
      await breakpoint.open({} as any);
      expect(breakpointResource.open).toBeCalledTimes(1);
      expect(breakpointResource.open).toBeCalledWith(
        {
          range: {
            startLineNumber: raw.line,
            startColumn: raw.column,
            endLineNumber: raw.endLine,
            endColumn: raw.endColumn,
          },
        },
      );
      done();
    });

    it('updateOrigins method should be work', () => {
      const newOrigin = {line: 2, column: 2, condition: 'condition2', hitCondition: 'hitCondition2', logMessage: 'log2'};
      breakpoint.updateOrigins(newOrigin);
      expect(breakpoint.origin.raw.line).toBe(newOrigin.line);
      expect(breakpoint.origin.raw.column).toBe(newOrigin.column);
      expect(breakpoint.origin.raw.condition).toBe(newOrigin.condition);
      expect(breakpoint.origin.raw.hitCondition).toBe(newOrigin.hitCondition);
      expect(breakpoint.origin.raw.logMessage).toBe(newOrigin.logMessage);
      expect(breakpointManager.setBreakpoints).toBeCalledTimes(1);
    });

    testSuite({enabled: true, verified: false});
    testSuite({enabled: false, verified: true});
    testSuite({enabled: true, verified: true});
    testSuite({enabled: false, verified: true});

    function testSuite(options: {
      enabled: boolean;
      verified: boolean;
    } = { enabled: true, verified: true}) {
      it(`Should return correct decoration while enabled is ${options.enabled} and verified is ${options.verified}`, () => {

        breakpoint.setEnabled(options.enabled);
        breakpoint.update({
          raw: {
            ...raw,
            verified: options.verified,
          },
        });

        // 普通断点
        let newOrigin = {line: 2, column: 2, condition: '', hitCondition: '', logMessage: ''};
        breakpoint.updateOrigins(newOrigin);
        let decoration = breakpoint.getDecoration();
        expect(decoration).toEqual({
          className: 'kaitian-debug-breakpoint' + (options.enabled ? (options.verified ? '' : '-unverified') : '-disabled'),
          // 由于i18n失效这里返回的均为空
          message: [ localize('debug.breakpoint.breakpointMessage') ],
        });
        // 有条件断点
        newOrigin = {line: 2, column: 2, condition: 'condition', hitCondition: '', logMessage: ''};
        breakpoint.updateOrigins(newOrigin);
        decoration = breakpoint.getDecoration();
        expect(decoration).toEqual({
          className: 'kaitian-debug-conditional-breakpoint' + (options.enabled ? (options.verified ? '' : '-unverified') : '-disabled'),
          message: [ localize('debug.breakpoint.conditionalMessage') ],
        });
        // 有日志断点
        newOrigin = {line: 2, column: 2, condition: '', hitCondition: '', logMessage: 'log'};
        breakpoint.updateOrigins(newOrigin);
        decoration = breakpoint.getDecoration();
        expect(decoration).toEqual({
          className: 'kaitian-debug-logpoint' + (options.enabled ? (options.verified ? '' : '-unverified') : '-disabled'),
          message: [ localize('debug.breakpoint.logpointMessage') ],
        });
      });
    }
  });
});

describe('DebugExceptionBreakpoint Model', () => {
  describe('DebugExceptionBreakpoint should be work after init', () => {
    // init and mock api
    let breakpointManager;

    const meta: DebugProtocol.ExceptionBreakpointsFilter =  {
      filter: 'test',
      label: 'Expectation',
      default: false,
    };
    let breakpoint: DebugExceptionBreakpoint;

    beforeEach(() => {
      breakpointManager = {
        updateExceptionBreakpoints: jest.fn(),
      } as any;
      breakpoint = new DebugExceptionBreakpoint(meta, breakpointManager);
    });

    afterEach(() => {
      breakpointManager.updateExceptionBreakpoints.mockReset();
    });

    it ('Should have enough values', () => {
      expect(typeof breakpoint.id).toBe('string');
      expect(typeof breakpoint.uri).toBe('undefined');
      expect(typeof breakpoint.line).toBe('undefined');
      expect(typeof breakpoint.column).toBe('undefined');
      expect(breakpoint.filter).toBe(meta.filter);
      expect(breakpoint.label).toBe(meta.label);
      expect(breakpoint.enabled).toBe(meta.default);
    });

    it ('setEnabled method should be work', () => {
      breakpoint.setEnabled(true);
      expect(breakpoint.enabled).toBe(true);
      expect(breakpointManager.updateExceptionBreakpoints).toBeCalledWith(meta.filter, true);
    });
  });
});
