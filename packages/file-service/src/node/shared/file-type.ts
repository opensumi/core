import fileType from 'file-type';
import * as fse from 'fs-extra';

import { FileUri } from '@opensumi/ide-core-common';

import { EditorFileType, getFileTypeByExt, isErrnoException } from '../../common';

export async function getFileType(uri: string): Promise<string | undefined> {
  try {
    // 兼容性处理，本质 disk-file 不支持非 file 协议的文件头嗅探
    if (!uri.startsWith('file:/')) {
      return getFileTypeByExt();
    }
    const stat = await fse.stat(FileUri.fsPath(uri));

    if (stat.isDirectory()) {
      return 'directory';
    } else {
      let ext: string | undefined;
      if (stat.size) {
        const type = await fileType.stream(fse.createReadStream(FileUri.fsPath(uri)));
        // 可以拿到 type.fileType 说明为二进制文件
        if (type.fileType) {
          if (type.fileType.mime) {
            if (type.fileType.mime.startsWith('image/')) {
              return EditorFileType.Image;
            }
            if (type.fileType.mime.startsWith('video/')) {
              return EditorFileType.Video;
            }
          }
          ext = type.fileType.ext;
        }
      }
      return getFileTypeByExt(ext);
    }
  } catch (error) {
    if (isErrnoException(error)) {
      if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
        return undefined;
      }
    }
  }
}
