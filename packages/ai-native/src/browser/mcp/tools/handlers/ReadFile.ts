import { Autowired, Injectable } from '@opensumi/di';
import { FileSearchQuickCommandHandler } from '@opensumi/ide-addons/lib/browser/file-search.contribution';
import { AppConfig } from '@opensumi/ide-core-browser';
import { CancellationToken, URI } from '@opensumi/ide-core-common';
import { IEditorDocumentModelRef, IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';

@Injectable()
export class FileHandler {
  private static readonly MAX_FILE_SIZE_BYTES = 2e6;
  private static readonly MAX_LINES = 250;
  private static readonly MAX_CHARS = 1e5;
  private static readonly NEWLINE = '\n';

  private fileResultMap: Map<
    string,
    { content: string; startLineOneIndexed: number; endLineOneIndexedInclusive: number }
  > = new Map();

  @Autowired(IEditorDocumentModelService)
  protected modelService: IEditorDocumentModelService;

  @Autowired(FileSearchQuickCommandHandler)
  protected fileSearchQuickCommandHandler: FileSearchQuickCommandHandler;

  @Autowired(AppConfig)
  protected appConfig: AppConfig;

  @Autowired(IFileServiceClient)
  protected fileSystemService: IFileServiceClient;

  async findSimilarFiles(filePath: string, maxResults: number): Promise<string[]> {
    const items = await this.fileSearchQuickCommandHandler.getQueryFiles(filePath, new Set(), CancellationToken.None);
    return items
      .slice(0, maxResults)
      .map((item) => item.getUri()?.codeUri.fsPath)
      .filter(Boolean) as string[];
  }
  // TODO: 错误应该给模型？
  private createFileNotFoundError(filePath: string, similarFiles: string[]): Error {
    const errorMessage =
      similarFiles.length > 0
        ? `Could not find file '${filePath}'. Did you mean one of:\n${similarFiles
            .map((file) => `- ${file}`)
            .join('\n')}`
        : `Could not find file '${filePath}' in the workspace.`;

    return new Error(
      JSON.stringify({
        clientVisibleErrorMessage: errorMessage,
        modelVisibleErrorMessage: errorMessage,
        actualErrorMessage: `File not found: ${filePath}`,
      }),
    );
  }

  private createFileTooLargeError(fileSizeMB: string, fileStatsSize: number): Error {
    return new Error(
      JSON.stringify({
        clientVisibleErrorMessage: `File is too large, >${fileSizeMB}MB`,
        modelVisibleErrorMessage: `The file is too large to read, was >${fileSizeMB}MB`,
        actualErrorMessage: `File is too large to read, was >${fileSizeMB}MB, size: ${fileStatsSize} bytes`,
      }),
    );
  }

  private trimContent(content: string, maxChars: number): string {
    return content.slice(0, maxChars).split(FileHandler.NEWLINE).slice(0, -1).join(FileHandler.NEWLINE);
  }

  private getLineRange(
    fileParams: {
      startLineOneIndexed?: number;
      endLineOneIndexedInclusive?: number;
    },
    forceLimit: boolean,
  ): { start: number; end: number; didShorten: boolean; didSetDefault: boolean } {
    let start = fileParams.startLineOneIndexed ?? 1;
    let end = fileParams.endLineOneIndexedInclusive ?? start + FileHandler.MAX_LINES - 1;
    let didShorten = false;
    let didSetDefault = false;

    if (forceLimit) {
      return { start, end, didShorten, didSetDefault };
    }

    if (fileParams.endLineOneIndexedInclusive === undefined || fileParams.startLineOneIndexed === undefined) {
      start = 1;
      end = FileHandler.MAX_LINES;
      didSetDefault = true;
    } else if (fileParams.endLineOneIndexedInclusive - fileParams.startLineOneIndexed > FileHandler.MAX_LINES) {
      end = fileParams.startLineOneIndexed + FileHandler.MAX_LINES;
      didShorten = true;
    }

    return { start, end, didShorten, didSetDefault };
  }

  async readFile(fileParams: {
    relativeWorkspacePath: string;
    readEntireFile: boolean;
    fileIsAllowedToBeReadEntirely?: boolean;
    startLineOneIndexed?: number;
    endLineOneIndexedInclusive?: number;
  }) {
    if (!fileParams) {
      throw new Error('No read file parameters provided. Need to give at least the path.');
    }

    const uri = new URI(`${this.appConfig.workspaceDir}/${fileParams.relativeWorkspacePath}`);
    if (!uri) {
      const similarFiles = await this.findSimilarFiles(fileParams.relativeWorkspacePath, 3);
      throw this.createFileNotFoundError(fileParams.relativeWorkspacePath, similarFiles);
    }

    const fileSizeMB = (FileHandler.MAX_FILE_SIZE_BYTES / 1e6).toFixed(2);
    const fileStats = await this.fileSystemService.getFileStat(uri.toString());

    if (fileStats?.size && fileStats.size > FileHandler.MAX_FILE_SIZE_BYTES) {
      throw this.createFileTooLargeError(fileSizeMB, fileStats.size);
    }

    let modelReference: IEditorDocumentModelRef | undefined;
    try {
      modelReference = await this.modelService.createModelReference(uri);
      const fileContent = modelReference.instance.getMonacoModel().getValue();
      const fileLines = fileContent.split(FileHandler.NEWLINE);

      const shouldLimitLines = !(fileParams.readEntireFile && fileParams.fileIsAllowedToBeReadEntirely);
      const shouldForceLimitLines = fileParams.readEntireFile && !fileParams.fileIsAllowedToBeReadEntirely;
      let didShortenCharRange = false;

      if (shouldLimitLines) {
        const {
          start,
          end,
          didShorten: didShortenLineRange,
          didSetDefault: didSetDefaultLineRange,
        } = this.getLineRange(fileParams, shouldForceLimitLines);

        const adjustedStart = Math.max(start, 1);
        const adjustedEnd = Math.min(end, fileLines.length);
        let selectedContent = fileLines.slice(adjustedStart - 1, adjustedEnd).join(FileHandler.NEWLINE);

        if (selectedContent.length > FileHandler.MAX_CHARS) {
          didShortenCharRange = true;
          selectedContent = this.trimContent(selectedContent, FileHandler.MAX_CHARS);
        }
        // 文件的浏览窗口需要记录，应用的时候需要用
        if (didShortenLineRange) {
          this.fileResultMap.set(fileParams.relativeWorkspacePath, {
            content: selectedContent,
            startLineOneIndexed: adjustedStart,
            endLineOneIndexedInclusive: adjustedEnd,
          });
        }
        return {
          contents: selectedContent,
          didDowngradeToLineRange: shouldForceLimitLines,
          didShortenLineRange,
          didShortenCharRange,
          didSetDefaultLineRange,
          fullFileContents: fileContent,
          startLineOneIndexed: adjustedStart,
          endLineOneIndexedInclusive: adjustedEnd,
          relativeWorkspacePath: fileParams.relativeWorkspacePath,
        };
      }

      let fullContent = fileContent;
      if (fullContent.length > FileHandler.MAX_CHARS) {
        didShortenCharRange = true;
        fullContent = this.trimContent(fullContent, FileHandler.MAX_CHARS);
      }

      return {
        contents: fullContent,
        fullFileContents: fileContent,
        didDowngradeToLineRange: false,
        didShortenCharRange,
      };
    } finally {
      modelReference?.dispose();
    }
  }

  getFileReadResult(
    relativeWorkspacePath: string,
  ): { content: string; startLineOneIndexed: number; endLineOneIndexedInclusive: number } | undefined {
    return this.fileResultMap.get(relativeWorkspacePath);
  }
}
