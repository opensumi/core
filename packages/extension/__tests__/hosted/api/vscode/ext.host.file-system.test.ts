import { URI } from '@opensumi/ide-core-common';
import {
  convertToVSCFileStat,
  ExtHostFileSystem,
} from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.file-system';
import { FileChangeType, FileType, FileStat } from '@opensumi/ide-file-service/lib/common';

describe('convertToVSCFileStat', () => {
  it('Should return normal conversion to VSCode format results.', () => {
    expect(
      convertToVSCFileStat({
        uri: 'uri',
        lastModification: 0,
        createTime: 1,
        size: 100,
        isDirectory: false,
        type: 1,
      }),
    ).toEqual({
      type: 1,
      ctime: 1,
      size: 100,
      mtime: 0,
    });
  });
});

describe('VSCFileSystem', () => {
  it.skip('The parameters should be passed to innerFs correctly', () => {
    const calledMap: Map<string, any[]> = new Map();
    const uri = URI.file('/root/test.txt').codeUri;
    const targetUri = URI.file('/root/test.target.txt').codeUri;

    expect(calledMap.get('stat')![0]).toEqual(uri);
    expect(calledMap.get('readDirectory')![0]).toEqual(uri);
    expect(calledMap.get('readFile')![0]).toEqual(uri);

    expect(calledMap.get('writeFile')![0]).toEqual(uri);
    expect(calledMap.get('writeFile')![1]).toEqual(Buffer.from(new Uint8Array()));
    expect(calledMap.get('writeFile')![2]).toEqual({ create: true, overwrite: true });

    expect(calledMap.get('delete')![0]).toEqual(uri);
    expect(calledMap.get('delete')![1]).toEqual({ recursive: true });

    expect(calledMap.get('rename')![0]).toEqual(uri);
    expect(calledMap.get('rename')![1]).toEqual(targetUri);
    expect(calledMap.get('rename')![2]).toEqual({ overwrite: true });

    expect(calledMap.get('copy')![0]).toEqual(uri);
    expect(calledMap.get('copy')![1]).toEqual(targetUri);
    expect(calledMap.get('copy')![2]).toEqual({ overwrite: true });
  });
});

describe('FileSystemWatcher', () => {
  const mockId = 100;
  const calledMap: Map<string, any[]> = new Map();
  const mocExtHostFs = new Proxy(
    {
      onDidChangeCallback: (args: any) => {},
      onDidChange(onDidChangeCallback) {
        this.onDidChangeCallback = onDidChangeCallback;
        return {
          dispose() {},
        };
      },
    },
    {
      get: (target, propKey, receiver) => {
        if (propKey === 'onDidChangeCallback' || propKey === 'onDidChange') {
          return target[propKey];
        }

        if (propKey === 'subscribeWatcher' || propKey === 'unsubscribeWatcher') {
          return (...args) => {
            calledMap.set(String(propKey), args);

            return {
              then(callback) {
                callback && callback(mockId);
              },
            };
          };
        }

        return (...args) => {
          calledMap.set(String(propKey), args);
        };
      },
    },
  );

  it.skip('Addition, deletion and modification events should be normal.', () => {
    const uri = URI.file('/root/test.txt');
  });

  it.skip('Dispose should receive id.', () => {});
});

describe('ExtHostFileSystem', () => {
  const calledMap: Map<string, any[]> = new Map();
  const mockId = 100;
  const uri = URI.file('/root/test/');
  const mockOptions: any = { mockOptions: 'mockOptions' };
  const mockRpcProtocol = {
    getProxy() {
      return new Proxy(
        {},
        {
          get:
            (target, propKey, receiver) =>
            (...args) => {
              calledMap.set(String(propKey), args);
            },
        },
      );
    },
  };
  const mockFsProvider: any = {
    stat() {
      return {
        type: FileType.Directory,
        ctime: 0,
        mtime: 1,
        size: 2,
      };
    },
    readDirectory() {
      return [['test.txt', FileType.File]];
    },
    onDidChangeFile: () => ({ dispose() {} }),
  };
  const extHostFs = new ExtHostFileSystem(
    mockRpcProtocol as any,
    {
      $acceptProviderInfos: jest.fn((scheme: string, capabilities: number | null) => {}),
    } as any,
  );

  it.skip('WatchEmitter should send and receive messages normally.', () => {
    // const uri = URI.file('/root/test.txt');
    // let changeEvent;
    // expect(changeEvent).toEqual({
    //   id: mockId,
    //   event: {
    //     uri: uri.toString(),
    //     type: FileChangeType.UPDATED,
    //   },
    // });
  });

  it.skip('Should normally call the proxy function and pass parameters.', () => {
    // extHostFs.subscribeWatcher(mockOptions);
    // extHostFs.unsubscribeWatcher(mockId);
    // expect(calledMap.get('$subscribeWatcher')![0]).toEqual(mockOptions);
    // expect(calledMap.get('$unsubscribeWatcher')![0]).toEqual(mockId);
  });

  it.skip('Fs provider should be registered correctly.', async () => {
    extHostFs.registerFileSystemProvider('testIt', mockFsProvider);
    // expect(extHostFs.haveProvider('testIt')).toEqual(true);
    // expect(await extHostFs.$haveProvider('testIt')).toEqual(true);
  });

  it.skip('getStat needs to convert VSCode format stat to kt format.', async () => {
    extHostFs.registerFileSystemProvider('testStat', mockFsProvider);
    const expected: FileStat = {
      uri: uri.toString(),
      lastModification: 1,
      createTime: 0,
      isDirectory: true,
      isSymbolicLink: false,
      size: 2,
      children: [
        {
          uri: URI.file('/root/test/test.txt').toString(),
          lastModification: 1,
          createTime: 0,
          isDirectory: true,
          isSymbolicLink: false,
          size: 2,
          children: [],
        },
      ],
    };
    // expect(await extHostFs.$runProviderMethod('testStat', 'stat', [uri.codeUri])).toEqual(expected);
  });
});
