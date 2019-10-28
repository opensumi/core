import URI from 'vscode-uri';
import { Event, Emitter, CancellationToken } from '@ali/ide-core-common';

import { FileDecorationsService } from '../../src/browser/decorationsService';
import { IDecorationsProvider, IDecorationData } from '../../src';

describe('DecorationsService', () => {
  let service: FileDecorationsService;

  beforeEach(() => {
    if (service) {
      service.dispose();
    }
    service = new FileDecorationsService();
  });

  test('Async provider, async/evented result', () => {

    const uri = URI.parse('foo:bar');
    let callCounter = 0;

    // tslint:disable-next-line:new-parens
    service.registerDecorationsProvider(new class implements IDecorationsProvider {
      readonly label: string = 'Test';
      readonly onDidChange: Event<URI[]> = Event.None;
      provideDecorations(_uri: URI) {
        callCounter += 1;
        return new Promise<IDecorationData>((resolve) => {
          setTimeout(() => resolve({
            color: 'someBlue',
            tooltip: 'T',
          }));
        });
      }
    });

    // trigger -> async
    expect(service.getDecoration(uri, false)).toBe(undefined);
    expect(callCounter).toBe(1);

    // event when result is computed
    return Event.toPromise(service.onDidChangeDecorations).then((e) => {
      expect(e.affectsResource(uri)).toBeTruthy();

      // sync result
      expect(service.getDecoration(uri, false)!.tooltip).toBe('T');
      expect(callCounter).toBe(1);
    });
  });

  test('Sync provider, sync result', () => {
    const uri = URI.parse('foo:bar');
    let callCounter = 0;

    // tslint:disable-next-line:new-parens
    service.registerDecorationsProvider(new class implements IDecorationsProvider {
      readonly label: string = 'Test';
      readonly onDidChange: Event<URI[]> = Event.None;
      provideDecorations(_uri: URI) {
        callCounter += 1;
        return { color: 'someBlue', tooltip: 'Z' };
      }
    });

    // trigger -> sync
    expect(service.getDecoration(uri, false)!.tooltip).toBe('Z');
    expect(callCounter).toBe(1);
  });

  test('Clear decorations on provider dispose', async () => {
    const uri = URI.parse('foo:bar');
    let callCounter = 0;

    // tslint:disable-next-line:new-parens
    const reg = service.registerDecorationsProvider(new class implements IDecorationsProvider {
      readonly label: string = 'Test';
      readonly onDidChange: Event<URI[]> = Event.None;
      provideDecorations(_uri: URI) {
        callCounter += 1;
        return { color: 'someBlue', tooltip: 'J' };
      }
    });

    // trigger -> sync
    expect(service.getDecoration(uri, false)!.tooltip).toBe('J');
    expect(callCounter).toBe(1);

    // un-register -> ensure good event
    let didSeeEvent = false;
    const p = new Promise((resolve) => {
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

  test('No default bubbling', () => {
    let reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: Event.None,
      provideDecorations(uri: URI) {
        return uri.path.match(/\.txt/)
          ? { tooltip: '.txt', weight: 17 }
          : undefined;
      },
    });

    const childUri = URI.parse('file:///some/path/some/file.txt');

    let deco = service.getDecoration(childUri, false)!;
    expect(deco.tooltip).toBe('.txt');

    deco = service.getDecoration(childUri.with({ path: 'some/path/' }), true)!;
    expect(deco).toBeUndefined();
    reg.dispose();

    // bubble
    reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: Event.None,
      provideDecorations(uri: URI) {
        return uri.path.match(/\.txt/)
          ? { tooltip: '.txt.bubble', weight: 71, bubble: true }
          : undefined;
      },
    });

    deco = service.getDecoration(childUri, false)!;
    expect(deco.tooltip).toBe('.txt.bubble');

    deco = service.getDecoration(childUri.with({ path: 'some/path/' }), true)!;
    expect(typeof deco.tooltip).toBe('string');
  });

  test('Decorations not showing up for second root folder #48502', async () => {
    let cancelCount = 0;
    const winjsCancelCount = 0;
    let callCount = 0;

    // tslint:disable-next-line:new-parens
    const provider = new class implements IDecorationsProvider {
      _onDidChange = new Emitter<URI[]>();
      onDidChange: Event<URI[]> = this._onDidChange.event;

      label: string = 'foo';

      provideDecorations(_uri: URI, token: CancellationToken): Promise<IDecorationData> {

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
    };

    const reg = service.registerDecorationsProvider(provider);

    const uri = URI.parse('foo://bar');
    service.getDecoration(uri, false);

    provider._onDidChange.fire([uri]);
    service.getDecoration(uri, false);

    expect(cancelCount).toBe(1);
    expect(winjsCancelCount).toBe(0);
    expect(callCount).toBe(2);

    reg.dispose();
  });

  test('Decorations not bubbling... #48745', () => {

    const reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: Event.None,
      provideDecorations(uri: URI) {
        if (uri.path.match(/hello$/)) {
          return { tooltip: 'FOO', weight: 17, bubble: true };
        } else {
          return new Promise<IDecorationData>((_resolve) => { });
        }
      },
    });

    const data1 = service.getDecoration(URI.parse('a:b/'), true);
    expect(!data1).not.toBeUndefined();

    const data2 = service.getDecoration(URI.parse('a:b/c.hello'), false)!;
    expect(data2.tooltip).not.toBeUndefined();

    const data3 = service.getDecoration(URI.parse('a:b/'), true);
    expect(data3).not.toBeUndefined();

    reg.dispose();
  });

  test('Folder decorations don\'t go away when file with problems is deleted #61919 (part1)', () => {

    const emitter = new Emitter<URI[]>();
    let gone = false;
    const reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: emitter.event,
      provideDecorations(uri: URI) {
        if (!gone && uri.path.match(/file.ts$/)) {
          return { tooltip: 'FOO', weight: 17, bubble: true };
        }
        return undefined;
      },
    });

    const uri = URI.parse('foo:/folder/file.ts');
    const uri2 = URI.parse('foo:/folder/');
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

  test('Folder decorations don\'t go away when file with problems is deleted #61919 (part2)', () => {

    const emitter = new Emitter<URI[]>();
    let gone = false;
    const reg = service.registerDecorationsProvider({
      label: 'Test',
      onDidChange: emitter.event,
      provideDecorations(uri: URI) {
        if (!gone && uri.path.match(/file.ts$/)) {
          return { tooltip: 'FOO', weight: 17, bubble: true };
        }
        return undefined;
      },
    });

    const uri = URI.parse('foo:/folder/file.ts');
    const uri2 = URI.parse('foo:/folder/');
    let data = service.getDecoration(uri, true)!;
    expect(data.tooltip).toBe('FOO');

    data = service.getDecoration(uri2, true)!;
    expect(data.tooltip); // emphazied items...not.toBeUndefined().

    return new Promise((resolve, reject) => {
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
});
