import { PreferenceService, URI } from '@opensumi/ide-core-browser';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  IEditorOpenType,
  IResource,
} from '@opensumi/ide-editor/lib/browser';
import { EditorComponentRegistryImpl } from '@opensumi/ide-editor/lib/browser/component';
import { FileSystemEditorComponentContribution } from '@opensumi/ide-file-scheme/lib/browser/file-scheme.contribution';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { ILanguageService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

const createMockResource = (uriString: string) => ({ uri: new URI(uriString) } as any as IResource);

const mockFileService = {
  onFilesChanged: jest.fn(),
  getFileStat: jest.fn(),
  handlesScheme: jest.fn(),
  getFileType: jest.fn(),
};

describe('contribution test', () => {
  let injector: MockInjector;
  let contribution: BrowserEditorContribution;
  let registry: EditorComponentRegistry;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(FileSystemEditorComponentContribution);
    injector.addProviders(
      {
        token: IFileServiceClient,
        useValue: mockFileService,
      },
      {
        token: PreferenceService,
        useValue: jest.fn(),
      },
      {
        token: EditorComponentRegistry,
        useClass: EditorComponentRegistryImpl,
      },
    );

    const langService: ILanguageService = StandaloneServices.get(ILanguageService);
    langService.registerLanguage({
      id: 'javascript',
      extensions: ['.js', '.mjs', '.cjs'],
      aliases: ['js'],
      mimetypes: ['text/javascript'],
    });

    contribution = injector.get(FileSystemEditorComponentContribution);
    registry = injector.get(EditorComponentRegistry);
    contribution.registerEditorComponent?.(registry);
  });

  it('should correctly handle file with type of code', async () => {
    mockFileService.getFileStat
      .mockReturnValueOnce({ size: 666 })
      .mockReturnValueOnce({ size: 666 })
      .mockReturnValueOnce({ size: 666 });
    // plain text
    let openTypes: IEditorOpenType[];
    openTypes = await registry.resolveEditorComponent(createMockResource('file:///foo/1.txt'));
    expect(openTypes[0].type).toBe('code');
    // known custom language
    openTypes = await registry.resolveEditorComponent(createMockResource('file:///foo/1.js'));
    expect(openTypes[0].type).toBe('code');
    // unknown language but with text type
    mockFileService.getFileType.mockReturnValueOnce('text');
    openTypes = await registry.resolveEditorComponent(createMockResource('file:///foo/1.rs'));
    expect(openTypes[0].type).toBe('code');
  });

  it('should fallback to LARGE_FILE_PREVENT_COMPONENT_ID if file is too large', async () => {
    mockFileService.getFileStat.mockReturnValueOnce({ size: 114514 });
    const openTypes = await registry.resolveEditorComponent(createMockResource('file:///foo/2.js'));
    expect(openTypes[0].type).toBe('component');
    expect(openTypes[0].componentId).toBe('large-file-prevent');
  });

  it('should open file with type of video and image', async () => {
    mockFileService.getFileType.mockReturnValueOnce('video').mockReturnValueOnce('image');
    let openTypes: IEditorOpenType[];
    openTypes = await registry.resolveEditorComponent(createMockResource('file:///foo/video.mp4'));
    expect(openTypes[0].type).toBe('component');
    expect(openTypes[0].componentId).toBe('video-preview');
    openTypes = await registry.resolveEditorComponent(createMockResource('file:///foo/image.jpg'));
    expect(openTypes[0].type).toBe('component');
    expect(openTypes[0].componentId).toBe('image-preview');
  });
});
