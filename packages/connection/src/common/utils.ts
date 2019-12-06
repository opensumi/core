import * as lzutf8 from 'lzutf8';
import { isElectronEnv } from '@ali/ide-core-common';

const encoding = 'Base64'; // 'StorageBinaryString'

export function stringify(obj: any): string {
  const str = JSON.stringify(obj);

  if (!isElectronEnv()) {
    return lzutf8.compress(str, {
      outputEncoding: encoding,
    });
  } else {
    return str;
  }
}

export function parse(input: string, reviver?: (this: any, key: string, value: any) => any): any {
  let str;

  if (!isElectronEnv()) {
    str = lzutf8.decompress(input, {
      inputEncoding: encoding,
    });
  } else {
    str = input;
  }
  return JSON.parse(str, reviver);
}
