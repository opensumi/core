import cls from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom';

import { TreeNode, ITree, CompositeTreeNode } from '@opensumi/ide-components';
import { MessageType } from '@opensumi/ide-core-browser';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { LinkDetector } from '../debug-link-detector';
import debugConsoleStyles from '../view/console/debug-console.module.less';


const getColor = (severity?: MessageType): string => {
  if (typeof severity === 'undefined') {
    return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.info);
  }
  switch (severity) {
    case MessageType.Error:
      return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.error);
    case MessageType.Warning:
      return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.warn);
    case MessageType.Info:
      return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.info);
    default:
      return cls(debugConsoleStyles.variable_repl_text, debugConsoleStyles.info);
  }
};

export class TreeWithLinkWrapper extends React.Component<{ html: HTMLElement; className?: string }> {
  componentDidMount() {
    const container = ReactDOM.findDOMNode(this);
    container!.appendChild(this.props.html);
  }

  render() {
    return <code className={this.props.className}></code>;
  }
}

export class AnsiConsoleNode extends TreeNode {
  public get parent(): CompositeTreeNode {
    return this._compositeTreeNode;
  }
  static is(node?: TreeNode): node is AnsiConsoleNode {
    return !!node && !!(node as AnsiConsoleNode).template;
  }

  private linkDetectorHTML: HTMLElement;

  constructor(
    public readonly description: string,
    // 该节点默认只存在于根节点下
    private readonly _compositeTreeNode: CompositeTreeNode,
    public readonly linkDetector: LinkDetector,
    private readonly ansiNode?: HTMLSpanElement,
    public readonly severity?: MessageType,
    public readonly source?: DebugProtocol.Source,
    public readonly line?: string | number,
  ) {
    super({} as ITree, _compositeTreeNode);
    this.linkDetectorHTML = this.ansiNode ?? this.linkDetector.linkify(this.description);
  }

  get name() {
    return `log_${this.id}`;
  }

  get el(): HTMLElement {
    return this.linkDetectorHTML;
  }

  get template(): any {
    return () => <TreeWithLinkWrapper className={getColor(this.severity)} html={this.linkDetectorHTML} />;
  }
}
