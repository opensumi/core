import { Injectable } from '@opensumi/di';

import {
  CommentsPanelOptions,
  ICommentsFeatureRegistry,
  PanelTreeNodeHandler,
  FileUploadHandler,
  MentionsOptions,
  ZoneWidgerRender,
  ICommentsConfig,
  ICommentProviderFeature,
} from '../common';

@Injectable()
export class CommentsFeatureRegistry implements ICommentsFeatureRegistry {
  private config: ICommentsConfig = {};

  private options: CommentsPanelOptions = {};

  private panelTreeNodeHandlers: PanelTreeNodeHandler[] = [];

  private fileUploadHandler: FileUploadHandler;

  private mentionsOptions: MentionsOptions = {};

  private zoneWidgetRender: ZoneWidgerRender;

  private providerFeature = new Map<string, ICommentProviderFeature>();

  registerConfig(config: ICommentsConfig): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  registerPanelTreeNodeHandler(handler: PanelTreeNodeHandler): void {
    this.panelTreeNodeHandlers.push(handler);
  }

  registerPanelOptions(options: CommentsPanelOptions): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  registerFileUploadHandler(handler: FileUploadHandler): void {
    this.fileUploadHandler = handler;
  }

  registerMentionsOptions(options: MentionsOptions): void {
    this.mentionsOptions = options;
  }

  registerZoneWidgetRender(render: ZoneWidgerRender): void {
    this.zoneWidgetRender = render;
  }

  getConfig(): ICommentsConfig {
    return this.config;
  }

  getCommentsPanelOptions(): CommentsPanelOptions {
    return this.options;
  }

  getCommentsPanelTreeNodeHandlers(): PanelTreeNodeHandler[] {
    return this.panelTreeNodeHandlers;
  }

  getFileUploadHandler() {
    return this.fileUploadHandler;
  }

  getMentionsOptions() {
    return this.mentionsOptions;
  }

  getZoneWidgetRender(): ZoneWidgerRender | undefined {
    return this.zoneWidgetRender;
  }

  registerProviderFeature(providerId: string, feature: ICommentProviderFeature): void {
    this.providerFeature.set(providerId, feature);
  }

  getProviderFeature(providerId: string): ICommentProviderFeature | undefined {
    return this.providerFeature.get(providerId);
  }
}
