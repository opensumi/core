import React = require('react');

import { Injectable, Autowired } from '@opensumi/di';
import { useInjectable, IEventBus } from '@opensumi/ide-core-browser';
import { CancellationTokenSource, Disposable, ILogger } from '@opensumi/ide-core-common';
import { EditorComponentRegistry, ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';
import { IWebviewService } from '@opensumi/ide-webview';
import { WebviewMounter } from '@opensumi/ide-webview/lib/browser/editor-webview';

import { VSCodeContributePoint, Contributes, ExtensionService } from '../../../common';
import { ICustomEditorOptions, CUSTOM_EDITOR_SCHEME } from '../../../common/vscode';
import {
  CustomEditorScheme,
  CustomEditorShouldDisplayEvent,
  CustomEditorShouldHideEvent,
  CustomEditorOptionChangeEvent,
  CustomEditorShouldSaveEvent,
  CustomEditorShouldRevertEvent,
  CustomEditorShouldEditEvent,
} from '../../../common/vscode/custom-editor';
import { match } from '../../../common/vscode/glob';
import { IActivationEventService } from '../../types';

@Injectable()
@Contributes('customEditors')
export class CustomEditorContributionPoint extends VSCodeContributePoint<CustomEditorScheme[]> {
  @Autowired(EditorComponentRegistry)
  private editorComponentRegistry: EditorComponentRegistry;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private options = new Map<string, ICustomEditorOptions>();

  contribute() {
    const customEditors = this.json || [];
    customEditors.forEach((c) => {
      this.registerSingleCustomEditor(c);
    });
    this.addDispose(
      this.eventBus.on(CustomEditorOptionChangeEvent, (e) => {
        if (this.options.has(e.payload.viewType)) {
          this.options.set(e.payload.viewType, e.payload.options);
        }
      }),
    );
  }

  getOptions(viewType: string) {
    return this.options.get(viewType) || {};
  }

  private registerSingleCustomEditor(customEditor: CustomEditorScheme) {
    try {
      const viewType = customEditor.viewType;
      this.options.set(customEditor.viewType, {});
      const componentId = `${CUSTOM_EDITOR_SCHEME}-${customEditor.viewType}`;
      const component = createCustomEditorComponent(customEditor.viewType, componentId, () =>
        this.getOptions(customEditor.viewType),
      );
      this.addDispose(
        this.editorComponentRegistry.registerEditorComponent({
          uid: componentId,
          component,
        }),
      );

      const patterns = customEditor.selector.map((s) => s.filenamePattern).filter((p) => typeof p === 'string');

      if (patterns.length === 0) {
        return;
      }
      const priority: 'default' | 'option' = customEditor.priority || 'default';
      this.addDispose(
        this.editorComponentRegistry.registerEditorComponentResolver(
          () => 10,
          (resource, results) => {
            for (const pattern of patterns) {
              if (
                match(pattern, resource.uri.path.toString().toLowerCase()) ||
                match(pattern, resource.uri.path.base.toLowerCase())
              ) {
                results.push({
                  componentId,
                  type: 'component',
                  title: customEditor.displayName
                    ? this.getLocalizeFromNlsJSON(customEditor.displayName)
                    : customEditor.viewType,
                  weight: priority === 'default' ? Number.MAX_SAFE_INTEGER : 0,
                  saveResource: (resource) =>
                    this.eventBus.fireAndAwait(
                      new CustomEditorShouldSaveEvent({
                        uri: resource.uri,
                        viewType,
                        cancellationToken: new CancellationTokenSource().token,
                      }),
                    ),
                  revertResource: (resource) =>
                    this.eventBus.fireAndAwait(
                      new CustomEditorShouldRevertEvent({
                        uri: resource.uri,
                        viewType,
                        cancellationToken: new CancellationTokenSource().token,
                      }),
                    ),
                  undo: (resource) =>
                    this.eventBus.fireAndAwait(
                      new CustomEditorShouldEditEvent({
                        uri: resource.uri,
                        viewType,
                        type: 'undo',
                      }),
                    ),
                  redo: (resource) =>
                    this.eventBus.fireAndAwait(
                      new CustomEditorShouldEditEvent({
                        uri: resource.uri,
                        viewType,
                        type: 'redo',
                      }),
                    ),
                });
              }
            }
          },
        ),
      );
    } catch (e) {
      this.logger.error(e);
    }
  }
}

export function createCustomEditorComponent(
  viewType: string,
  openTypeId: string,
  getOptions: () => ICustomEditorOptions,
): ReactEditorComponent<any> {
  return ({ resource }) => {
    const activationEventService: IActivationEventService = useInjectable(IActivationEventService);
    const webviewService: IWebviewService = useInjectable(IWebviewService);
    const eventBus: IEventBus = useInjectable(IEventBus);
    const extensionService: ExtensionService = useInjectable(ExtensionService);
    let container: HTMLDivElement | null = null;

    React.useEffect(() => {
      const cancellationTokenSource = new CancellationTokenSource();
      const disposer = new Disposable();
      // 此处需要等待 activationEvents 为 * 的插件启动完成，因为有些插件是这样实现的 (比如 vscode-office)
      Promise.all([
        activationEventService.fireEvent('onCustomEditor', viewType),
        extensionService.eagerExtensionsActivated.promise,
      ]).then(() => {
        if (cancellationTokenSource.token.isCancellationRequested) {
          return;
        }
        const webview = webviewService.createWebview(getOptions().webviewOptions);
        if (webview && container) {
          const mounter = new WebviewMounter(
            webview,
            container,
            document.getElementById('workbench-editor')!,
            document.getElementById('workbench-editor')!,
          );
          webview.onRemove(() => {
            mounter.dispose();
          });
          disposer.addDispose({
            dispose: () => {
              webview.remove();
              webview.dispose();
              eventBus.fire(
                new CustomEditorShouldHideEvent({
                  uri: resource.uri,
                  viewType,
                }),
              );
            },
          });
          eventBus.fire(
            new CustomEditorShouldDisplayEvent({
              uri: resource.uri,
              viewType,
              webviewPanelId: webview.id,
              cancellationToken: cancellationTokenSource.token,
              openTypeId,
            }),
          );
        }
      });

      return () => {
        disposer.dispose();
        cancellationTokenSource.cancel();
      };
    }, []);

    return (
      <div
        style={{ height: '100%', width: '100%', position: 'relative' }}
        className='editor-webview-webview-component'
        ref={(el) => (container = el)}
      ></div>
    );
  };
}
