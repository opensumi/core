import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Disposable, Emitter, Event, LinkedText, parseLinkedText, URI } from '@opensumi/ide-core-browser';
import { ILogger } from '@opensumi/ide-core-common';
import { dirname } from '@opensumi/ide-utils/lib/path';
import { ContextKeyExpr } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import { IWalkthrough, IWalkthroughStep } from '../common';
import { IExtensionContributions } from '../common/vscode';

import { AbstractExtInstanceManagementService } from './types';

const parseDescription = (desc: string): LinkedText[] =>
  desc
    .split('\n')
    .filter((x) => x)
    .map((text) => parseLinkedText(text));

@Injectable({ multiple: false })
export class WalkthroughsService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private readonly _onDidOpenWalkthrough = new Emitter<string>();
  readonly onDidOpenWalkthrough: Event<string> = this._onDidOpenWalkthrough.event;
  private readonly _onDidAddWalkthrough = new Emitter<IWalkthrough>();
  readonly onDidAddWalkthrough: Event<IWalkthrough> = this._onDidAddWalkthrough.event;

  private categoryVisibilityContextKeys = new Set<string>();

  private contributions = new Map<string, IWalkthrough>();
  private steps = new Map<string, IWalkthroughStep>();

  private registerDoneListeners(step: IWalkthroughStep) {
    // not implement
  }

  private registerWalkthrough(descriptor: IWalkthrough): void {
    const pre = this.contributions.get(descriptor.id);
    if (pre) {
      return;
    }

    this.contributions.set(descriptor.id, descriptor);

    descriptor.steps.forEach((step) => {
      if (this.steps.has(step.id)) {
        throw Error('Attempting to register step with id ' + step.id + ' twice. Second is dropped.');
      }
      this.steps.set(step.id, step);
      step.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
      this.registerDoneListeners(step);
    });

    descriptor.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
  }

  public openWalkthroughEditor(id: string): void {
    this._onDidOpenWalkthrough.fire(id);
  }

  public getWalkthrough(id: string): IWalkthrough | undefined {
    return this.contributions.get(id);
  }

  public getWalkthroughs(): IWalkthrough[] {
    return Array.from(this.contributions.values());
  }

  public registerExtensionWalkthroughContributions(
    extensionId: string,
    walkthrough: Exclude<IExtensionContributions['walkthroughs'], undefined>[number],
  ): void {
    const extensionDescriptor = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
    if (!extensionDescriptor) {
      return;
    }

    const convertFileURI = (path: string) =>
      path.startsWith('https://') ? URI.parse(path) : URI.from(extensionDescriptor.uri!).resolve(path);

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
          this.logger.error('media 字段必填: ' + walkthrough.id + '@' + step.id);
          return;
        }

        if (!(step.media.markdown || step.media.svg || step.media.image)) {
          this.logger.error('未知的格式: ' + extensionId + '#' + walkthrough.id + '#' + step.id);
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
            root: URI.from(extensionDescriptor.uri!),
          };
        } else if (step.media.svg) {
          media = {
            type: 'svg',
            path: convertFileURI(step.media.svg),
            altText: step.media.svg,
          };
        }

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
        path: walkthrough.icon || '',
      },
      when: ContextKeyExpr.deserialize(walkthrough.when) ?? ContextKeyExpr.true(),
    } as const;

    this.registerWalkthrough(walkthoughDescriptor);

    this._onDidAddWalkthrough.fire(walkthoughDescriptor);
  }
}
