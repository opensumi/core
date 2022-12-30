import React from 'react';

import { TreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { URI } from '@opensumi/ide-core-common';

import { ICommentAuthorInformation, ICommentsService, ICommentsThread } from '../../common/index';

export class CommentRoot extends CompositeTreeNode {
  static is(node: CommentFileNode | CommentRoot): node is CommentRoot {
    return !!node && !node.parent;
  }

  constructor(tree: ICommentsService) {
    super(tree as ITree, undefined);
  }

  get expanded() {
    return true;
  }
}

export class CommentFileNode extends CompositeTreeNode {
  public static is(node: any): node is CommentFileNode {
    return CompositeTreeNode.is(node) && 'threads' in node;
  }

  private _renderedLabel: string | React.ReactNode;
  private _renderedDescription: string | React.ReactNode;

  private _onSelectHandler: (node?: CommentFileNode) => void;

  constructor(
    tree: ICommentsService,
    public threads: ICommentsThread[],
    description = '',
    public tooltip: string,
    public icon: string,
    public resource: URI,
    parent: CommentRoot,
  ) {
    super(tree as ITree, parent);
    this.isExpanded = true;
    this._renderedLabel = this.resource.displayName;
    this._renderedDescription = description;
  }

  set label(value: any) {
    this._renderedLabel = value as string | React.ReactNode;
  }

  set description(value: any) {
    this._renderedDescription = value as string | React.ReactNode;
  }

  get renderedLabel() {
    return this._renderedLabel;
  }

  get renderedDescription() {
    return this._renderedDescription;
  }

  set onSelect(handler: (node?: CommentFileNode) => void) {
    this._onSelectHandler = handler;
  }

  get onSelect() {
    return this._onSelectHandler;
  }
}

export class CommentContentNode extends CompositeTreeNode {
  public static is(node: any): node is CommentContentNode {
    return CompositeTreeNode.is(node) && 'author' in node;
  }

  private _renderedLabel: string | React.ReactNode;
  private _renderedDescription: string | React.ReactNode;

  private _onSelectHandler: (node?: CommentContentNode) => void;

  constructor(
    tree: ICommentsService,
    public thread: ICommentsThread,
    public comment: string,
    description = '',
    public icon: string,
    public author: ICommentAuthorInformation,
    public resource: URI,
    parent: CommentFileNode | undefined,
  ) {
    super(tree as ITree, parent);
    this._renderedDescription = description;
  }

  get expanded() {
    return true;
  }

  set label(value: string | React.ReactNode) {
    this._renderedLabel = value;
  }

  set description(value: string | React.ReactNode) {
    this._renderedDescription = value;
  }

  get renderedLabel() {
    return this._renderedLabel;
  }

  get renderedDescription() {
    return this._renderedDescription;
  }

  set onSelect(handler: (node?: CommentContentNode) => void) {
    this._onSelectHandler = handler;
  }

  get onSelect() {
    return this._onSelectHandler;
  }
}

export class CommentReplyNode extends TreeNode {
  private _renderedLabel: string | React.ReactNode;
  private _renderedDescription: string | React.ReactNode;
  private _onSelectHandler: (node?: CommentReplyNode) => void;

  constructor(
    tree: ICommentsService,
    public thread: ICommentsThread,
    label: string,
    description = '',
    public icon: string,
    public resource: URI,
    parent: CommentContentNode | undefined,
  ) {
    super(tree as ITree, parent);
    this._renderedLabel = label;
    this._renderedDescription = description;
  }

  set label(value: any) {
    this._renderedLabel = value as string | React.ReactNode;
  }

  set description(value: any) {
    this._renderedDescription = value as string | React.ReactNode;
  }

  get renderedLabel() {
    return this._renderedLabel;
  }

  get renderedDescription() {
    return this._renderedDescription;
  }

  set onSelect(handler: (node?: CommentReplyNode) => void) {
    this._onSelectHandler = handler;
  }

  get onSelect() {
    return this._onSelectHandler;
  }
}
