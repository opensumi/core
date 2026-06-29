jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
    Inject: noopDecorator,
    Optional: noopDecorator,
  };
});

// Mock fs for realpathSync
const mockFs = {
  realpathSync: jest.fn((p: string) => {
    // Simulate real path resolution
    if (p.includes('..')) {
      throw new Error('ENOENT');
    }
    return p;
  }),
};

jest.mock('fs', () => mockFs);

import * as path from 'path';

import { ACPErrorCode } from '../../src/node/acp/handlers/constants';
import { AcpFileSystemHandler, AcpFileSystemHandlerToken } from '../../src/node/acp/handlers/file-system.handler';

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
  critical: jest.fn(),
  dispose: jest.fn(),
  getLevel: jest.fn(),
  setLevel: jest.fn(),
};

const mockFileService = {
  getFileStat: jest.fn(),
  resolveContent: jest.fn(),
  setContent: jest.fn(),
  createFile: jest.fn(),
  createFolder: jest.fn(),
};

describe('AcpFileSystemHandler', () => {
  let handler: AcpFileSystemHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    handler = new AcpFileSystemHandler();
    Object.defineProperty(handler, 'logger', { value: mockLogger, writable: true });
    Object.defineProperty(handler, 'fileService', { value: mockFileService, writable: true });

    handler.configure({ workspaceDir: '/test/workspace' });
  });

  describe('configure()', () => {
    it('should set workspaceDir and maxFileSize', () => {
      handler.configure({ workspaceDir: '/new/workspace', maxFileSize: 2048 });

      expect((handler as any).workspaceDir).toBe('/new/workspace');
      expect((handler as any).maxFileSize).toBe(2048);
    });
  });

  describe('resolvePath() security', () => {
    it('should reject when workspaceDir is not set', () => {
      handler.configure({ workspaceDir: '' });

      const result = (handler as any).resolvePath('test.txt');

      expect(result).toBeNull();
    });

    it('should reject path traversal with ..', () => {
      mockFs.realpathSync.mockImplementation((p: string) => {
        if (p === '/test/workspace') {
          return '/test/workspace';
        }
        if (p === '/test/workspace/../etc/passwd') {
          return '/etc/passwd';
        }
        return p;
      });

      const result = (handler as any).resolvePath('../etc/passwd');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should resolve relative paths against workspaceDir', () => {
      mockFs.realpathSync.mockImplementation((p: string) => p);

      const result = (handler as any).resolvePath('src/index.ts');

      expect(result).toBe(path.resolve('/test/workspace', 'src/index.ts'));
    });

    it('should pass through absolute paths within workspace', () => {
      mockFs.realpathSync.mockImplementation((p: string) => p);

      const result = (handler as any).resolvePath('/test/workspace/src/index.ts');

      expect(result).toBe('/test/workspace/src/index.ts');
    });
  });

  describe('readTextFile()', () => {
    it('should return content for valid file', async () => {
      mockFileService.getFileStat.mockResolvedValue({ size: 100, isDirectory: false });
      mockFileService.resolveContent.mockResolvedValue({ content: 'Hello World' });

      const result = await handler.readTextFile({ sessionId: 'sess-1', path: 'test.txt' });

      expect(result.content).toBe('Hello World');
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid path', async () => {
      handler.configure({ workspaceDir: '' });

      const result = await handler.readTextFile({ sessionId: 'sess-1', path: 'test.txt' });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ACPErrorCode.SERVER_ERROR);
    });

    it('should return error when file not found', async () => {
      mockFileService.getFileStat.mockResolvedValue(null);

      const result = await handler.readTextFile({ sessionId: 'sess-1', path: 'nonexistent.txt' });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ACPErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should return error when file too large', async () => {
      mockFileService.getFileStat.mockResolvedValue({ size: 2 * 1024 * 1024, isDirectory: false });

      const result = await handler.readTextFile({ sessionId: 'sess-1', path: 'large.txt' });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('File too large');
    });

    it('should slice lines when line parameter is provided', async () => {
      mockFileService.getFileStat.mockResolvedValue({ size: 100, isDirectory: false });
      mockFileService.resolveContent.mockResolvedValue({
        content: 'line1\nline2\nline3\nline4\nline5',
      });

      const result = await handler.readTextFile({ sessionId: 'sess-1', path: 'test.txt', line: 2, limit: 2 });

      expect(result.content).toBe('line2\nline3');
    });

    it('should handle read error', async () => {
      mockFileService.getFileStat.mockResolvedValue({ size: 100, isDirectory: false });
      mockFileService.resolveContent.mockRejectedValue(new Error('read error'));

      const result = await handler.readTextFile({ sessionId: 'sess-1', path: 'test.txt' });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('read error');
    });
  });

  describe('writeTextFile()', () => {
    it('should write content successfully', async () => {
      mockFileService.getFileStat
        .mockResolvedValueOnce({ isDirectory: true }) // parent exists
        .mockResolvedValueOnce(null); // file doesn't exist

      const result = await handler.writeTextFile({
        sessionId: 'sess-1',
        path: 'test.txt',
        content: 'Hello',
      });

      expect(result.error).toBeUndefined();
      expect(mockFileService.createFile).toHaveBeenCalled();
    });

    it('should return error for invalid path', async () => {
      handler.configure({ workspaceDir: '' });

      const result = await handler.writeTextFile({ sessionId: 'sess-1', path: 'test.txt', content: 'Hello' });

      expect(result.error).toBeDefined();
    });

    it('should create parent directories if needed', async () => {
      mockFileService.getFileStat
        .mockResolvedValueOnce(null) // parent doesn't exist
        .mockResolvedValueOnce(null); // file doesn't exist

      await handler.writeTextFile({
        sessionId: 'sess-1',
        path: 'dir/test.txt',
        content: 'Hello',
      });

      expect(mockFileService.createFolder).toHaveBeenCalled();
    });

    it('should update existing file', async () => {
      mockFileService.getFileStat
        .mockResolvedValueOnce({ isDirectory: true })
        .mockResolvedValueOnce({ isDirectory: false, uri: 'file:///test.txt' });

      await handler.writeTextFile({
        sessionId: 'sess-1',
        path: 'test.txt',
        content: 'Updated content',
      });

      expect(mockFileService.setContent).toHaveBeenCalled();
    });
  });

  describe('detectMimeType()', () => {
    const testCases: [string, string][] = [
      ['test.ts', 'application/typescript'],
      ['test.js', 'application/javascript'],
      ['test.json', 'application/json'],
      ['test.md', 'text/markdown'],
      ['test.yaml', 'application/yaml'],
      ['test.yml', 'application/yaml'],
      ['test.py', 'text/x-python'],
      ['test.java', 'text/x-java'],
      ['test.go', 'text/x-go'],
      ['test.rs', 'text/x-rust'],
      ['test.c', 'text/x-c'],
      ['test.cpp', 'text/x-c++'],
      ['test.h', 'text/x-c'],
      ['test.hpp', 'text/x-c++'],
      ['test.css', 'text/css'],
      ['test.html', 'text/html'],
      ['test.xml', 'application/xml'],
      ['test.jsx', 'text/jsx'],
      ['test.tsx', 'text/tsx'],
      ['test.txt', 'text/plain'],
      ['test.unknown', 'application/octet-stream'],
    ];

    for (const [filename, expected] of testCases) {
      it(`should return ${expected} for ${filename}`, () => {
        const result = (handler as any).detectMimeType(filename);
        expect(result).toBe(expected);
      });
    }
  });

  describe('ACPErrorCode', () => {
    it('should have correct standard error codes', () => {
      expect(ACPErrorCode.PARSE_ERROR).toBe(-32700);
      expect(ACPErrorCode.INVALID_REQUEST).toBe(-32600);
      expect(ACPErrorCode.METHOD_NOT_FOUND).toBe(-32601);
      expect(ACPErrorCode.INVALID_PARAMS).toBe(-32602);
      expect(ACPErrorCode.INTERNAL_ERROR).toBe(-32603);
    });

    it('should have correct ACP-specific codes', () => {
      expect(ACPErrorCode.SERVER_ERROR).toBe(-32000);
      expect(ACPErrorCode.RESOURCE_NOT_FOUND).toBe(-32002);
    });

    it('should have correct application codes', () => {
      expect(ACPErrorCode.AUTHENTICATION_REQUIRED).toBe(1000);
      expect(ACPErrorCode.SESSION_NOT_FOUND).toBe(1001);
      expect(ACPErrorCode.FORBIDDEN).toBe(1003);
    });
  });
});
