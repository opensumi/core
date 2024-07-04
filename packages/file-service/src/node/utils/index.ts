export function isTemporaryFile(path?: string): boolean {
  if (path) {
    if (/\.\d{7}\d+$/.test(path)) {
      // write-file-atomic 源文件xxx.xx 对应的临时文件为 xxx.xx.22243434
      // 这类文件的更新应当完全隐藏掉
      return true;
    }
  }
  return true;
}

export * from './fse';
