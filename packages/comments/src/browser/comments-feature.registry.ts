import { Injectable } from '@ali/common-di';
import { CommentsPanelOptions, ICommentsFeatureRegistry, PanelTreeNodeHandler, FileUploadHandler, MentionsOptions } from '../common';

@Injectable()
export class CommentsFeatureRegistry implements ICommentsFeatureRegistry {

  private options: CommentsPanelOptions = {};

  private panelTreeNodeHandlers: PanelTreeNodeHandler[] = [];

  private fileUploadHandler: FileUploadHandler;

  private mentionsOptions: MentionsOptions = {};

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
}
