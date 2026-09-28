import { Injector } from '@opensumi/di';
import { IClipboardService } from '@opensumi/ide-core-browser';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences/types';
import { mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MessageService } from '@opensumi/ide-overlay/lib/browser/message.service';
import { IThemeService } from '@opensumi/ide-theme/lib/common/theme.service';

import { XTerm } from '../../src/browser/xterm';

describe('XTerm OSC 52 clipboard', () => {
  const injector = new Injector();
  const clipboardWriteText = jest.fn();
  let xterm: XTerm;

  beforeAll(() => {
    injector.addProviders(
      {
        token: IClipboardService,
        useValue: {
          writeText: clipboardWriteText,
        },
      },
      {
        token: MessageService,
        useValue: mockService({}),
      },
      {
        token: IThemeService,
        useValue: mockService({
          getCurrentThemeSync: () => undefined,
        }),
      },
      {
        token: PreferenceService,
        useValue: mockService({
          get: () => undefined,
        }),
      },
    );
  });

  beforeEach(() => {
    clipboardWriteText.mockClear();
    xterm = injector.get(XTerm, [{ xtermOptions: {} }]);
  });

  afterEach(() => {
    xterm.dispose();
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const write = (data: string) => new Promise<void>((resolve) => xterm.raw.write(data, resolve));

  it('should write the decoded payload to the clipboard on OSC 52', async () => {
    await write(`\x1b]52;c;${Buffer.from('hello opencode', 'utf8').toString('base64')}\x07`);
    await flush();

    expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    expect(clipboardWriteText).toHaveBeenCalledWith('hello opencode');
  });

  it('should decode multi-byte characters as UTF-8', async () => {
    await write(`\x1b]52;c;${Buffer.from('你好，opencode', 'utf8').toString('base64')}\x07`);
    await flush();

    expect(clipboardWriteText).toHaveBeenCalledWith('你好，opencode');
  });

  it('should support the ST terminator', async () => {
    await write(`\x1b]52;c;${Buffer.from('bel vs st', 'utf8').toString('base64')}\x1b\\`);
    await flush();

    expect(clipboardWriteText).toHaveBeenCalledWith('bel vs st');
  });

  it('should ignore clipboard query sequences', async () => {
    await write('\x1b]52;c;?\x07');
    await flush();

    expect(clipboardWriteText).not.toHaveBeenCalled();
  });

  it('should write to the clipboard when the selection target is the primary selection', async () => {
    await write(`\x1b]52;s;${Buffer.from('primary selection', 'utf8').toString('base64')}\x07`);
    await flush();

    expect(clipboardWriteText).toHaveBeenCalledWith('primary selection');
  });

  it('should write to the clipboard for an empty selection parameter', async () => {
    await write(`\x1b]52;;${Buffer.from('default selection', 'utf8').toString('base64')}\x07`);
    await flush();

    expect(clipboardWriteText).toHaveBeenCalledWith('default selection');
  });

  it('should ignore OSC 52 sequences that target cut buffers', async () => {
    await write(`\x1b]52;0;${Buffer.from('cut buffer', 'utf8').toString('base64')}\x07`);
    await flush();

    expect(clipboardWriteText).not.toHaveBeenCalled();
  });

  it('should ignore payloads that are not valid UTF-8', async () => {
    // '/w==' 解码后为 0xff，是非法的 UTF-8 字节序列
    await write('\x1b]52;c;/w==\x07');
    await flush();

    expect(clipboardWriteText).not.toHaveBeenCalled();
  });

  it('should ignore malformed payloads without breaking the terminal', async () => {
    await write('\x1b]52;c;!!!not-base64!!!\x07');
    await flush();

    expect(clipboardWriteText).not.toHaveBeenCalled();
    // 终端仍可正常接收数据
    await write('echo still-alive');
    await flush();
    expect(xterm.raw.buffer.active.getLine(0)?.translateToString(true)).toContain('echo still-alive');
  });
});
