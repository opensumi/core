import { MockContextKeyService } from '../../monaco/__mocks__/monaco.context-key.service';
import { RawContextKey } from '../src/raw-context-key';

const contextKeyService = new (class extends MockContextKeyService {
  match(bool) {
    if (bool) {
      return bool;
    }
    return true;
  }
})();

describe('test for @opensumi/ide-core-browser/src/raw-context-key', () => {
  const contextA = new RawContextKey<boolean>('contextA', false);
  const contextB = new RawContextKey<string>('contextB', 'abc');
  const contextC = new RawContextKey<'test1' | 'test2'>('contextC', 'test2');

  it('ok with and/or', () => {
    const when1 = RawContextKey.and(contextA, contextB);
    const when2 = RawContextKey.or(contextB, contextC);
    expect(when1).toBe('contextA && contextB');
    expect(when2).toBe('contextB || contextC');

    const when3 = RawContextKey.and(when1, when2);
    const when4 = RawContextKey.or(when1, when2);
    expect(when3).toBe('contextA && contextB && contextB || contextC');
    expect(when4).toBe('contextA && contextB || contextB || contextC');
  });

  it('ok with raw/not', () => {
    expect(contextA.raw).toBe('contextA');
    expect(contextB.not).toBe('!contextB');

    const when1 = RawContextKey.and(contextA.raw, contextB.not);
    const when2 = RawContextKey.or(contextB, contextC.not);
    expect(when1).toBe('contextA && !contextB');
    expect(when2).toBe('contextB || !contextC');

    const when3 = RawContextKey.and(when1, when2);
    const when4 = RawContextKey.or(when1, when2);
    expect(when3).toBe('contextA && !contextB && contextB || !contextC');
    expect(when4).toBe('contextA && !contextB || contextB || !contextC');
  });

  it('ok with equalsTo/notEqualTo/regexMatches', () => {
    const when1 = RawContextKey.and(contextA.equalsTo('nba'), contextB.not);
    const when2 = RawContextKey.or(contextB.notEqualTo('cba'), contextC.not);
    const when3 = RawContextKey.or(contextB.regexMatches(/\d+/i), contextC.not);
    const regex = new RegExp('(\\s|^)' + 'source' + '\\b');
    const when4 = RawContextKey.and(contextC.regexMatches(regex));
    expect(when1).toBe('contextA == nba && !contextB');
    expect(when2).toBe('contextB != cba || !contextC');
    expect(when3).toBe('contextB =~ /\\d+/i || !contextC');
    expect(when4).toBe('contextC =~ /(\\s|^)source\\b/');

    const when5 = RawContextKey.and(when1, when2);
    const when6 = RawContextKey.or(when1, when3);
    const when7 = RawContextKey.or(when3, when4);
    expect(when5).toBe('contextA == nba && !contextB && contextB != cba || !contextC');
    expect(when6).toBe('contextA == nba && !contextB || contextB =~ /\\d+/i || !contextC');
    expect(when7).toBe('contextB =~ /\\d+/i || !contextC || contextC =~ /(\\s|^)source\\b/');
  });

  describe('ok with bind/getValue', () => {
    it('ok', () => {
      const contextkeyA = contextA.bind(contextKeyService);
      expect(contextkeyA.get()).toBe(false);
      expect(contextA.getValue(contextKeyService)).toBe(false);

      contextkeyA.set(true);
      expect(contextkeyA.get()).toBe(true);
      expect(contextA.getValue(contextKeyService)).toBe(true);

      contextkeyA.reset();
      expect(contextkeyA.get()).toBe(false);
      expect(contextA.getValue(contextKeyService)).toBe(false);
    });
  });
});
