import { DebugProtocol } from '@ali/vscode-debugprotocol/lib/debugProtocol';
import { MessageType } from '@ali/ide-core-browser';
import { TreeNode, ITree, CompositeTreeNode } from '@ali/ide-components';
import * as debugConsoleStyles from '../view/console/debug-console.module.less';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as cls from 'classnames';
import { LinkDetector } from '../debug-link-detector';

class TreeWrapper extends React.Component<{ html: HTMLElement, className: string }> {
  componentDidMount() {
    const container = ReactDOM.findDOMNode(this);
    container!.appendChild(this.props.html);
  }

  render() {
    return <code className={ this.props.className }></code>;
  }
}

export class AnsiConsoleNode extends TreeNode {
  static is(node?: TreeNode): node is AnsiConsoleNode {
    return !!node && !!(node as AnsiConsoleNode).template;
  }

  private linkDetectorHTML: HTMLElement;

  constructor(
    public readonly description: string,
    // 该节点默认只存在于根节点下
    parent: CompositeTreeNode,
    public readonly linkDetector: LinkDetector,
    public readonly severity?: MessageType,
    public readonly source?: DebugProtocol.Source,
    public readonly line?: string | number,
  ) {
    super({} as ITree, parent);
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

  get template(): any {
    return () => {
      return <TreeWrapper className={this.getColor(this.severity)} html={ this.linkDetectorHTML }/>;
    };
  }
}
