import { Event, Uri, IDisposable } from '@ali/ide-core-common';
import {
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
} from '../common';

// export class ExtensionsFileSystemProvider implements FileSystemProvider {
//   readonly onDidChangeFile: Event<FileChangeEvent>;
//   readonly client: FileServiceExtClient;

//   constructor(client: FileServiceExtClient) {
//     this.client = client;
//   }

//   watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): IDisposable {
//     return {
//       dispose() {

//       },
//     };
//   }

//   async stat(uri: Uri): Promise<FileStat> {
//     return this.client.stat(uri);
//   }

//   readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]>;

// }
