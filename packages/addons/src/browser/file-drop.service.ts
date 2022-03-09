import { Injectable, Autowired } from '@opensumi/di';
import { Path } from '@opensumi/ide-components/lib/utils/path';
import { Uri, formatLocalize } from '@opensumi/ide-core-browser/lib';
import { IStatusBarService, StatusBarAlignment, StatusBarEntryAccessor } from '@opensumi/ide-core-browser/lib/services';
import { WithEventBus } from '@opensumi/ide-core-common/lib';
import { FileTreeDropEvent } from '@opensumi/ide-core-common/lib/types/dnd';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import {
  IFileDropFrontendService,
  IFileDropBackendService,
  FileDropServicePath,
  IWebkitDataTransfer,
  IWebkitDataTransferItemEntry,
} from '../common';

@Injectable()
export class FileDropService extends WithEventBus implements IFileDropFrontendService {
  private pending: Set<string> = new Set();

  @Autowired(IFileServiceClient)
  protected readonly fs: IFileServiceClient;

  @Autowired(FileDropServicePath)
  protected readonly dropService: IFileDropBackendService;

  @Autowired(IStatusBarService)
  protected readonly statusBarService: IStatusBarService;

  private uploadStatus?: StatusBarEntryAccessor;

  private onDidUploadFileStart(fullPath: string) {
    this.pending.add(fullPath);
    this.createOrUpdateStatusBar();
  }

  private onDidUploadFileEnd(fullPath: string) {
    this.pending.delete(fullPath);
    this.createOrUpdateStatusBar();
  }

  private createOrUpdateStatusBar(speed?: string) {
    if (this.pending.size === 0) {
      if (this.uploadStatus) {
        this.uploadStatus.dispose();
        this.uploadStatus = undefined;
      }
      return;
    }

    const entryId = 'sumi-upload-file-status';
    const message = formatLocalize('workbench.uploadingFiles', this.pending.size, speed || '0 MB');
    const entry = {
      text: message,
      alignment: StatusBarAlignment.RIGHT,
      tooltip: message,
      iconClass: 'kaitian-icon kticon-cloud-server',
    };

    if (!this.uploadStatus) {
      this.uploadStatus = this.statusBarService.addElement(entryId, entry);
    } else {
      this.uploadStatus.update({ id: entryId, ...entry });
    }
  }

  onDidDropFile(e: FileTreeDropEvent) {
    const {
      payload: { event, targetDir },
    } = e;
    if (!targetDir || !event.dataTransfer?.files || event.dataTransfer.files.length === 0) {
      return;
    }

    const items = (event.dataTransfer as unknown as IWebkitDataTransfer).items;

    let uploadedBytes = 0;
    const startTime = Date.now();
    const reporter = (uploaded: number) => {
      uploadedBytes += uploaded;
      const now = Date.now();
      const bytesUploadedPerSecond = uploadedBytes / ((now - startTime) / 1000);
      const speed = `${(bytesUploadedPerSecond / 1024 / 1024).toFixed(2)} MB`;
      this.createOrUpdateStatusBar(speed);
    };

    for (const item of items) {
      const entry = item.webkitGetAsEntry();
      this.processFilesEntry(targetDir, entry, reporter);
    }
  }

  private async processFilesEntry(
    targetDir: string,
    entry: IWebkitDataTransferItemEntry,
    reporter: (uploadedByteLength: number) => void,
  ) {
    if (entry.isFile) {
      this.processFileEntry(entry, targetDir, reporter);
    } else {
      const folder = Uri.file(new Path(targetDir).join(entry.fullPath).toString()).toString();
      await this.fs.createFolder(folder);
      this.processDirEntry(entry, targetDir, reporter);
    }
  }

  private toBinaryString(uint8Arr: Uint8Array): string {
    let i;
    const length = uint8Arr.length;
    let resultString = '';
    for (i = 0; i < length; i += 1) {
      resultString += String.fromCharCode(uint8Arr[i]);
    }
    return resultString;
  }

  private async doUploadFile(file: File, targetDir: string, reporter: (uploadedByteLength: number) => void) {
    const filePath = new Path(targetDir).join(file.name).toString();
    this.onDidUploadFileStart(filePath.toString());
    await this.fs.createFile(Uri.file(filePath.toString()).toString());
    await this.dropService.ensureFileExist(file.name, targetDir);
    const reader = file.stream().getReader();
    let res: ReadableStreamDefaultReadResult<Uint8Array> = await reader.read();
    while (!res.done) {
      await this.dropService.writeStream(this.toBinaryString(res.value), file.name, targetDir, res.done);
      reporter(res.value?.byteLength);
      res = await reader.read();
    }

    if (res.done) {
      this.onDidUploadFileEnd(filePath.toString());
    }
  }

  private processFileEntry(
    fileEntry: IWebkitDataTransferItemEntry,
    targetDir: string,
    reporter: (uploadedByteLength: number) => void,
  ): void {
    fileEntry.file(
      (fileChunk) => {
        const file = new File([fileChunk], fileEntry.fullPath!, { type: fileEntry.type! });
        this.doUploadFile(file, targetDir, reporter);
      },
      () => {},
    );
  }

  private processDirEntry(
    entry: IWebkitDataTransferItemEntry,
    targetDir: string,
    reporter: (uploadedByteLength: number) => void,
  ) {
    const dirReader = entry.createReader();
    dirReader.readEntries(
      (entries) => {
        entries.forEach(async (fileOrDirEntry) => {
          this.processFilesEntry(targetDir, fileOrDirEntry, reporter);
        });
      },
      () => {},
    );
  }
}
