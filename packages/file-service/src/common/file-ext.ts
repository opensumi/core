export const EXT_LIST_VIDEO = new Set(['mp4', 'webm', 'mkv', 'mov', 'mts', 'flv', 'avi', 'wmv']);

export const EXT_LIST_IMAGE = new Set([
  'png',
  'gif',
  'jpg',
  'jpeg',
  'svg',
  'bmp',
  'avif',
  'cr2',
  'cr3',
  'dng',
  'flif',
  'heic',
  'icns',
  'jxl',
  'jpm',
  'jpx',
  'nef',
  'raf',
  'rw2',
  'tif',
  'orf',
  'webp',
  'apng',
]);

export const EXT_LIST_TEXT = new Set(['xml']);

export const enum EditorFileType {
  Directory = 'directory',
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Binary = 'binary',
}

export function getFileTypeByExt(ext?: string) {
  let type = EditorFileType.Text;
  if (!ext) {
    return type;
  }

  if (EXT_LIST_IMAGE.has(ext)) {
    type = EditorFileType.Image;
  } else if (EXT_LIST_VIDEO.has(ext)) {
    type = EditorFileType.Video;
  } else if (EXT_LIST_TEXT.has(ext)) {
    type = EditorFileType.Text;
  } else {
    type = EditorFileType.Binary;
  }

  return type;
}
