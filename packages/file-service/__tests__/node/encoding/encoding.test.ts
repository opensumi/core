import * as path from 'path';
import * as fs from 'fs-extra';
import * as temp from 'temp';
import { tmpdir } from 'os';
import { Injector } from '@ali/common-di';
import { URI, FileUri } from '@ali/ide-core-node';
import { IFileService } from '../../../src/common';
import { createNodeInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { FileServiceModule } from '../../../src/node';
import { FileStat } from '../../../src/common/files';
import { encode } from '../../../src/node/encoding';

describe('encoding', () => {
  let root: URI;
  let fileService: IFileService;
  let injector: Injector;

  beforeEach(() => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));

    injector = createNodeInjector([FileServiceModule]);

    fileService = injector.get(IFileService);
  });

  it('Should get utf8 file', async () => {
    const result = await fileService.getEncoding(path.join(__dirname, './data/utf8'));
    expect(result).toEqual('utf8');
  });

  it('Should get utf8-bom', async () => {
    const result = await fileService.getEncoding(path.join(__dirname, './data/utf8-bom'));
    expect(result).toEqual('utf8bom');
  });

  it('Should get utf16be', async () => {
    const result = await fileService.getEncoding(path.join(__dirname, './data/utf16be'));
    expect(result).toEqual('utf16be');
  });

  it('Should get utf16le', async () => {
    const result = await fileService.getEncoding(path.join(__dirname, './data/utf16le'));
    expect(result).toEqual('utf16le');
  });

  it('Should get cp950', async () => {
    const result = await fileService.getEncoding(path.join(__dirname, './data/cp950'));
    expect(result).toEqual('cp950');
  });

  it('Should get utf8 info', () => {
    const result = fileService.getEncodingInfo('utf8');
    expect(result).toEqual({
      labelLong: 'UTF-8',
      labelShort: 'UTF-8',
      id: 'utf8',
    });
  });

  it('Should get gbk content', async () => {
    const tempContent = '内容编码是gbk';
    const filePath = FileUri.fsPath(root.resolve('gbk.js'));
    const encoding = 'gbk';

    await fs.writeFile(filePath, encode(tempContent, encoding));
    const data = await fileService.resolveContent(filePath, { encoding });

    expect(data.content).toEqual(tempContent);
  });

  it('Should get utf8bom content', async () => {
    const tempContent = '内容编码是utf8bom';
    const filePath = FileUri.fsPath(root.resolve('utf8bom.js'));
    const encoding = 'utf8bom';

    await fs.writeFile(filePath, encode(tempContent, encoding));
    const receivedEncoding = await fileService.getEncoding(filePath);
    const data = await fileService.resolveContent(filePath, { encoding });

    expect(receivedEncoding).toEqual(encoding);
    expect(data.content).toEqual(tempContent);
  });
});
