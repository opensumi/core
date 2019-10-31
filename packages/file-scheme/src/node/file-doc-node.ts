import { Injectable, Autowired } from '@ali/common-di';
import { IFileSchemeDocNodeService, ISavingContent, IContentChange } from '../common';
import { IEditorDocumentModelSaveResult, IEditorDocumentEditChange } from '@ali/ide-core-node';
import { IFileService } from '@ali/ide-file-service';
import md5 = require('md5');
import { TextDocumentContentChangeEvent, Range } from 'vscode-languageserver-types';

@Injectable()
export class FileSchemeDocNodeServiceImpl implements IFileSchemeDocNodeService {

  @Autowired(IFileService)
  private fileService: IFileService;

  async $saveByChange(uri: string, change: IContentChange, encoding?: string | undefined, force: boolean = false): Promise<IEditorDocumentModelSaveResult> {
    try {
      const stat = await this.fileService.getFileStat(uri);
      if (stat) {
        if (!force) {
          const res = await this.fileService.resolveContent(uri, {encoding});
          if (change.baseMd5 !== md5(res.content)) {
            return {
              state: 'diff',
            };
          }
        }
        const docChanges: TextDocumentContentChangeEvent[] = [];
        change.changes!.forEach((c) => {
          if ((c as IEditorDocumentEditChange).changes) {
            (c as IEditorDocumentEditChange).changes.forEach((e) => {
              const range = Range.create(e.range.startLineNumber - 1, e.range.startColumn - 1, e.range.endLineNumber - 1, e.range.endColumn - 1);
              docChanges.push({
                range,
                text: e.text,
              });
            });
          }
        });
        await this.fileService.updateContent(stat, docChanges, {encoding});
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

  async $saveByContent(uri: string, content: ISavingContent, encoding?: string | undefined, force: boolean = false): Promise<IEditorDocumentModelSaveResult> {
    try {
      const stat = await this.fileService.getFileStat(uri);
      if (stat) {
        if (!force) {
          const res = await this.fileService.resolveContent(uri, {encoding});
          if (content.baseMd5 !== md5(res.content)) {
            return {
              state: 'diff',
            };
          }
        }
        await this.fileService.setContent(stat, content.content, {encoding});
        return {
          state: 'success',
        };
      } else {
        await this.fileService.createFile(uri, {content: content.content, encoding});
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
      if (await this.fileService.exists(uri)) {
        const res = await this.fileService.resolveContent(uri, {encoding});
        return md5(res.content);
      } else {
        return undefined;
      }
    } catch (e) {
      return undefined;
    }
  }

}
