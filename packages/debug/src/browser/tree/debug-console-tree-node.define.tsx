import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';
import { MessageType } from '@opensumi/ide-core-browser';
import { TreeNode, ITree, CompositeTreeNode } from '@opensumi/ide-components';
import debugConsoleStyles from '../view/console/debug-console.module.less';
import React from 'react';
import ReactDOM from 'react-dom';
import cls from 'classnames';
import { LinkDetector } from '../debug-link-detector';

export class TreeWithLinkWrapper extends React.Component<{ html: HTMLElement, className?: string }> {
  componentDidMount() {
    const container = ReactDOM.findDOMNode(this);
    container!.appendChild(this.props.html);
  }

  render() {
    return <code className={ this.props.className }></code>;
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
    public readonly severity?: MessageType,
    public readonly source?: DebugProtocol.Source,
    public readonly line?: string | number,
  ) {
    super({} as ITree, _compositeTreeNode);
    this.linkDetectorHTML = this.linkDetector.linkify(this.description);
  }

  get name() {
    return `log_${this.id}`;
  }

  getColor(severity?: MessageType): string {
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
  }

  get el(): HTMLElement {
    return this.linkDetectorHTML;
  }

  get template(): any {
    return () => {
      return <TreeWithLinkWrapper className={this.getColor(this.severity)} html={ this.linkDetectorHTML }/>;
    };
  }
}
