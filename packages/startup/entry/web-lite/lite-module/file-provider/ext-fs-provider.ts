import { Injectable } from '@opensumi/di';
import { Uri, Event, Emitter, BinaryBuffer, FileSystemProviderCapabilities } from '@opensumi/ide-core-browser';
import { FileSystemProvider, FileStat, FileType, FileChangeEvent } from '@opensumi/ide-file-service';

/**
 * 解析 ext:// 文件，解决前端插件加载问题
 */
@Injectable()
export class ExtFsProvider implements FileSystemProvider {
  capabilities: FileSystemProviderCapabilities = 2048;
  onDidChangeCapabilities: Event<void> = new Emitter<void>().event;
  readonly?: boolean | undefined;
  onDidChangeFile: Event<FileChangeEvent>;
  watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): number {
    throw new Error('Method not implemented.');
  }

  stat(uri: Uri): Promise<FileStat> {
    throw new Error('Method not implemented.');
  }

  readDirectory(uri: Uri): [string, FileType][] | Promise<[string, FileType][]> {
    throw new Error('Method not implemented.');
  }

  createDirectory(uri: Uri): void | Promise<void | FileStat> {
    throw new Error('Method not implemented.');
  }

  async readFile(uri: Uri) {
    const requestUrl = uri.with({ scheme: 'https' });

    return await fetch(requestUrl.toString(), {
      headers: {
        'Accept-Encoding': 'gzip, deflate',
      },
    })
      .then((res) => res.text())
      .then((content) => BinaryBuffer.fromString(content).buffer);
  }

  writeFile(
    uri: Uri,
    content: Buffer,
    options: { create: boolean; overwrite: boolean },
  ): void | Promise<void | FileStat> {
    throw new Error('Method not implemented.');
  }

  delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean | undefined }): void | Promise<void> {
    throw new Error('Method not implemented.');
  }

  rename(oldstring: Uri, newstring: Uri, options: { overwrite: boolean }): void | Promise<void | FileStat> {
    throw new Error('Method not implemented.');
  }
}
