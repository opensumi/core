import { join } from 'path';

import { URI, uuid } from '@opensumi/ide-core-browser';
import { IDebugBreakpoint } from '@opensumi/ide-debug';
import {
  BreakpointManager,
  DebugBreakpoint,
  isRuntimeBreakpoint,
  isDebugBreakpoint,
  DebugDecorator,
} from '@opensumi/ide-debug/lib/browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { FileServiceClientModule } from '@opensumi/ide-file-service/lib/browser';

describe('Debug Breakpoints', () => {
  const mockInjector = createBrowserInjector([FileServiceClientModule]);
  const fileUri = URI.parse(`file://${join(__dirname, 'debug-breakpoint.test.ts')}`);
  const customBreakpointSource = { line: 8 };
  const nextLine = 10;

  mockInjector.addProviders({
    token: BreakpointManager,
    useClass: BreakpointManager,
  });

  describe('Breakpoint Source', () => {
    let breakpoint: IDebugBreakpoint;
    let decorator: DebugDecorator;

    beforeEach(() => {
      breakpoint = DebugBreakpoint.create(fileUri, customBreakpointSource);
      decorator = new DebugDecorator();
    });

    it('Not Runtime Breakpoint', () => {
      expect(isDebugBreakpoint(breakpoint)).toBeTruthy();
      expect(isRuntimeBreakpoint(breakpoint)).toBeFalsy();
      expect(decorator.getDecoration(breakpoint).className).toEqual('sumi-debug-breakpoint');
    });

    it('Runtime Verified Breakpoint', () => {
      const sessionId = uuid();
      breakpoint.status.set(sessionId, {
        line: nextLine,
        verified: true,
      });
      expect(isRuntimeBreakpoint(breakpoint)).toBeTruthy();
      expect(decorator.getDecoration(breakpoint, true).className).toEqual('sumi-debug-breakpoint');
    });

    it('Runtime Unverified Breakpoint', () => {
      const sessionId = uuid();
      breakpoint.status.set(sessionId, {
        line: nextLine,
        verified: false,
      });
      expect(isRuntimeBreakpoint(breakpoint)).toBeFalsy();
      expect(decorator.getDecoration(breakpoint, true).className).toEqual('sumi-debug-breakpoint-unverified');
    });
  });

  describe('Debug Breakpoint Manager', () => {
    let manager: BreakpointManager;

    beforeAll(() => {
      manager = mockInjector.get<BreakpointManager>(BreakpointManager);
    });

    it('Init', () => {
      expect(manager).toBeDefined();
    });

    it('Add', (done) => {
      const dispoable = manager.onDidChangeBreakpoints((event) => {
        const { affected, added } = event;
        expect(added[0].raw).toEqual(customBreakpointSource);
        expect(affected[0].toString()).toEqual(fileUri.toString());
        dispoable.dispose();
        done();
      });

      manager.addBreakpoint(DebugBreakpoint.create(fileUri, customBreakpointSource, true));
    });

    it('Update', (done) => {
      const dispoable = manager.onDidChangeBreakpoints((event) => {
        const { affected, changed } = event;
        expect(changed[0].raw.line).toEqual(nextLine);
        expect(affected[0].toString()).toEqual(fileUri.toString());
        dispoable.dispose();
        done();
      });

      const breakpoint = manager.getBreakpoint(fileUri, customBreakpointSource.line)!;
      breakpoint.raw.line = nextLine;
      manager.updateBreakpoint(breakpoint);
    });

    it('Delete', (done) => {
      const dispoable = manager.onDidChangeBreakpoints((event) => {
        const { affected, removed } = event;
        expect(removed[0].raw.line).toEqual(nextLine);
        expect(affected[0].toString()).toEqual(fileUri.toString());
        expect(manager.getBreakpoints().length).toEqual(0);
        dispoable.dispose();
        done();
      });

      const breakpoint = manager.getBreakpoint(fileUri, nextLine)!;
      manager.delBreakpoint(breakpoint);
    });

    it('Set Mutiple Breakpoints', () => {
      const bk1 = DebugBreakpoint.create(fileUri, { line: 1 });
      const bk2 = DebugBreakpoint.create(fileUri, { line: 2 });
      const bk3 = DebugBreakpoint.create(fileUri, { line: 3 });
      manager.setBreakpoints(fileUri, [bk1, bk2, bk3]);
      expect(manager.getBreakpoints().length).toEqual(3);
    });

    it('Clear', (done) => {
      const dispoable = manager.onDidChangeBreakpoints((event) => {
        const { affected, removed } = event;
        expect(affected[0].toString()).toEqual(fileUri.toString());
        expect(removed.length).toEqual(3);
        expect(manager.getBreakpoints().length).toEqual(0);
        dispoable.dispose();
        done();
      });

      manager.clearBreakpoints();
    });
  });

  describe('Exception Breakpoint Manager', () => {
    let manager: BreakpointManager;
    let exceptionDescriptors: Array<string>;

    beforeAll(() => {
      manager = mockInjector.get<BreakpointManager>(BreakpointManager);
      exceptionDescriptors = ['all', 'uncaught'];
    });

    it('Set Exception Breakpoints', (done) => {
      const dispoable = manager.onDidChangeExceptionsBreakpoints((event) => {
        const { filters } = event;
        if (filters.length === 2) {
          expect(filters).toEqual(exceptionDescriptors);
          dispoable.dispose();
          done();
        }
      });

      manager.setExceptionBreakpoints(
        exceptionDescriptors.map((filter) => ({
          filter,
          label: `${filter} exceptions`,
          default: true,
        })),
      );
    });
  });
});
