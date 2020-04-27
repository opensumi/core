import { Injectable } from '@ali/common-di';
import { CommentsPanelOptions, ICommentsFeatureRegistry, PanelTreeNodeHandler, FileUploadHandler } from '../common';

@Injectable()
export class CommentsFeatureRegistry implements ICommentsFeatureRegistry {

  private options: CommentsPanelOptions = {};

  private panelTreeNodeHandlers: PanelTreeNodeHandler[] = [];

  private fileUploadHandler: FileUploadHandler;

  registerPanelTreeNodeHandler(handler: PanelTreeNodeHandler): void {
    this.panelTreeNodeHandlers.push(handler);
  }

  registerPanelOptions(options: CommentsPanelOptions): void {
    this.options = {
      ...this.options,
      ... options,
    };
  }

  getCommentsPanelOptions(): CommentsPanelOptions {
    return this.options;
  }

  getCommentsPanelTreeNodeHandlers(): PanelTreeNodeHandler[] {
    return this.panelTreeNodeHandlers;
  }

  registerFileUploadHandler(handler: FileUploadHandler): void {
    this.fileUploadHandler = handler;
  }

  getFileUploadHandler() {
    return this.fileUploadHandler;
  }
}
