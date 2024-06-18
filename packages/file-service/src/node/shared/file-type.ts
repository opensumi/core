import fileType from 'file-type';
import * as fse from 'fs-extra';

import { BinaryBuffer, Deferred, FileUri, detectEncodingFromBuffer } from '@opensumi/ide-core-common';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';

import { EditorFileType, getFileTypeByExt, isErrnoException } from '../../common';

const NO_ENCODING_GUESS_MIN_BYTES = 512; // when not auto guessing the encoding, small number of bytes are enough

export async function getFileType(uri: string): Promise<string | undefined> {
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
        const readStream = fse.createReadStream(fsPath);
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
          let bytesBuffered = 0;

          const deferred = new Deferred<boolean | undefined>();

          let decoded = false;

          const decodeStream = async () => {
            decoded = true;
            const detected = await detectEncodingFromBuffer(BinaryBuffer.concat(bufferedChunks), false);

            deferred.resolve(detected.seemsBinary);
          };

          // read file stream
          listenReadable(readStream, {
            onData: async (chunk) => {
              bufferedChunks.push(chunk);
              bytesBuffered += chunk.byteLength;

              // buffered enough data for encoding detection, create stream
              if (bytesBuffered >= NO_ENCODING_GUESS_MIN_BYTES) {
                readStream.pause();

                await decodeStream();
                setTimeout(() => readStream.destroy());
              }
            },
            onEnd: async () => {
              if (!decoded) {
                await decodeStream();
              }
            },
          });
          const isBinary = await deferred.promise;

          readStream.destroy();
          streamWithType.destroy();
          if (isBinary) {
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
  }
}
