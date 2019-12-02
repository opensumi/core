import * as lzutf8 from 'lzutf8';

const encoding = 'Base64'; // 'StorageBinaryString'

export function stringify(obj: any): string {
  const str = JSON.stringify(obj);
  return lzutf8.compress(str, {
    outputEncoding: encoding,
  });
}

export function parse(input: string, reviver?: (this: any, key: string, value: any) => any): any {
  const str = lzutf8.decompress(input, {
    inputEncoding: encoding,
  });
  return JSON.parse(str, reviver);
}
