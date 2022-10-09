/**
 * 目前依赖了 mri 这个包，这里主要是测一些我们自己期望的表现
 */
import { parseString, ArgvFactory } from '../src/argv';

describe('parse cli args', () => {
  it('can get value as expected', () => {
    const str = 'node index.js -a -b=1 -c 2';
    const data = parseString(str);
    expect(data.a).toBe(true);
    expect(data.b).toBe(1);
    expect(data.c).toBe(2);
  });

  it('can parse value by rules', () => {
    const str = '123 123 -a -b=1 -c 2';
    const data = parseString(str, {});
    expect(data._[0]).toBe('123');
    expect(data._[1]).toBe('123');
    const data1 = parseString(str, {
      string: ['_'],
    });
    expect(data1._[0]).toBe('123');
    expect(data1._[1]).toBe('123');
  });

  it('ArgvFactory should work', () => {
    const data = new ArgvFactory('haha 1 2 3 -a=1'.split(' '));
    data.string('a');
    const argv = data.argv;
    expect(argv.a).toBe('1');
    expect(argv._).toHaveLength(4);
  });

  it('ArgvFactory help should work and process exit 0', () => {
    const data = new ArgvFactory('haha 1 2 3 -a=1 --help'.split(' '));

    data.help();

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(String(number));
    });
    expect(() => {
      const _ = data.argv;
    }).toThrow();
    expect(mockExit).toHaveBeenCalledWith(0);
    mockExit.mockRestore();
  });

  it('ArgvFactory help should not work when do not invoke help func', () => {
    const data = new ArgvFactory('haha 1 2 3 -a=1 --help'.split(' '));
    const argv = data.argv;
    expect(argv.a).toBe(1);
    expect(argv.help).toBe(true);
  });
});
