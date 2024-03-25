import { Autowired, Injectable, Optional } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-components';
import { IPreferenceSettingsService, PreferenceSchemaProvider } from '@opensumi/ide-core-browser';
import {
  AbstractContextMenuService,
  ICtxMenuRenderer,
  IMenuItem,
  IMenuRegistry,
  ISubmenuItem,
  MenuCommandDesc,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { CommandRegistry, Disposable, IDisposable, PreferenceScope, URI, localize } from '@opensumi/ide-core-common';
import { IEditor, IEditorDocumentModelService, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import * as monaco from '@opensumi/ide-monaco';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';
import { MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IModelDeltaDecoration } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

import { SettingJSONGlyphMarginEdit } from '../common/commands';

import { PreferenceSettingsService } from './preference-settings.service';
import { USER_PREFERENCE_URI } from './user-preference-provider';

@Injectable({ multiple: true })
export class EditPreferenceDecorationsContribution implements IEditorFeatureContribution {
  @Autowired(IPreferenceSettingsService)
  private preferenceSettingsService: PreferenceSettingsService;

  @Autowired(ICtxMenuRenderer)
  private ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(PreferenceSchemaProvider)
  private preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IEditorDocumentModelService)
  private editorDocumentModelService: IEditorDocumentModelService;

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(AbstractContextMenuService)
  private menuService: AbstractContextMenuService;

  @Autowired(IMenuRegistry)
  private menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistry;

  private readonly disposer: Disposable = new Disposable();

  private _preferences: string[] = [];
  private _currentLine = 0;

  private readonly _editPreferenceDecoration = this.editor.monacoEditor.createDecorationsCollection();

  constructor(@Optional() private readonly editor: IEditor) {}

  private verifyEditor(): boolean {
    if (this.editor.currentUri?.toString() === USER_PREFERENCE_URI.toString()) {
      return true;
    }
    return false;
  }

  /**
   * 返回 user scope 的真实 setting.json 路径
   */
  private async getPreferenceUrl(): Promise<URI | undefined> {
    const settingUri = await this.preferenceSettingsService.getPreferenceUrl(PreferenceScope.User);
    if (settingUri) {
      const stat = await this.fileServiceClient.getFileStat(settingUri);
      if (!stat) {
        return undefined;
      }

      return URI.parse(stat.uri);
    }
    return undefined;
  }

  private async getDocumentModelRef(uri: URI) {
    const document = this.editorDocumentModelService.getModelReference(uri);
    if (!document) {
      return this.editorDocumentModelService.createModelReference(uri);
    }

    return document;
  }

  public contribute(): IDisposable {
    this.disposer.addDispose(
      this.editor.monacoEditor.onMouseDown(async (e: monaco.editor.IEditorMouseEvent) => {
        if (e.target.range?.startLineNumber !== this.currentLine && !this.verifyEditor()) {
          return;
        }
        if (
          e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN ||
          e.target.detail.isAfterLines ||
          !this.isVisible()
        ) {
          return;
        }
        this.registerMenuItems(this.preferences);
        this.showContextMenu(e);
      }),
    );

    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
        if (!this.verifyEditor()) {
          return;
        }
        this.onPositionChanged(e);
      }),
    );

    this.disposer.addDispose(
      this.editor.monacoEditor.onContextMenu((e: monaco.editor.IEditorMouseEvent) => {
        e.event.preventDefault();
        e.event.stopPropagation();
        return false;
      }),
    );

    this.disposer.addDispose(
      this.editor.monacoEditor.onDidChangeConfiguration(() => {
        if (!this.editor.monacoEditor.getOption(monaco.editor.EditorOption.glyphMargin)) {
          this.hide();
        }
      }),
    );

    this.disposer.addDispose(
      Disposable.create(() => {
        this.hide();
        this.menuRegistry.unregisterMenuId(MenuId.SettingJSONGlyphMarginContext);
      }),
    );

    this.disposer.addDispose(
      this.commandRegistry.registerCommand(SettingJSONGlyphMarginEdit, {
        execute: (key: string, value: string | boolean) => {
          if (key && value) {
            if (value === 'true') {
              value = true;
            }
            if (value === 'false') {
              value = false;
            }
            this.preferenceSettingsService.setPreference(key, value, PreferenceScope.User);
          }
        },
      }),
    );

    return this.disposer;
  }

  private get preferences(): string[] {
    return this._preferences;
  }

  private get currentLine(): number {
    return this._currentLine;
  }

  private show(line: number, hoverMessage: string, preferences: string[]): void {
    this._preferences = preferences;
    const newDecoration: IModelDeltaDecoration[] = [];
    newDecoration.push({
      options: {
        description: 'edit-preference-widget-decoration',
        glyphMarginClassName: getIcon('edit') + ' setting-edit-glyph',
        glyphMarginHoverMessage: new MarkdownString().appendText(hoverMessage),
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
      range: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 1,
      },
    });
    this._editPreferenceDecoration.set(newDecoration);
  }

  private hide(): void {
    this._editPreferenceDecoration.clear();
  }

  private isVisible(): boolean {
    return this._editPreferenceDecoration.length > 0;
  }

  private async getPreferencesKeyAtLineNumber(lineNumber: number): Promise<string[]> {
    const reg = new RegExp(/\"((?!,).)*\"+((\s+?)?)\:/g);
    const settingUri = await this.getPreferenceUrl();
    if (!settingUri) {
      return [];
    }

    const ref = await this.getDocumentModelRef(settingUri);
    const monaco = ref.instance.getMonacoModel();
    const content = monaco.getLineContent(lineNumber);

    ref.dispose();

    // 提取配置项（同一行可能存在多个）
    const match = content.match(reg) || [];
    const keys = match.map((m) => {
      const e = /\"(.*?)\"/g.exec(m);
      return (e && e[1]) || '';
    });

    const properties = this.preferenceSchemaProvider.getCombinedSchema().properties;

    // 筛选出 type 为 boolean 类型或含有 enum 字段这两种情况
    return keys.filter((k) => {
      const schema = properties[k];
      if (schema) {
        return schema.type === 'boolean' || schema.enum;
      }
      return false;
    });
  }

  private async onPositionChanged(positionChangeEvent: monaco.editor.ICursorPositionChangedEvent) {
    this.hide();
    const {
      position: { lineNumber },
    } = positionChangeEvent;
    this._currentLine = lineNumber;
    const preferenceKeys = await this.getPreferencesKeyAtLineNumber(lineNumber);

    if (preferenceKeys.length > 0) {
      if (
        this.editor.monacoEditor.getOption(monaco.editor.EditorOption.glyphMargin) &&
        this.marginFreeFromOtherDecorations(lineNumber)
      ) {
        this.show(lineNumber, localize('editTtile'), preferenceKeys);
      }
    } else {
      this.hide();
    }
  }

  private marginFreeFromOtherDecorations(line: number): boolean {
    const decorations = this.editor.monacoEditor.getLineDecorations(line);
    if (decorations) {
      for (const { options } of decorations) {
        if (options.glyphMarginClassName && options.glyphMarginClassName.indexOf(getIcon('edit')) === -1) {
          return false;
        }
      }
    }
    return true;
  }

  private async registerMenuItems(preferences: string[]): Promise<void> {
    if (preferences.length === 1) {
      const menus = this.getActions(preferences[0]);
      this.disposer.addDispose(
        this.menuRegistry.registerMenuItems(
          MenuId.SettingJSONGlyphMarginContext,
          menus.map((m) => ({
            command: {
              id: SettingJSONGlyphMarginEdit.id,
              label: m,
            },
            group: 'navigation',
            extraTailArgs: [preferences[0], m],
          })),
        ),
      );
    } else {
      // 表示同一行存在多个不同配置项，每一个配置项当作 subMenus 来渲染
      preferences.forEach((key) => {
        const sub = `${MenuId.SubSettingJSONGlyphMarginContext}_${key}`;

        this.disposer.addDispose(
          this.menuRegistry.registerMenuItem(MenuId.SettingJSONGlyphMarginContext, {
            submenu: sub,
            label: key,
            group: 'navigation',
          }),
        );

        const menus = this.getActions(key);

        this.disposer.addDispose(
          this.menuRegistry.registerMenuItems(
            sub,
            menus.map((m) => ({
              command: {
                id: SettingJSONGlyphMarginEdit.id,
                label: m,
              },
              group: 'navigation',
              extraTailArgs: [key, m],
            })),
          ),
        );
      });
    }
  }

  private getActions(key: string): string[] {
    const properties = this.preferenceSchemaProvider.getCombinedSchema().properties;
    const schema = properties[key];
    if (schema.type === 'boolean') {
      return ['true', 'false'];
    }
    if (schema.enum) {
      return schema.enum.map((value) => value.toString());
    }
    return [];
  }

  private showContextMenu(e: monaco.editor.IEditorMouseEvent) {
    e.event.preventDefault();
    e.event.stopPropagation();

    const menus = this.menuService.createMenu({
      id: MenuId.SettingJSONGlyphMarginContext,
      config: {
        separator: 'inline',
      },
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    setTimeout(() => {
      this.ctxMenuRenderer.show({
        anchor: e.event.browserEvent,
        menuNodes,
        onHide: () => {
          const preMenus = (context: MenuId | string, type: 'menu' | 'sub' = 'menu') =>
            this.menuRegistry
              .getMenuItems(context)
              .map((e) =>
                type === 'sub' ? (e as ISubmenuItem).submenu : ((e as IMenuItem).command as MenuCommandDesc),
              )
              .filter(Boolean);

          preMenus(MenuId.SettingJSONGlyphMarginContext, 'sub').forEach((sub: string) => {
            this.menuRegistry.unregisterMenuItem(MenuId.SettingJSONGlyphMarginContext, sub);

            preMenus(sub).forEach((s: MenuCommandDesc) => {
              this.menuRegistry.unregisterMenuItem(sub, s.id);
            });
          });

          preMenus(MenuId.SettingJSONGlyphMarginContext).forEach((c: MenuCommandDesc) => {
            this.menuRegistry.unregisterMenuItem(MenuId.SettingJSONGlyphMarginContext, c.id);
          });

          this.menuRegistry.unregisterMenuItem(
            MenuId.SettingJSONGlyphMarginContext,
            MenuId.SubSettingJSONGlyphMarginContext,
          );
        },
      });
    }, 10);
  }
}
