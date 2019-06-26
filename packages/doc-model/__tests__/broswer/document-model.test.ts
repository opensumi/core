import { DocumentModel } from '@ali/ide-doc-model/lib/browser/doc-model';
import {
  Version,
  VersionType,
  IDocumentModelMirror,
  IMonacoRange,
  IDocumentModelContentChange,
} from '@ali/ide-doc-model';

export const staticEOL = '\n';

export const mockPath = 'rawfile://tsconfig.json';

const mockContent = `{
  "compilerOptions": {
    "moduleResolution": "node",
    "preserveConstEnums": true,
    "allowSyntheticDefaultImports": true,
    "module": "es2015",
    "target": "es6",
    "baseUrl": "whiskey",
    "outDir": "../out",
    "typeRoots" : [
      "typing",
      "../node_modules/@types"
    ]
  },
  "include": [
    "whiskey/src/**/*"
  ]
}`;

const mockMirror: IDocumentModelMirror = {
  uri: mockPath,
  encoding: 'utf8',
  eol: staticEOL,
  language: 'json',
  lines: mockContent.split(staticEOL),
  base: Version.init(VersionType.browser),
};

const lines: IMonacoRange[] = [
  // start
  {
    endColumn: 31,
    endLineNumber: 4,
    startColumn: 1,
    startLineNumber: 1,
  },
  // middle
  {
    startLineNumber: 8,
    startColumn: 1,
    endLineNumber: 13,
    endColumn: 6,
  },
  // end
  {
    endColumn: 2,
    endLineNumber: 18,
    startColumn: 6,
    startLineNumber: 15,
  },
];

const lineResult: string[] = [
  // line 0
  `{
  "compilerOptions": {
    "moduleResolution": "node",
    "preserveConstEnums": true`,

  // line 1
  `    "baseUrl": "whiskey",
    "outDir": "../out",
    "typeRoots" : [
      "typing",
      "../node_modules/@types"
    ]`,

  // line 2
  `clude": [
    "whiskey/src/**/*"
  ]
}`];

const mockChanges: IDocumentModelContentChange[] = [{
  range: { startLineNumber: 5, startColumn: 37, endLineNumber: 5, endColumn: 41 },
  rangeLength: 4,
  rangeOffset: 125,
  text: 'false',
}];

const afterChanges = `{
  "compilerOptions": {
    "moduleResolution": "node",
    "preserveConstEnums": true,
    "allowSyntheticDefaultImports": false,
    "module": "es2015",
    "target": "es6",
    "baseUrl": "whiskey",
    "outDir": "../out",
    "typeRoots" : [
      "typing",
      "../node_modules/@types"
    ]
  },
  "include": [
    "whiskey/src/**/*"
  ]
}`;

describe('document model test suite', () => {
  it('should be able to create document-model from mirror data', () => {

    const documentModel = DocumentModel.fromMirror(mockMirror);

    /**
     * 文档编码
     */
    expect(documentModel.encoding).toEqual(mockMirror.encoding);

    /**
     * 文档断尾
     */
    expect(documentModel.eol).toEqual(mockMirror.eol);

    /**
     * 文档语言
     */
    expect(documentModel.language).toEqual(mockMirror.language);

    /**
     * 文档内容
     */
    expect(documentModel.lines.join(documentModel.eol)).toEqual((mockMirror.lines as string[]).join(mockMirror.eol));

    /**
     * 文档地址
     */
    expect(documentModel.uri.toString()).toEqual(mockMirror.uri);

    /**
     * 获取全部文件内容测试
     */
    expect(documentModel.getText().toString()).toEqual(mockContent);

    /**
     * 获取头部开头的内容
     */
    expect(documentModel.getText(lines[0])).toEqual(lineResult[0]);

    /**
     * 获取中间的内容
     */
    expect(documentModel.getText(lines[1])).toEqual(lineResult[1]);

    /**
     * 获取最后部分的内容
     */
    expect(documentModel.getText(lines[2])).toEqual(lineResult[2]);

    /**
     * 执行内容变化，
     * TODO: 在这里多一个执行事件所耗时间的记录
     */
    documentModel.applyChanges(mockChanges);
    expect(documentModel.getText()).toEqual(afterChanges);

    /**
     * TODO:
     * updateContent 目前由于关联了 monaco，导致无法测试
     */
  });
});
