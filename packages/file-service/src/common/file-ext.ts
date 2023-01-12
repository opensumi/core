export const EXT_LIST_VIDEO = ['mp4', 'webm', 'mkv', 'mov', 'mts', 'flv', 'avi', 'wmv'];

export const EXT_LIST_IMAGE = [
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
];

export const enum EditorFileType {
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

  if (EXT_LIST_IMAGE.indexOf(ext) !== -1) {
    type = EditorFileType.Image;
  } else if (EXT_LIST_VIDEO.indexOf(ext) !== -1) {
    type = EditorFileType.Video;
  } else if (ext && ['xml'].indexOf(ext) === -1) {
    type = EditorFileType.Binary;
  }

  return type;
}
