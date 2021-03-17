/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as iconv from 'iconv-lite';

export const UTF8 = 'utf8';
export const UTF8_with_bom = 'utf8bom';
export const UTF16be = 'utf16be';
export const UTF16le = 'utf16le';


const SUPPORT_ENCODINGS_TO_ICONV_ENCODINGS: { [name: string]: string } = {
	'ibm866': 'cp866',
	'big5': 'cp950',
  'utf8bom': 'utf8'
};

export function toIconvLiteEncoding(encodingName: string): string {
	const normalizedEncodingName = encodingName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
	const mapped = SUPPORT_ENCODINGS_TO_ICONV_ENCODINGS[normalizedEncodingName];

	return mapped || normalizedEncodingName;
}

/**
 * The encodings that are allowed in a settings file don't match the canonical encoding labels specified by WHATWG.
 * See https://encoding.spec.whatwg.org/#names-and-labels
 * Iconv-lite strips all non-alphanumeric characters, but ripgrep doesn't. For backcompat, allow these labels.
 */
export function toCanonicalName(enc: string): string {
	switch (enc) {
		case 'shiftjis':
			return 'shift-jis';
		case 'utf16le':
			return 'utf-16le';
		case 'utf16be':
			return 'utf-16be';
		case 'big5hkscs':
			return 'big5-hkscs';
		case 'eucjp':
			return 'euc-jp';
		case 'euckr':
			return 'euc-kr';
		case 'koi8r':
			return 'koi8-r';
		case 'koi8u':
			return 'koi8-u';
		case 'macroman':
			return 'x-mac-roman';
		case 'utf8bom':
			return 'utf8';
		default:
			const m = enc.match(/windows(\d+)/);
			if (m) {
				return 'windows-' + m[1];
			}

			return enc;
	}
}

/**
 * nodejs 内置的 Buffer 转换编码不支持 GBK，使用第三方的 iconv-lite
 * @param buffer Uint8Array | Buffer
 * @param encoding 传入的是 SUPPORTED_ENCODINGS 已有的键值（已通过 tests case 的）
 */
export function iconvDecode(buffer: Uint8Array | Buffer, encoding: string) {
  encoding = toIconvLiteEncoding(encoding);
  return iconv.decode(buffer as Buffer, encoding);
}
