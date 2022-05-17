import fse from 'fs-extra';
import temp from 'temp';

// TODO: 以后可能会自己在某个地方实现一套 fs.xx 函数，这里的测试先保留
const move = fse.move;

import { expectThrowsAsync } from '../helper';
describe.skip('fs move is work', () => {
  const track = temp.track();

  let srcFile: temp.OpenFile;
  let targetFile: temp.OpenFile;
  let fileInDir: temp.OpenFile;
  let emptyDir: string;
  let dir: string;
  beforeEach(() => {
    srcFile = track.openSync('srcFile');
    targetFile = track.openSync('targetFile');
    emptyDir = track.mkdirSync('empty-dir');
    dir = track.mkdirSync('dir');
    fileInDir = track.openSync({ dir });
  });

  afterAll(() => {
    track.cleanupSync();
  });

  it('missing -> anything', async () => {
    const missing1 = track.path('missing1');
    const missing2 = track.path('missing2');
    // missing -> missing
    await expectThrowsAsync(move(missing1, missing2));
    // missing -> file
    await expectThrowsAsync(move(missing1, srcFile.path));
    // missing -> empty dir
    await expectThrowsAsync(move(missing1, emptyDir));
    // missing -> dir
    await expectThrowsAsync(move(missing1, dir));
  });
  it('anything -> missing', async () => {
    const newFile = track.path('newFile');
    const newEmptyDir = track.path('newEmptyDir');
    const newDir = track.path('newDir');
    // file -> missing
    await move(targetFile.path, newFile);
    expect(fse.pathExistsSync(targetFile.path)).toBeFalsy();
    expect(fse.pathExistsSync(newFile)).toBeTruthy();
    // empty dir -> missing
    await move(emptyDir, newEmptyDir);
    expect(fse.pathExistsSync(targetFile.path)).toBeFalsy();
    expect(fse.pathExistsSync(newEmptyDir)).toBeTruthy();
    // dir -> missing
    await move(dir, newDir);
    expect(fse.pathExistsSync(dir)).toBeFalsy();
    expect(fse.pathExistsSync(newDir)).toBeTruthy();
  });
  it('file -> file', async () => {
    await expectThrowsAsync(move(srcFile.path, targetFile.path));
    // with overwrite
    await move(srcFile.path, targetFile.path, { overwrite: true });
    expect(fse.pathExistsSync(targetFile.path)).toBeTruthy();
    // src 被移动后就不在了
    expect(fse.pathExistsSync(srcFile.path)).toBeFalsy();
  });
  it('file -> empty dir', async () => {
    await expectThrowsAsync(move(srcFile.path, emptyDir));
    // 并没有被移动
    expect(fse.pathExistsSync(srcFile.path)).toBeTruthy();
  });
  it('file -> dir', async () => {
    await expectThrowsAsync(move(srcFile.path, dir));
    // 并没有被移动
    expect(fse.pathExistsSync(srcFile.path)).toBeTruthy();
  });
  it('dir -> dir', async () => {
    const newDir = track.mkdirSync('newDir');
    track.openSync({ dir: newDir });
    await expectThrowsAsync(move(dir, newDir));
    // with overwrite
    await move(dir, newDir, { overwrite: true });
    expect(fse.pathExistsSync(newDir)).toBeTruthy();
    expect(fse.pathExistsSync(dir)).toBeFalsy();
  });
  it('dir -> file', async () => {
    await expectThrowsAsync(move(dir, targetFile.path));
  });
  it('dir -> empty dir', async () => {
    const newEmptyDir = track.mkdirSync('newEmptyDir');
    await expectThrowsAsync(move(dir, newEmptyDir));
    // with overwrite
    await move(dir, newEmptyDir, { overwrite: true });
    expect(fse.pathExistsSync(newEmptyDir)).toBeTruthy();
    expect(fse.pathExistsSync(dir)).toBeFalsy();
  });
});
