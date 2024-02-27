import { Autowired, Injectable } from '@opensumi/di';
import {
  Disposable,
  Emitter,
  Event,
  IContextKeyService,
  LinkedText,
  PreferenceService,
  URI,
  parseLinkedText,
} from '@opensumi/ide-core-browser';
import {
  BinaryBuffer,
  CommandService,
  ExtensionActivateEvent,
  FileType,
  IEventBus,
  ILogger,
} from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { dirname } from '@opensumi/ide-utils/lib/path';
import {
  ContextKeyExpr,
  ContextKeyExpression,
} from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import {
  CompletionEventsType,
  IResolvedWalkthroughStep,
  IWalkthrough,
  IWalkthroughStep,
  StepProgress,
} from '../common';
import { IExtensionContributions, IExtensionWalkthroughStep } from '../common/vscode';

import { AbstractExtInstanceManagementService } from './types';

const parseDescription = (desc: string): LinkedText[] =>
  desc
    .split('\n')
    .filter((x) => x)
    .map((text) => parseLinkedText(text));

@Injectable({ multiple: false })
export class WalkthroughsService extends Disposable {
  @Autowired(AbstractExtInstanceManagementService)
  private readonly extensionManageService: AbstractExtInstanceManagementService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IFileServiceClient)
  private readonly fileSystem: FileServiceClient;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private readonly _onDidOpenWalkthrough = new Emitter<string>();
  readonly onDidOpenWalkthrough: Event<string> = this._onDidOpenWalkthrough.event;
  private readonly _onDidAddWalkthrough = new Emitter<IWalkthrough>();
  readonly onDidAddWalkthrough: Event<IWalkthrough> = this._onDidAddWalkthrough.event;
  private readonly _onDidProgressStep = new Emitter<IResolvedWalkthroughStep>();
  readonly onDidProgressStep: Event<IResolvedWalkthroughStep> = this._onDidProgressStep.event;

  private stepProgress: Record<string, StepProgress | undefined>;

  private readonly sessionEvents = new Set<string>();
  private readonly categoryVisibilityContextKeys = new Set<string>();
  private readonly stepCompletionContextKeyExpressions = new Set<ContextKeyExpression>();
  private readonly stepCompletionContextKeys = new Set<string>();

  private readonly completionListeners = new Map<string, Set<string>>();
  private readonly contributions = new Map<string, IWalkthrough>();
  private readonly steps = new Map<string, IWalkthroughStep>();
  private readonly extensionSteps = new Map<string, IExtensionWalkthroughStep>();

  constructor() {
    super();

    this.stepProgress = {};
    this.initCompletionEventListeners();
  }

  /**
   * 注册各种 completionEvents 的监听
   * 可能来自 command 命令调用完成后发出、onView 视图切换后发出等
   */
  private initCompletionEventListeners() {
    this.addDispose(
      this.commandService.onDidExecuteCommand(({ commandId }) => {
        this.progressByEvent(`${CompletionEventsType.onCommand}:${commandId}`);
      }),
    );

    this.addDispose(
      this.contextKeyService.onDidChangeContext(({ payload }) => {
        if (payload.affectsSome(this.stepCompletionContextKeys)) {
          this.stepCompletionContextKeyExpressions.forEach((expression) => {
            if (payload.affectsSome(new Set(expression.keys())) && this.contextKeyService.match(expression)) {
              this.progressByEvent(CompletionEventsType.onContext + ':' + expression.serialize());
            }
          });
        }
      }),
    );

    this.addDispose(
      this.eventBus.on(ExtensionActivateEvent, ({ payload: { topic, data } }) => {
        if (topic === CompletionEventsType.onView) {
          this.progressByEvent(CompletionEventsType.onView + ':' + data);
        }
      }),
    );

    this.addDispose(
      this.preferenceService.onPreferenceChanged(({ preferenceName }) => {
        if (preferenceName) {
          this.progressByEvent(CompletionEventsType.onSettingChanged + ':' + preferenceName);
        }
      }),
    );
  }

  /**
   * 处理 completionEvents
   * 该事件主要用于处理当用户做了某些操作之后给当前 step 设置成 completion 的状态（也就是左边的 checkbox 打勾勾）
   */
  private registerDoneListeners(step: IWalkthroughStep) {
    if (!step.completionEvents.length) {
      step.completionEvents.push(CompletionEventsType.stepSelected);
    }

    for (let event of step.completionEvents) {
      const [_, eventType, argument] = /^([^:]*):?(.*)$/.exec(event) ?? [];

      if (!eventType) {
        this.logger.error(`Unknown completionEvent ${event} when registering step ${step.id}`);
        continue;
      }

      switch (eventType) {
        case CompletionEventsType.onLink:
        case CompletionEventsType.onEvent:
        case CompletionEventsType.onView:
        case CompletionEventsType.onSettingChanged:
          break;
        case CompletionEventsType.onContext: {
          const expression = ContextKeyExpr.deserialize(argument);
          if (expression) {
            this.stepCompletionContextKeyExpressions.add(expression);
            expression.keys().forEach((key) => this.stepCompletionContextKeys.add(key));
            event = eventType + ':' + expression.serialize();
            if (this.contextKeyService.match(expression)) {
              this.sessionEvents.add(event);
            }
          } else {
            this.logger.error(`Unable to parse context key expression: ${expression} in walkthrough step ${step.id}`);
          }
          break;
        }
        case CompletionEventsType.onStepSelected:
        case CompletionEventsType.stepSelected:
          event = CompletionEventsType.stepSelected + ':' + step.id;
          break;
        case CompletionEventsType.onCommand:
          event = eventType + ':' + argument.replace(/^toSide:/, '');
          break;
        case CompletionEventsType.onExtensionInstalled:
        case CompletionEventsType.extensionInstalled:
          event = CompletionEventsType.extensionInstalled + ':' + argument.toLowerCase();
          break;
        default:
          this.logger.error(`${event} Unknown`);
          continue;
      }

      this.registerCompletionListener(event, step);
      if (this.sessionEvents.has(event)) {
        this.progressStep(step.id);
      }
    }
  }

  private getStep(id: string): IWalkthroughStep | undefined {
    const step = this.steps.get(id);
    return step;
  }

  private registerCompletionListener(event: string, step: IWalkthroughStep) {
    if (!this.completionListeners.has(event)) {
      this.completionListeners.set(event, new Set());
    }
    this.completionListeners.get(event)?.add(step.id);
  }

  private registerWalkthrough(descriptor: IWalkthrough): void {
    const pre = this.contributions.get(descriptor.id);
    if (pre) {
      return;
    }

    this.contributions.set(descriptor.id, descriptor);

    descriptor.steps.forEach((step) => {
      if (this.steps.has(step.id)) {
        this.logger.error(`${step.id} Repeat`);
        return;
      }
      this.steps.set(step.id, step);
      step.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
      this.registerDoneListeners(step);
    });

    descriptor.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
  }

  private getStepProgress(step: IWalkthroughStep): IResolvedWalkthroughStep {
    return {
      ...step,
      done: false,
      ...this.stepProgress[step.id],
    };
  }

  public progressByEvent(event: string): void {
    if (this.sessionEvents.has(event)) {
      return;
    }

    this.sessionEvents.add(event);
    this.completionListeners.get(event)?.forEach((id) => this.progressStep(id));
  }

  public progressStep(id: string) {
    const preProgress = this.stepProgress[id];
    if (!preProgress || preProgress.done !== true) {
      this.stepProgress[id] = { done: true };
      const step = this.getStep(id);
      if (!step) {
        return;
      }

      this._onDidProgressStep.fire(this.getStepProgress(step));
    }
  }

  public openWalkthroughEditor(id: string): void {
    this.stepProgress = {};
    this._onDidOpenWalkthrough.fire(id);
  }

  public getWalkthrough(id: string): IWalkthrough | undefined {
    return this.contributions.get(id);
  }

  public getStepsByExtension(id: string): IExtensionWalkthroughStep | undefined {
    return this.extensionSteps.get(id);
  }

  public getWalkthroughs(): IWalkthrough[] {
    return Array.from(this.contributions.values());
  }

  // 直接读取插件本身的本地资源
  public async getFileContent(extensionId: string, uri: string): Promise<BinaryBuffer> {
    const empty = BinaryBuffer.alloc(0);
    const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
    if (!extension || !extension.uri) {
      return empty;
    }

    const path = URI.from(extension.uri!).resolve(uri).toString();
    const stat = await this.fileSystem.getFileStat(path);
    if (stat && stat.type === FileType.File) {
      const { content } = await this.fileSystem.readFile(path);
      return content;
    }

    return empty;
  }

  public async registerExtensionWalkthroughContributions(
    extensionId: string,
    walkthrough: Exclude<IExtensionContributions['walkthroughs'], undefined>[number],
  ): Promise<void> {
    const extensionDescriptor = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
    if (!extensionDescriptor) {
      return;
    }

    const convertFileURI = (path: string) =>
      path.startsWith('https://') ? URI.parse(path) : URI.from(extensionDescriptor.extensionLocation).resolve(path);

    const convertFileURIWithTheme = (
      path: string | { hc: string; hcLight?: string; dark: string; light: string },
    ): { hcDark: URI; hcLight: URI; dark: URI; light: URI } => {
      if (typeof path === 'string') {
        const converted = convertFileURI(path);
        return { hcDark: converted, hcLight: converted, dark: converted, light: converted };
      } else {
        return {
          hcDark: convertFileURI(path.hc),
          hcLight: convertFileURI(path.hcLight ?? path.light),
          light: convertFileURI(path.light),
          dark: convertFileURI(path.dark),
        };
      }
    };

    const categoryID = extensionId + '#' + walkthrough.id;

    const steps = (walkthrough.steps ?? [])
      .filter((step) => {
        if (!step.media) {
          this.logger.error('missing media in walkthrough step: ' + walkthrough.id + '@' + step.id);
          return;
        }

        if (!(step.media.markdown || step.media.svg || step.media.image)) {
          this.logger.error(
            'Unknown walkthrough format detected for: ' + extensionId + '#' + walkthrough.id + '#' + step.id,
          );
          return;
        }

        return step;
      })
      .map((step, index) => {
        const description = parseDescription(step.description || '');
        const fullyQualifiedID = extensionId + '#' + walkthrough.id + '#' + step.id;

        let media: IWalkthroughStep['media'];

        if (step.media.image) {
          const altText = step.media.altText;
          media = { type: 'image', altText, path: convertFileURIWithTheme(step.media.image) };
        } else if (step.media.markdown) {
          media = {
            type: 'markdown',
            path: convertFileURI(step.media.markdown),
            base: convertFileURI(dirname(step.media.markdown)),
            root: URI.from(extensionDescriptor.extensionLocation),
          };
        } else if (step.media.svg) {
          media = {
            type: 'svg',
            path: convertFileURI(step.media.svg),
            altText: step.media.svg,
          };
        }

        this.extensionSteps.set(fullyQualifiedID, step);

        return {
          description,
          media: media!,
          completionEvents: step.completionEvents?.filter((x) => typeof x === 'string') ?? [],
          id: fullyQualifiedID,
          title: step.title,
          when: ContextKeyExpr.deserialize(step.when) ?? ContextKeyExpr.true(),
          category: categoryID,
          order: index,
        };
      });

    let icon = walkthrough.icon
      ? URI.from(extensionDescriptor.extensionLocation).resolve(walkthrough.icon)
      : extensionDescriptor.icon;
    if (!icon) {
      icon = await extensionDescriptor.getDefaultIcon();
    }
    const walkthoughDescriptor: IWalkthrough = {
      description: walkthrough.description,
      title: walkthrough.title,
      id: categoryID,
      isFeatured: false,
      source: extensionId,
      order: 0,
      steps,
      icon: {
        type: 'image',
        path: icon,
      },
      when: ContextKeyExpr.deserialize(walkthrough.when) ?? ContextKeyExpr.true(),
    } as const;

    this.registerWalkthrough(walkthoughDescriptor);

    this._onDidAddWalkthrough.fire(walkthoughDescriptor);
  }
}
