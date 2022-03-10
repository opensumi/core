import path from 'path';
import stream from 'stream';

import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { ProcessModule, IProcessManage, IProcessFactory } from '../../src/';
import { ProcessErrorEvent, IProcessStartEvent } from '../../src/common';

const FORK_TEST_FILE = path.join(__dirname, '../../scripts/process-fork-test.js');

describe('Process test', () => {
  const injector = createNodeInjector([ProcessModule]);
  const processFactory = injector.get(IProcessFactory);

  it('test error on non-existent path', async () => {
    const error = await new Promise<ProcessErrorEvent>((resolve, reject) => {
      const proc = processFactory.create({ command: '/non-existent' });
      proc.onStart(reject);
      proc.onError(resolve);
      proc.onExit(reject);
    });

    expect(error.code).toEqual('ENOENT');
  });

  it('test start event', async () => {
    await new Promise<IProcessStartEvent>(async (resolve, reject) => {
      const args = ['-e', 'process.exit(3)'];
      const rawProcess = processFactory.create({ command: process.execPath, args });
      rawProcess.onStart(() => resolve(true));
      rawProcess.onError(reject);
      rawProcess.onExit(reject);
    });
  });

  it('test exit', async () => {
    const args = ['--version'];
    const rawProcess = processFactory.create({ command: process.execPath, args });
    const p = new Promise<number>((resolve, reject) => {
      rawProcess.onError((error) => {
        reject();
      });

      rawProcess.onExit((event) => {
        if (event.code === undefined) {
          reject();
        }

        resolve(event.code);
      });
    });

    const exitCode = await p;
    return expect(exitCode).toEqual(0);
  });

  it('test pipe stdout stream', async () => {
    const output = await new Promise<string>(async (resolve, reject) => {
      const args = ['-e', 'console.log("text to stdout")'];
      const outStream = new stream.PassThrough();
      const rawProcess = processFactory.create({ command: process.execPath, args });
      rawProcess.onError(reject);

      rawProcess.outputStream.pipe(outStream);

      let buf = '';
      outStream.on('data', (data) => {
        buf += data.toString();
      });
      outStream.on('end', () => {
        resolve(buf.trim());
      });
    });

    return expect(output).toEqual('text to stdout');
  });

  it('test pipe stderr stream', async () => {
    const output = await new Promise<string>(async (resolve, reject) => {
      const args = ['-e', 'console.error("text to stderr")'];
      const outStream = new stream.PassThrough();
      const rawProcess = processFactory.create({ command: process.execPath, args });
      rawProcess.onError(reject);

      rawProcess.errorStream.pipe(outStream);

      let buf = '';
      outStream.on('data', (data) => {
        buf += data.toString();
      });
      outStream.on('end', () => {
        resolve(buf.trim());
      });
    });

    return expect(output).toEqual('text to stderr');
  });

  it('test forked pipe stdout stream', async () => {
    const args = ['version'];
    const rawProcess = processFactory.create({ modulePath: FORK_TEST_FILE, args, options: { stdio: 'pipe' } });

    const outStream = new stream.PassThrough();

    const p = new Promise<string>((resolve, reject) => {
      let version = '';
      outStream.on('data', (data) => {
        version += data.toString();
      });
      outStream.on('end', () => {
        resolve(version.trim());
      });
    });

    rawProcess.outputStream.pipe(outStream);

    return expect(await p).toEqual('1.0.0');
  });

  it('test forked pipe stderr stream', async () => {
    const rawProcess = processFactory.create({ modulePath: FORK_TEST_FILE, args: [], options: { stdio: 'pipe' } });

    const outStream = new stream.PassThrough();

    const p = new Promise<string>((resolve, reject) => {
      let version = '';
      outStream.on('data', (data) => {
        version += data.toString();
      });
      outStream.on('end', () => {
        resolve(version.trim());
      });
    });

    rawProcess.errorStream.pipe(outStream);

    return expect((await p).indexOf('Error') === 0).toBe(true);
  });
});

describe('ProcessManage test', () => {
  const injector = createNodeInjector([ProcessModule]);
  const processManage = injector.get(IProcessManage);
  const processFactory = injector.get(IProcessFactory);

  it('Method', () => {
    const cmd = processFactory.create({ command: 'node' });

    const cmdPid = cmd.pid;

    const getCmd = processManage.get(cmdPid);
    const getCmdPid = getCmd && getCmd.pid;

    let unregisterPid;
    processManage.onUnregister((id) => {
      unregisterPid = id;
    });
    processManage.dispose();

    expect(getCmdPid).toBe(cmdPid);
    expect(unregisterPid).toBe(cmdPid);
    expect(processManage.get(cmdPid)).toBeUndefined();
  });
});
