// Mock the heavy dependencies before any imports
jest.mock('@opensumi/ide-editor/lib/common/editor', () => ({}), { virtual: true });
jest.mock('@opensumi/ide-workspace', () => ({}), { virtual: true });
jest.mock('@opensumi/di', () => ({
  Injectable: () => (target: any) => target,
  Autowired: () => () => {},
}));

import { AttachFileContext, SerializedContext } from '../../../src/common/llm-context';
import { ACPChatAgentPromptProvider } from '../../../src/common/prompts/empty-prompt-provider';

function createEmptyContext(): SerializedContext {
  return {
    recentlyViewFiles: [],
    attachedFiles: [],
    attachedFolders: [],
    attachedRules: [],
    globalRules: [],
  };
}

function createAttachFile(overrides: Partial<AttachFileContext> = {}): AttachFileContext {
  return {
    content: 'const a = 1;',
    lineErrors: [],
    path: 'src/index.ts',
    language: 'typescript',
    ...overrides,
  };
}

describe('ACPChatAgentPromptProvider', () => {
  let provider: ACPChatAgentPromptProvider;

  function setupEditor(
    fileInfo: {
      path: string;
      languageId?: string;
      content?: string;
      currentLine?: number;
      lineContent?: string;
    } | null,
  ) {
    if (!fileInfo) {
      (provider as any).workbenchEditorService = { currentEditor: null };
      return;
    }
    (provider as any).workbenchEditorService = {
      currentEditor: {
        currentDocumentModel: {
          uri: { codeUri: { fsPath: fileInfo.path } },
          languageId: fileInfo.languageId || 'typescript',
          getText: () => fileInfo.content || '',
        },
        monacoEditor: fileInfo.currentLine
          ? {
              getSelection: () => ({ startLineNumber: fileInfo.currentLine }),
              getModel: () => ({
                getLineContent: () => fileInfo.lineContent || '',
              }),
            }
          : { getSelection: () => null, getModel: () => null },
      },
    };
    (provider as any).workspaceService = {
      asRelativePath: jest.fn().mockResolvedValue({ path: fileInfo.path }),
    };
  }

  beforeEach(() => {
    provider = new ACPChatAgentPromptProvider();
    setupEditor(null);
  });

  describe('no context - returns plain userMessage', () => {
    it('should return plain userMessage when all context fields are empty and no current file', async () => {
      const result = await provider.provideContextPrompt(createEmptyContext(), 'hello');
      expect(result).toBe('hello');
    });

    it('should return plain userMessage with Chinese text', async () => {
      const result = await provider.provideContextPrompt(createEmptyContext(), '你好');
      expect(result).toBe('你好');
    });
  });

  describe('with currentFile only', () => {
    it('should include current file info with line details and --- separator', async () => {
      setupEditor({ path: 'test/file.ts', currentLine: 1, lineContent: 'const x = 1;' });

      const result = await provider.provideContextPrompt(createEmptyContext(), 'explain this');

      expect(result).toContain('Current file: test/file.ts');
      expect(result).toContain('line 1');
      expect(result).toContain('`const x = 1;`');
      expect(result).toContain('\n\n---\n\n');
      expect(result).toContain('explain this');
      expect(result).not.toMatch(/<[a-z_]+>/);
    });

    it('should include current file without line details when no selection', async () => {
      setupEditor({ path: 'test/file.ts' });

      const result = await provider.provideContextPrompt(createEmptyContext(), 'explain');

      expect(result).toContain('Current file: test/file.ts');
      expect(result).not.toContain('line');
      expect(result).toContain('---');
      expect(result).toContain('explain');
    });

    it('should skip currentFile if it is already in attachedFiles', async () => {
      setupEditor({ path: 'test/file.ts', currentLine: 1, lineContent: 'const x = 1;' });

      const context = createEmptyContext();
      context.attachedFiles = [createAttachFile({ path: 'test/file.ts' })];

      const result = await provider.provideContextPrompt(context, 'explain');

      expect(result).not.toContain('Current file:');
      expect(result).toContain('```test/file.ts');
    });

    it('should show currentFile section when context fields are empty but editor has file', async () => {
      setupEditor({ path: 'test/file.ts' });

      const result = await provider.provideContextPrompt(createEmptyContext(), 'hello');

      expect(result).toContain('Current file: test/file.ts');
      expect(result).toContain('---');
      expect(result).toContain('hello');
    });
  });

  describe('with globalRules (XML stripped)', () => {
    it('should strip XML tags from globalRules', async () => {
      const context = createEmptyContext();
      context.globalRules = [
        "<user_info>\nThe user's OS version is darwin. The absolute path of the user's workspace is /workspace. The user's shell is /bin/zsh.\n</user_info>",
        '\n\n<rules>\nThe rules section has a number of possible rules.\n\n\n<user_specific_rule description="This is a rule set by the user that the agent must follow.">\nrule 1: 这是ide\n</user_specific_rule>\n\n</rules>',
      ];

      const result = await provider.provideContextPrompt(context, 'hello');

      expect(result).toContain('OS version is darwin');
      expect(result).toContain('rule 1: 这是ide');
      expect(result).toContain('hello');
      expect(result).not.toContain('<user_info>');
      expect(result).not.toContain('</user_info>');
      expect(result).not.toContain('<rules>');
      expect(result).not.toContain('<user_specific_rule');
      expect(result).not.toContain('<user_query>');
    });
  });

  describe('with attachedFiles', () => {
    it('should include attached files as code blocks without XML tags', async () => {
      const context = createEmptyContext();
      context.attachedFiles = [createAttachFile({ path: 'src/app.ts', content: 'console.log("hi")' })];

      const result = await provider.provideContextPrompt(context, 'review');

      expect(result).toContain('```src/app.ts');
      expect(result).toContain('console.log("hi")');
      expect(result).toContain('```');
      expect(result).toContain('review');
      expect(result).not.toContain('<attached_files>');
      expect(result).not.toContain('<file_contents>');
    });

    it('should include file selection range', async () => {
      const context = createEmptyContext();
      context.attachedFiles = [createAttachFile({ path: 'src/app.ts', content: 'line content', selection: [10, 20] })];

      const result = await provider.provideContextPrompt(context, 'review');

      expect(result).toContain('```src/app.ts, lines: 10-20');
    });

    it('should include line errors', async () => {
      const context = createEmptyContext();
      context.attachedFiles = [createAttachFile({ lineErrors: ['Type error at line 5', 'Missing import'] })];

      const result = await provider.provideContextPrompt(context, 'fix');

      expect(result).toContain('Errors: Type error at line 5, Missing import');
      expect(result).not.toContain('<linter_errors>');
    });

    it('should handle multiple attached files', async () => {
      const context = createEmptyContext();
      context.attachedFiles = [
        createAttachFile({ path: 'src/a.ts', content: 'file a' }),
        createAttachFile({ path: 'src/b.ts', content: 'file b' }),
      ];

      const result = await provider.provideContextPrompt(context, 'compare');

      expect(result).toContain('```src/a.ts');
      expect(result).toContain('file a');
      expect(result).toContain('```src/b.ts');
      expect(result).toContain('file b');
    });
  });

  describe('with attachedFolders', () => {
    it('should include folder info', async () => {
      const context = createEmptyContext();
      context.attachedFolders = ['Folder: /workspace/src\nContents of directory:\n[file] index.ts'];

      const result = await provider.provideContextPrompt(context, 'list files');

      expect(result).toContain('Folder: /workspace/src');
      expect(result).toContain('[file] index.ts');
      expect(result).toContain('list files');
    });
  });

  describe('with attachedRules (XML stripped)', () => {
    it('should strip XML tags from attachedRules', async () => {
      const context = createEmptyContext();
      context.attachedRules = [
        '\n<rules_context>\n\nRules are extra documentation provided by the user.\n\n',
        'Rule Name: coding-style\nDescription: \nUse 2-space indent',
        '\n</rules_context>\n',
      ];

      const result = await provider.provideContextPrompt(context, 'format code');

      expect(result).toContain('Rule Name: coding-style');
      expect(result).toContain('Use 2-space indent');
      expect(result).not.toContain('<rules_context>');
      expect(result).not.toContain('</rules_context>');
    });
  });

  describe('full context', () => {
    it('should combine all sections with no XML tags and --- before userMessage', async () => {
      setupEditor({ path: 'current.ts', currentLine: 5, lineContent: 'const foo = bar;' });

      const context: SerializedContext = {
        recentlyViewFiles: [],
        globalRules: [
          '<user_info>\nOS info text\n</user_info>',
          '<rules>\n<user_specific_rule>\nglobal rule content\n</user_specific_rule>\n</rules>',
        ],
        attachedFolders: ['Folder: /workspace/src'],
        attachedFiles: [createAttachFile({ path: 'src/other.ts', content: 'other content' })],
        attachedRules: [
          '\n<rules_context>\n',
          'Rule Name: test-rule\nDescription: \nTest description',
          '\n</rules_context>\n',
        ],
      };

      const result = await provider.provideContextPrompt(context, 'do something');

      // Verify no XML tags anywhere
      expect(result).not.toMatch(/<\/?user_info>/);
      expect(result).not.toMatch(/<\/?rules>/);
      expect(result).not.toMatch(/<\/?additional_data>/);
      expect(result).not.toMatch(/<\/?user_query>/);
      expect(result).not.toMatch(/<\/?current_file>/);
      expect(result).not.toMatch(/<\/?attached_files>/);
      expect(result).not.toMatch(/<\/?file_contents>/);
      expect(result).not.toMatch(/<\/?rules_context>/);
      expect(result).not.toMatch(/<\/?user_specific_rule>/);

      // Verify all content is present
      expect(result).toContain('OS info text');
      expect(result).toContain('global rule content');
      expect(result).toContain('Folder: /workspace/src');
      expect(result).toContain('Current file: current.ts');
      expect(result).toContain('line 5');
      expect(result).toContain('```src/other.ts');
      expect(result).toContain('other content');
      expect(result).toContain('Rule Name: test-rule');
      expect(result).toContain('do something');

      // Verify --- separator between context and user message
      expect(result).toContain('\n\n---\n\n');

      // Verify sections are separated by double newlines
      const sections = result.split('\n\n');
      expect(sections.length).toBeGreaterThanOrEqual(5);
    });

    it('should separate context from userMessage with ---', async () => {
      const context = createEmptyContext();
      context.globalRules = ['<user_info>\nsome info\n</user_info>'];

      const result = await provider.provideContextPrompt(context, 'my question');

      const parts = result.split('\n\n---\n\n');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toContain('some info');
      expect(parts[1]).toBe('my question');
    });

    it('should not include --- when returning plain userMessage', async () => {
      const result = await provider.provideContextPrompt(createEmptyContext(), 'hello');

      expect(result).toBe('hello');
      expect(result).not.toContain('---');
    });
  });
});
