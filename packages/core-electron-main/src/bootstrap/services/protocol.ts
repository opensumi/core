import { protocol } from 'electron';
import { readFile } from 'fs-extra';

import { Domain, URI, getDebugLogger } from '@opensumi/ide-core-common';

import { ElectronMainContribution } from '../types';

@Domain(ElectronMainContribution)
export class ProtocolElectronMainContribution implements ElectronMainContribution {
  /**
   * 由于 registerSchemesAsPrivileged 只能调用一次，所有 contribution 都往这个里面塞
   */
  static schemePrivileges: Electron.CustomScheme[] = [
    {
      scheme: 'vscode-resource',
      privileges: {
        secure: true,
        bypassCSP: true,
        standard: true,
        supportFetchAPI: true,
      },
    },
  ];

  onStart() {
    protocol.registerBufferProtocol('vscode-resource', async (req, callback: any) => {
      try {
        const { url } = req;
        //  对于webview中vscode:/aaaa/a或者 vscode:///aaaa/a 的路径
        // 旧版electron此处会是vscode://aaaa/a, 少了个斜杠，导致路径解析出现问题
        const uri = URI.file(decodeURI(url).replace(/^vscode-resource:(\/\/|)/, ''));
        const fsPath = uri.codeUri.fsPath;
        const data = await readFile(fsPath);
        callback({ mimeType: getWebviewContentMimeType(uri), data });
      } catch (e) {
        getDebugLogger().error(e);
        callback({ error: -2 });
      }
    });
  }

  beforeAppReady() {
    if (protocol.registerSchemesAsPrivileged) {
      // 旧版本electron可能没有这个api
      // electron >= 5.x
      protocol.registerSchemesAsPrivileged(ProtocolElectronMainContribution.schemePrivileges);
    } else if ((protocol as any).registerStandardSchemes) {
      // electron < 5.x
      (protocol as any).registerStandardSchemes(['vscode-resource'], {
        secure: true,
      });
    }
  }
}

export const MIME_UNKNOWN = 'application/unknown';

const webviewMimeTypes = new Map([
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain'],
  ['.css', 'text/css'],
  ['.js', 'application/javascript'],
  ['.json', 'application/json'],
  ['.html', 'text/html'],
  ['.htm', 'text/html'],
  ['.xhtml', 'application/xhtml+xml'],
  ['.oft', 'font/otf'],
  ['.xml', 'application/xml'],
]);

export function getWebviewContentMimeType(normalizedPath: URI): string {
  return webviewMimeTypes.get(normalizedPath.path.ext) || getMediaMime(normalizedPath.path.ext) || MIME_UNKNOWN;
}

interface MapExtToMediaMimes {
  [index: string]: string;
}

// Known media mimes that we can handle
const mapExtToMediaMimes: MapExtToMediaMimes = {
  '.aac': 'audio/x-aac',
  '.avi': 'video/x-msvideo',
  '.bmp': 'image/bmp',
  '.flv': 'video/x-flv',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpe': 'image/jpg',
  '.jpeg': 'image/jpg',
  '.jpg': 'image/jpg',
  '.m1v': 'video/mpeg',
  '.m2a': 'audio/mpeg',
  '.m2v': 'video/mpeg',
  '.m3a': 'audio/mpeg',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.mk3d': 'video/x-matroska',
  '.mks': 'video/x-matroska',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.movie': 'video/x-sgi-movie',
  '.mp2': 'audio/mpeg',
  '.mp2a': 'audio/mpeg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mp4a': 'audio/mp4',
  '.mp4v': 'video/mp4',
  '.mpe': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.mpg4': 'video/mp4',
  '.mpga': 'audio/mpeg',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.ogv': 'video/ogg',
  '.png': 'image/png',
  '.psd': 'image/vnd.adobe.photoshop',
  '.qt': 'video/quicktime',
  '.spx': 'audio/ogg',
  '.svg': 'image/svg+xml',
  '.tga': 'image/x-tga',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.wav': 'audio/x-wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.wma': 'audio/x-ms-wma',
  '.wmv': 'video/x-ms-wmv',
  '.woff': 'application/font-woff',
};

export function getMediaMime(ext: string): string | undefined {
  return mapExtToMediaMimes[ext.toLowerCase()];
}
