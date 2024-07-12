import debounce from 'lodash/debounce';
import Parser from 'web-tree-sitter';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import {
  CommandService,
  Disposable,
  Domain,
  IDisposable,
  PreferenceService,
  URI,
  localize,
} from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common';
import {
  BrowserEditorContribution,
  IEditor,
  IEditorFeatureContribution,
  IEditorFeatureRegistry,
} from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { MouseTargetType } from '@opensumi/ide-monaco/lib/browser/monaco-exports/editor';
import { IIconService, IThemeService, IconType } from '@opensumi/ide-theme';
import { IModelDeltaDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

import { LanguageParserService } from '../../languages/service';
import { toMonacoRange } from '../../languages/tree-sitter/common';

import styles from './interface-navigation.module.less';

// 亮色和暗色 Interface Icon 的 base64，用于彩色图标渲染
const interfaceIconDark =
  'PCEtLSBDb3B5cmlnaHQgMjAwMC0yMDIyIEpldEJyYWlucyBzLnIuby4gYW5kIGNvbnRyaWJ1dG9ycy4gVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgdGhlIEFwYWNoZSAyLjAgbGljZW5zZS4gLS0+Cjxzdmcgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Qm94PSIwIDAgMTYgMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjgiIGN5PSI4IiByPSI2LjUiIGZpbGw9IiMyNTM2MjciIHN0cm9rZT0iIzU3OTY1QyIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEwIDQuNVY1LjVMOC41IDUuNVYxMC41SDEwVjExLjVMOC41IDExLjVINy41TDYgMTEuNVYxMC41SDcuNVY1LjVMNiA1LjVWNC41SDcuNUg4LjVIMTBaIiBmaWxsPSIjNTc5NjVDIi8+Cjwvc3ZnPgo=';
const interfaceIconLight =
  'PCEtLSBDb3B5cmlnaHQgMjAwMC0yMDIyIEpldEJyYWlucyBzLnIuby4gYW5kIGNvbnRyaWJ1dG9ycy4gVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgdGhlIEFwYWNoZSAyLjAgbGljZW5zZS4gLS0+Cjxzdmcgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Qm94PSIwIDAgMTYgMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjgiIGN5PSI4IiByPSI2LjUiIGZpbGw9IiNGMkZDRjMiIHN0cm9rZT0iIzVGQjg2NSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEwIDQuNVY1LjVMOC41IDUuNVYxMC41SDEwVjExLjVMOC41IDExLjVINy41TDYgMTEuNVYxMC41SDcuNVY1LjVMNiA1LjVWNC41SDcuNUg4LjVIMTBaIiBmaWxsPSIjNUZCODY1Ii8+Cjwvc3ZnPgo=';

interface IInterfaceDecoration extends IDisposable {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
  click(e: monaco.editor.IEditorMouseEvent): boolean;
}

@Injectable({ multiple: true })
class InterfaceDecoration extends Disposable implements IInterfaceDecoration {
  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(IIconService)
  private iconService: IIconService;

  @Autowired(IThemeService)
  public readonly themeService: IThemeService;

  public id = '';

  public editorDecoration: IModelDeltaDecoration;

  constructor(public interfaceNode: Parser.SyntaxNode, private editor: monaco.editor.ICodeEditor) {
    super();
    // Interface Icon 有 Light 和 Dark 两种，根据工作空间 Theme 来设置
    const interfaceIconThemed: string =
      this.themeService.getCurrentThemeSync().type === 'dark' ? interfaceIconDark : interfaceIconLight;
    const interfaceIcon = this.iconService.fromIcon(
      '',
      `data:image/svg+xml;base64,${interfaceIconThemed}`,
      IconType.Base64,
    );

    // interface-navigation-glyph 很重要，在 debug 模块会判断这个 class，来让对应的位置触发 debug 断点逻辑（可全局搜索这个 class 来了解详细逻辑）
    const glyphMarginClassName = `${interfaceIcon} ${styles['interface-navigation-icon']} interface-navigation-glyph`;
    this.editorDecoration = {
      range: toMonacoRange(interfaceNode),
      options: {
        isWholeLine: true,
        glyphMarginClassName,
        description: 'interface-decoration',
        glyphMarginHoverMessage: { value: localize('preference.ai.native.interface.quick.navigation.hover') },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    };
  }

  public get line() {
    return this.editorDecoration.range.startLineNumber;
  }

  public click(e: monaco.editor.IEditorMouseEvent): boolean {
    if (e.target.position?.lineNumber !== this.line || e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN) {
      return false;
    }

    this.editor.setPosition({
      lineNumber: this.interfaceNode.startPosition.row + 1,
      column: this.interfaceNode.startPosition.column + 1,
    });

    this.commandService.executeCommand('editor.action.goToImplementation');

    return true;
  }
}

@Injectable({ multiple: true })
export class InterfaceNavigationDecorationsContribution implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(LanguageParserService)
  protected readonly languageParserService: LanguageParserService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  public get currentUri(): URI | null {
    return this.editor.currentUri;
  }

  private readonly disposer: Disposable = new Disposable();

  private lastDecorations: IInterfaceDecoration[] = [];

  // 目前仅支持这三类接口语言的跳转
  private supportLanguages = ['java', 'typescript', 'typescriptreact'];

  constructor(@Optional() private readonly editor: IEditor) {}

  private getInterfaceQuickJumpEnabled() {
    return this.preferenceService.getValid(AINativeSettingSectionsId.InterfaceQuickNavigationEnabled, true);
  }

  private async parseJavaInterfaces(rootNode: Parser.SyntaxNode) {
    const interfaces: { interfaceNode?: Parser.SyntaxNode; members?: Parser.SyntaxNode[] }[] = [];

    // 定义一个递归函数来处理所有节点
    function processNode(node: Parser.SyntaxNode) {
      // 检查当前节点是否是接口声明
      if (node.type === 'interface_declaration') {
        const interfaceNode = node.children.find((n) => n.type === 'identifier');
        const body = node.children.find((n) => n.type === 'interface_body');

        const members = body?.children
          .filter((child) => child.type === 'field_declaration' || child.type === 'method_declaration')
          .map((memberNode) => memberNode.children.find((n) => n.type === 'identifier'))
          .filter((it) => !!it) as Parser.SyntaxNode[];

        interfaces.push({ interfaceNode, members });
      }

      // 递归遍历所有子节点
      node.children.forEach((child) => processNode(child));
    }

    // 从根节点开始处理
    processNode(rootNode);

    return interfaces;
  }

  private async parseTypeScriptInterfaces(rootNode: Parser.SyntaxNode) {
    const interfaces: { interfaceNode?: Parser.SyntaxNode; members?: Parser.SyntaxNode[] }[] = [];

    // 定义一个递归函数来处理所有节点
    function processNode(node: Parser.SyntaxNode) {
      // 检查当前节点是否是接口声明
      if (node.type === 'interface_declaration') {
        const interfaceNode = node.children.find((n) => n.type === 'type_identifier');
        // TS 场景只处理 Interface 声明
        interfaces.push({ interfaceNode, members: [] });
      }

      // 递归遍历所有子节点
      node.children.forEach((child) => processNode(child));
    }

    // 从根节点开始处理
    processNode(rootNode);

    return interfaces;
  }

  async decorateEditor() {
    if (!this.getInterfaceQuickJumpEnabled()) {
      return;
    }

    const textModel = this.editor.monacoEditor.getModel();
    if (!textModel) {
      return;
    }
    const languageId = textModel.getLanguageId();

    if (!this.supportLanguages.includes(languageId)) {
      return;
    }

    const parser = this.languageParserService.createParser(languageId);
    if (!parser) {
      return;
    }

    const rootNode = await parser.parseAST(textModel);
    if (!rootNode) {
      return;
    }

    let interfaces: { interfaceNode?: Parser.SyntaxNode; members?: Parser.SyntaxNode[] }[] = [];

    if (languageId === 'typescript' || languageId === 'typescriptreact') {
      interfaces = await this.parseTypeScriptInterfaces(rootNode);
    } else if (languageId === 'java') {
      interfaces = await this.parseJavaInterfaces(rootNode);
    } else {
      // 尚未支持的语言 Parser
      return;
    }

    interfaces =
      languageId === 'java' ? await this.parseJavaInterfaces(rootNode) : await this.parseTypeScriptInterfaces(rootNode);

    const decorations = interfaces
      .map(({ interfaceNode, members }) => {
        if (!interfaceNode || !members) {
          return [];
        }
        const decorations = [this.injector.get(InterfaceDecoration, [interfaceNode, this.editor.monacoEditor])];
        members.forEach((member) => {
          decorations.push(this.injector.get(InterfaceDecoration, [member, this.editor.monacoEditor]));
        });
        return decorations;
      })
      .flat();

    this.editor.monacoEditor.changeDecorations((accessor) => {
      const newDecorations: IInterfaceDecoration[] = decorations;

      accessor
        .deltaDecorations(
          this.lastDecorations.map((d) => d.id),
          newDecorations.map((d) => d.editorDecoration),
        )
        .forEach((id, i) => (newDecorations[i].id = id));
      this.lastDecorations = newDecorations;
    });
  }

  contribute(): IDisposable {
    if (!this.getInterfaceQuickJumpEnabled()) {
      return this.disposer;
    }

    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeModel(async () => {
        await this.decorateEditor();
      }),
    );

    // Model 发生修改时，做一个 3000ms 的等待时间，避免频繁的 AST 解析
    const debouncedDecorate = debounce(() => {
      this.decorateEditor();
    }, 3000);

    this.disposer.addDispose(this.editor.monacoEditor.onDidChangeModelContent(debouncedDecorate));

    this.disposer.addDispose(
      this.editor.monacoEditor.onMouseDown((e) => {
        for (const decoration of this.lastDecorations) {
          if (decoration.click(e)) {
            e.event.stopPropagation();
            return;
          }
        }
      }),
    );
    return this.disposer;
  }
}

@Domain(BrowserEditorContribution)
export class InterfaceNavigationContribution implements BrowserEditorContribution {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) =>
        this.injector.get(InterfaceNavigationDecorationsContribution, [editor]).contribute(),
    });
  }
}
