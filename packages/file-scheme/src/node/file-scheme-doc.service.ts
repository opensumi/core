import { existsSync, readFile, statSync, writeFile } from 'fs-extra';

import { Injectable, Autowired } from '@opensumi/di';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import {
  IEditorDocumentModelSaveResult,
  URI,
  IEditorDocumentChange,
  BasicTextLines,
  isEditChange,
} from '@opensumi/ide-core-node';
import { IFileService } from '@opensumi/ide-file-service';
import { encode, decode } from '@opensumi/ide-file-service/lib/node/encoding';

import { IFileSchemeDocNodeService, ISavingContent, IContentChange } from '../common';

@Injectable()
export class FileSchemeDocNodeServiceImpl implements IFileSchemeDocNodeService {
  @Autowired(IFileService)
  private fileService: IFileService;

  @Autowired(IHashCalculateService)
  private readonly hashCalculateService: IHashCalculateService;

  // 由于此处只处理file协议，为了简洁，不再使用 fileService,

  async $saveByChange(
    uri: string,
    change: IContentChange,
    encoding?: string | undefined,
    force = false,
  ): Promise<IEditorDocumentModelSaveResult> {
    try {
      const fsPath = new URI(uri).codeUri.fsPath;
      if (existsSync(fsPath)) {
        const mtime = statSync(fsPath).mtime.getTime();
        const contentBuffer = await readFile(fsPath);
        const content = decode(contentBuffer, encoding ? encoding : 'utf8');
        if (!force) {
          const currentMd5 = this.hashCalculateService.calculate(content);
          if (change.baseMd5 !== currentMd5) {
            return {
              state: 'diff',
            };
          }
        }
        const contentRes = applyChanges(content, change.changes!, change.eol);
        if (statSync(fsPath).mtime.getTime() !== mtime) {
          throw new Error('File has been modified during saving, please retry');
        }
        await writeFile(fsPath, encode(contentRes, encoding ? encoding : 'utf8'));
        return {
          state: 'success',
        };
      } else {
        return {
          state: 'error',
          errorMessage: 'useByContent',
        };
      }
    } catch (e) {
      return {
        state: 'error',
        errorMessage: e.toString(),
      };
    }
  }

  async $saveByContent(
    uri: string,
    content: ISavingContent,
    encoding?: string | undefined,
    force = false,
  ): Promise<IEditorDocumentModelSaveResult> {
    try {
      const stat = await this.fileService.getFileStat(uri);
      if (stat) {
        if (!force) {
          const res = await this.fileService.resolveContent(uri, { encoding });
          if (content.baseMd5 !== this.hashCalculateService.calculate(res.content)) {
            return {
              state: 'diff',
            };
          }
        }
        await this.fileService.setContent(stat, content.content, { encoding });
        return {
          state: 'success',
        };
      } else {
        await this.fileService.createFile(uri, { content: content.content, encoding });
        return {
          state: 'success',
        };
      }
    } catch (e) {
      return {
        state: 'error',
        errorMessage: e.toString(),
      };
    }
  }

  async $getMd5(uri: string, encoding?: string | undefined): Promise<string | undefined> {
    try {
      if (await this.fileService.access(uri)) {
        const res = await this.fileService.resolveContent(uri, { encoding });
        return this.hashCalculateService.calculate(res.content);
      } else {
        return undefined;
      }
    } catch (e) {
      return undefined;
    }
  }
}

/**
 * 注意： 对于一个change来说，同时执行的多个 operation 对应的都是同一个原始 content;
 * 常见例子: vscode 中 cmd+d 编辑
 * @param content
 * @param changes
 */

export function applyChanges(content: string, changes: IEditorDocumentChange[], eol: '\n' | '\r\n'): string {
  const textLines = new BasicTextLines(content.split(eol), eol);
  changes.forEach((change) => {
    if (isEditChange(change)) {
      change.changes.forEach((change) => {
        // 这里从前端传过来的 changes 已经倒序排序过，所以可以安全的 apply
        textLines.acceptChange(change);
      });
    } else {
      textLines.acceptEol(change.eol);
    }
  });
  return textLines.getContent();
}
