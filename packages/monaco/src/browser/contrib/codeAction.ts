export * from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/common/types';

export class CodeActionKind {
  private static readonly sep = '.';

  public static readonly QuickFix = new CodeActionKind('quickfix');
  public static readonly Refactor = new CodeActionKind('refactor');
  public static readonly RefactorExtract = CodeActionKind.Refactor.append('extract');
  public static readonly RefactorInline = CodeActionKind.Refactor.append('inline');
  public static readonly RefactorMove = CodeActionKind.Refactor.append('move');
  public static readonly RefactorRewrite = CodeActionKind.Refactor.append('rewrite');
  public static readonly Notebook = new CodeActionKind('notebook');
  public static readonly Source = new CodeActionKind('source');
  public static readonly SourceOrganizeImports = CodeActionKind.Source.append('organizeImports');
  public static readonly SourceFixAll = CodeActionKind.Source.append('fixAll');
  public static readonly SurroundWith = CodeActionKind.Refactor.append('surround');

  constructor(public readonly value: string) {}

  public equals(other: CodeActionKind): boolean {
    return this.value === other.value;
  }

  public contains(other: CodeActionKind): boolean {
    return this.equals(other) || this.value === '' || other.value.startsWith(this.value + CodeActionKind.sep);
  }

  public intersects(other: CodeActionKind): boolean {
    return this.contains(other) || other.contains(this);
  }

  public append(part: string): CodeActionKind {
    return new CodeActionKind(this.value + CodeActionKind.sep + part);
  }
}
