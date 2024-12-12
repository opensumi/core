import { ReadStream } from 'fs';

import fileType from 'file-type';
import * as fse from 'fs-extra';

import {
  BinaryBuffer,
  FileUri,
  ZERO_BYTE_DETECTION_BUFFER_MAX_LEN,
  detectEncodingFromBuffer,
} from '@opensumi/ide-core-common';

import { EditorFileType, getFileTypeByExt, isErrnoException } from '../../../common';

const NO_ENCODING_GUESS_MIN_BYTES = 512; // when not auto guessing the encoding, small number of bytes are enough

export async function getFileType(uri: string): Promise<string | undefined> {
  let readStream: ReadStream | null = null;
  try {
    // 兼容性处理，本质 disk-file 不支持非 file 协议的文件头嗅探
    if (!uri.startsWith('file:/')) {
      return getFileTypeByExt();
    }

    const fsPath = FileUri.fsPath(uri);
    const stat = await fse.stat(fsPath);

    if (stat.isDirectory()) {
      return EditorFileType.Directory;
    } else {
      let ext: string | undefined;
      if (stat.size) {
        readStream = fse.createReadStream(fsPath);
        const streamWithType = await fileType.stream(readStream);

        // 可以拿到 type.fileType 说明为二进制文件
        if (streamWithType.fileType) {
          if (streamWithType.fileType.mime) {
            if (streamWithType.fileType.mime.startsWith('image/')) {
              return EditorFileType.Image;
            }
            if (streamWithType.fileType.mime.startsWith('video/')) {
              return EditorFileType.Video;
            }
          }
          ext = streamWithType.fileType.ext;
        }

        if (!ext) {
          const bufferedChunks: Uint8Array[] = [];
          let bytesRead = 0;

          for await (const chunk of streamWithType) {
            bufferedChunks.push(chunk);
            bytesRead += chunk.length;
            // detectEncodingFromBuffer 只需要 ZERO_BYTE_DETECTION_BUFFER_MAX_LEN 长度的 buffer，剩下的无需读取
            if (bytesRead >= ZERO_BYTE_DETECTION_BUFFER_MAX_LEN) {
              break;
            }
          }

          const detected = detectEncodingFromBuffer(BinaryBuffer.concat(bufferedChunks), false);
          if (detected.seemsBinary) {
            return EditorFileType.Binary;
          }
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
  } finally {
    readStream?.close();
  }
}
