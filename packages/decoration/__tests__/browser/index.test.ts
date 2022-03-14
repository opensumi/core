import { Uri, DisposableCollection, Event, Emitter, CancellationToken } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IDecorationsService, IDecorationsProvider, IDecorationData } from '../../src';
import { DecorationModule } from '../../src/browser';

describe('DecorationsService', () => {
  let injector: MockInjector;
  let service: IDecorationsService;
  const toTearDown = new DisposableCollection();

  beforeEach(() => {
    injector = createBrowserInjector([DecorationModule]);
    service = injector.get(IDecorationsService);
    toTearDown.push(service);
  });

  afterEach(() => toTearDown.dispose());

  it('empty result', () => {
    const uri = Uri.parse('/workspace/test');
    expect(service.getDecoration(uri, false)).toBe(undefined);
  });

  it('Async provider, async/evented result', () => {
    const uri = Uri.parse('foo:bar');
    let callCounter = 0;

    service.registerDecorationsProvider(
      new (class implements IDecorationsProvider {
        readonly label: string = 'Test';
        readonly onDidChange: Event<Uri[]> = Event.None;
        provideDecorations(_uri: Uri) {
          callCounter += 1;
          return new Promise<IDecorationData>((resolve) => {
            setTimeout(() =>
              resolve({
                color: 'someBlue',
                tooltip: 'Tooltip',
                letter: 'L',
              }),
            );
          });
        }
      })(),
    );

    // trigger -> async
    expect(service.getDecoration(uri, false)).toBe(undefined);
    expect(callCounter).toBe(1);

    // event when result is computed
    return Event.toPromise(service.onDidChangeDecorations).then((e) => {
      expect(e.affectsResource(uri)).toBeTruthy();

      // sync result
      expect(service.getDecoration(uri, false)!.tooltip).toBe('Tooltip');
      expect(service.getDecoration(uri, false)!.badge).toBe('L');
      expect(callCounter).toBe(1);
    });
  });

  it('Sync provider, sync result', () => {
    const uri = Uri.parse('foo:bar');
    let callCounter = 0;

    service.registerDecorationsProvider(
      new (class implements IDecorationsProvider {
        readonly label: string = 'Test';
        readonly onDidChange: Event<Uri[]> = Event.None;
        provideDecorations(_uri: Uri) {
          callCounter += 1;
          return { color: 'someBlue', tooltip: 'Z' };
        }
      })(),
    );

    // trigger -> sync
    expect(service.getDecoration(uri, false)!.tooltip).toBe('Z');
    expect(callCounter).toBe(1);
  });

  it('Clear decorations on provider dispose', async () => {
    const uri = Uri.parse('foo:bar');
    let callCounter = 0;

    const reg = service.registerDecorationsProvider(
      new (class implements IDecorationsProvider {
        readonly label: string = 'Test';
        readonly onDidChange: Event<Uri[]> = Event.None;
        provideDecorations(_uri: Uri) {
          callCounter += 1;
          return { color: 'someBlue', tooltip: 'J' };
        }
      })(),
    );

    // trigger -> sync
    expect(service.getDecoration(uri, false)!.tooltip).toBe('J');
    expect(callCounter).toBe(1);

    // un-register -> ensure good event
    let didSeeEvent = false;
    const p = new Promise<void>((resolve) => {
      service.onDidChangeDecorations((e) => {
        expect(e.affectsResource(uri)).toBeTruthy();
        expect(service.getDecoration(uri, false)).toBeUndefined();
        expect(callCounter).toBe(1);
        didSeeEvent = true;
        resolve();
      });
    });
    reg.dispose(); // will clear all data
    await p;
    expect(didSeeEvent).toBeTruthy();
  });

  it('No default bubbling', () => {
    let reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: Event.None,
      provideDecorations(uri: Uri) {
        return uri.path.match(/\.txt/) ? { tooltip: '.txt', weight: 17 } : undefined;
      },
    });

    const childUri = Uri.parse('file:///some/path/some/file.txt');

    let deco = service.getDecoration(childUri, false)!;
    expect(deco.tooltip).toBe('.txt');

    deco = service.getDecoration(childUri.with({ path: 'some/path/' }), true)!;
    expect(deco).toBeUndefined();
    reg.dispose();

    // bubble
    reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: Event.None,
      provideDecorations(uri: Uri) {
        return uri.path.match(/\.txt/) ? { tooltip: '.txt.bubble', weight: 71, bubble: true } : undefined;
      },
    });

    deco = service.getDecoration(childUri, false)!;
    expect(deco.tooltip).toBe('.txt.bubble');

    deco = service.getDecoration(childUri.with({ path: 'some/path/' }), true)!;
    expect(typeof deco.tooltip).toBe('string');
  });

  it('Decorations not showing up for second root folder #48502', async () => {
    let cancelCount = 0;
    let callCount = 0;

    const provider = new (class implements IDecorationsProvider {
      _onDidChange = new Emitter<Uri[]>();
      onDidChange: Event<Uri[]> = this._onDidChange.event;

      label = 'foo';

      provideDecorations(_uri: Uri, token: CancellationToken): Promise<IDecorationData> {
        token.onCancellationRequested(() => {
          cancelCount += 1;
        });

        return new Promise((resolve) => {
          callCount += 1;
          setTimeout(() => {
            resolve({ letter: 'foo' });
          }, 10);
        });
      }
    })();

    const reg = service.registerDecorationsProvider(provider);

    const uri = Uri.parse('foo://bar');
    service.getDecoration(uri, false);

    provider._onDidChange.fire([uri]);
    service.getDecoration(uri, false);

    expect(cancelCount).toBe(1);
    expect(callCount).toBe(2);

    reg.dispose();
  });

  it('Decorations not bubbling... #48745', () => {
    const reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: Event.None,
      provideDecorations(uri: Uri) {
        if (uri.path.match(/hello$/)) {
          return { tooltip: 'FOO', weight: 17, bubble: true };
        } else {
          return new Promise<IDecorationData>((_resolve) => {});
        }
      },
    });

    const data1 = service.getDecoration(Uri.parse('a:b/'), true);
    expect(!data1).not.toBeUndefined();

    const data2 = service.getDecoration(Uri.parse('a:b/c.hello'), false)!;
    expect(data2.tooltip).not.toBeUndefined();

    const data3 = service.getDecoration(Uri.parse('a:b/'), true);
    expect(data3).not.toBeUndefined();

    reg.dispose();
  });

  it("Folder decorations don't go away when file with problems is deleted #61919 (part1)", () => {
    const emitter = new Emitter<Uri[]>();
    let gone = false;
    const reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: emitter.event,
      provideDecorations(uri: Uri) {
        if (!gone && uri.path.match(/file.ts$/)) {
          return { tooltip: 'FOO', weight: 17, bubble: true };
        }
        return undefined;
      },
    });

    const uri = Uri.parse('foo:/folder/file.ts');
    const uri2 = Uri.parse('foo:/folder/');
    let data = service.getDecoration(uri, true)!;
    expect(data.tooltip).toBe('FOO');

    data = service.getDecoration(uri2, true)!;
    expect(data.tooltip); // emphazied items...not.toBeUndefined().

    gone = true;
    emitter.fire([uri]);

    data = service.getDecoration(uri, true)!;
    expect(data).toBeUndefined();

    data = service.getDecoration(uri2, true)!;
    expect(data).toBeUndefined();

    reg.dispose();
  });

  it("Folder decorations don't go away when file with problems is deleted #61919 (part2)", () => {
    const emitter = new Emitter<Uri[]>();
    let gone = false;
    const reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: emitter.event,
      provideDecorations(uri: Uri) {
        if (!gone && uri.path.match(/file.ts$/)) {
          return { tooltip: 'FOO', weight: 17, bubble: true };
        }
        return undefined;
      },
    });

    const uri = Uri.parse('foo:/folder/file.ts');
    const uri2 = Uri.parse('foo:/folder/');
    let data = service.getDecoration(uri, true)!;
    expect(data.tooltip).toBe('FOO');

    data = service.getDecoration(uri2, true)!;
    expect(data.tooltip); // emphazied items...not.toBeUndefined().

    return new Promise<void>((resolve, reject) => {
      const l = service.onDidChangeDecorations((e) => {
        l.dispose();
        try {
          expect(e.affectsResource(uri)).not.toBeUndefined();
          expect(e.affectsResource(uri2)).not.toBeUndefined();
          resolve();
          reg.dispose();
        } catch (err) {
          reject(err);
          reg.dispose();
        }
      });
      gone = true;
      emitter.fire([uri]);
    });
  });

  it('Initial flush/Flush all', async () => {
    let callCount = 0;

    const provider = new (class implements IDecorationsProvider {
      _onDidChange = new Emitter<Uri[]>();
      onDidChange: Event<Uri[]> = this._onDidChange.event;

      label = 'foo';

      provideDecorations(_uri: Uri): IDecorationData {
        callCount += 1;
        return {
          letter: 'foo',
        };
      }
    })();

    const uri = Uri.file('/test/workspace');
    service.getDecoration(uri, false);

    const reg = service.registerDecorationsProvider(provider);

    // test for flush
    const event1 = service.onDidChangeDecorations((e) => {
      event1.dispose();
      expect(e.affectsResource(uri)).toBeTruthy();
      expect(e.affectsResource(Uri.parse('git://aa.ts'))).toBeTruthy();
      expect(e.affectsResource(undefined as any)).toBeTruthy();
    });

    provider._onDidChange.fire([uri]);
    service.getDecoration(uri, false);

    expect(callCount).toBe(1);

    // test for flush
    const event2 = service.onDidChangeDecorations((e) => {
      event2.dispose();
      expect(e.affectsResource(uri)).toBeTruthy();
      expect(e.affectsResource(Uri.parse('git://aa.ts'))).toBeTruthy();
      expect(e.affectsResource(undefined as any)).toBeTruthy();
      reg.dispose();
    });

    // force flush data
    provider._onDidChange.fire(undefined as any);
  });

  it('Multi decorations', async () => {
    const uri = Uri.parse('foo:bar');
    let callCounter = 0;

    toTearDown.push(
      service.registerDecorationsProvider(
        new (class implements IDecorationsProvider {
          readonly label: string = 'TestSync';
          readonly onDidChange: Event<Uri[]> = Event.None;
          provideDecorations(_uri: Uri) {
            callCounter += 1;
            return {
              color: 'someBlue',
              tooltip: 'Z',
              letter: 'A',
            };
          }
        })(),
      ),
    );

    // trigger -> sync
    expect(service.getDecoration(uri, false)!.tooltip).toBe('Z');
    expect(service.getDecoration(uri, false)!.color).toBe('someBlue');
    expect(service.getDecoration(uri, false)!.badge).toBe('A');
    expect(callCounter).toBe(1);

    toTearDown.push(
      service.registerDecorationsProvider(
        new (class implements IDecorationsProvider {
          readonly label: string = 'TestSync1';
          readonly onDidChange: Event<Uri[]> = Event.None;
          provideDecorations(_uri: Uri) {
            callCounter += 1;
            return {
              color: 'someGreen',
              tooltip: 'Tooltip',
              letter: 'L',
              weight: 1,
            };
          }
        })(),
      ),
    );

    // trigger -> sync
    expect(service.getDecoration(uri, false)!.tooltip).toBe('Tooltip • Z');
    expect(service.getDecoration(uri, false)!.color).toBe('someGreen');
    expect(service.getDecoration(uri, false)!.badge).toBe('L,A');
    expect(callCounter).toBe(2);
  });
});
