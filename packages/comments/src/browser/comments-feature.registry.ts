import { Injectable } from '@ali/common-di';
import { CommentsPanelOptions, ICommentsFeatureRegistry, PanelTreeNodeHandler, FileUploadHandler, MentionsOptions, ZoneWidgerRender } from '../common';

@Injectable()
export class CommentsFeatureRegistry implements ICommentsFeatureRegistry {

  private options: CommentsPanelOptions = {};

  private panelTreeNodeHandlers: PanelTreeNodeHandler[] = [];

  private fileUploadHandler: FileUploadHandler;

  private mentionsOptions: MentionsOptions = {};

  private zoneWidgetRender: ZoneWidgerRender;

  registerPanelTreeNodeHandler(handler: PanelTreeNodeHandler): void {
    this.panelTreeNodeHandlers.push(handler);
  }

  registerPanelOptions(options: CommentsPanelOptions): void {
    this.options = {
      ...this.options,
      ... options,
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
}
