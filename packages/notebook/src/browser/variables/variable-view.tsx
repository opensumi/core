import { SearchOutlined, SelectOutlined } from '@ant-design/icons';
import {
  BaseView,
  CommandRegistry,
  ThemeService,
  ViewInstance,
  inject,
  prop,
  transient,
  useInject,
  view,
} from '@difizen/libro-common/app';
import { LibroContextKey, LibroJupyterModel, LibroView, NotebookCommands } from '@difizen/libro-jupyter/noeditor';
import { Input, List, Tag, Tooltip, message } from 'antd';
import React, { forwardRef } from 'react';
import './index.less';

import { DisposableCollection, localize } from '@opensumi/ide-core-common';

import { Languages } from './inspector-script';

import type { LanguageModel } from './inspector-script';
import type { KernelMessage } from '@difizen/libro-kernel';

const LibroVariableComponent = forwardRef<HTMLDivElement>((props, ref) => {
  const instance = useInject<LibroVariablePanelView>(ViewInstance);
  const themeService = useInject(ThemeService);
  const libroContextKey = useInject(LibroContextKey);
  return (
    <div ref={ref} className='libro-variable-content'>
      <div className='libro-variable-search'>
        <Input
          className='libro-variable-search-input'
          placeholder={localize('notebook.variable.panel.search.placeholder')}
          prefix={<SearchOutlined />}
          onChange={(e) => instance.search(e.target.value)}
          onFocus={() => {
            libroContextKey.disableCommandMode();
          }}
          onBlur={() => {
            libroContextKey.enableCommandMode();
          }}
        />
        <img
          src={`${
            themeService.getCurrentTheme().type === 'dark'
              ? 'https://mdn.alipayobjects.com/huamei_xt20ge/afts/img/A*rY0oTpYcmZsAAAAAAAAAAAAADiuUAQ/original'
              : 'https://mdn.alipayobjects.com/huamei_xt20ge/afts/img/A*VApRSqHz8wQAAAAAAAAAAAAADiuUAQ/original'
          }`}
          onClick={instance.refresh}
          className='libro-variable-search-extra'
        ></img>
      </div>
      <List
        className='libro-variable-list'
        itemLayout='horizontal'
        dataSource={instance.filteredList}
        renderItem={(item) => {
          const DesrendeItem = () => <Tooltip title={item.varContent}>{item.varContent}</Tooltip>;
          return (
            <List.Item>
              <List.Item.Meta
                title={
                  <div className='libro-variable-title'>
                    <span className='libro-variable-name'>
                      {item.varName}
                      <Tag className='libro-variable-type-tag' bordered={false}>
                        {item.varType}
                      </Tag>
                    </span>
                    <Tooltip placement='top' title={localize('notebook.variable.panel.show.detail')}>
                      <SelectOutlined onClick={() => instance.showVariable(item)} className='libro-variable-extra' />
                    </Tooltip>
                  </div>
                }
                description={<DesrendeItem />}
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
});

export interface IVariable {
  varName: string;
  varSize: string;
  varShape: string;
  varContent: string;
  varType: string;
  isMatrix: boolean;
  isWidget: boolean;
}

@transient()
@view('libro-variable-panel-view')
export class LibroVariablePanelView extends BaseView {
  @inject(CommandRegistry) commands: CommandRegistry | undefined;
  protected connectorToDispose = new DisposableCollection();
  @prop()
  list?: IVariable[];
  @prop()
  searchValue?: string;
  protected languageModel?: LanguageModel;
  protected kernelInited = false;
  view = LibroVariableComponent;
  parent?: LibroView;

  get filteredList() {
    if (!this.searchValue) {
      return this.list;
    }
    if (!this.list) {
      return undefined;
    }
    return this.list.filter((item) => {
      if (!this.searchValue) {
        return true;
      }
      return item.varName.includes(this.searchValue);
    });
  }
  showVariable = async (variable: IVariable) => {
    if (!this.parent) {
      return;
    }
    let activeIndex = this.parent.model.cells.length;
    if (this.parent.activeCell) {
      activeIndex = this.parent.findCellIndex(this.parent.activeCell) + 1;
    }
    await this.parent.addCell(
      {
        cell: {
          cell_type: 'code',
          source: variable.varName,
          metadata: {},
          outputs: [],
        },
      },
      activeIndex,
    );
    const cell = this.parent.model.cells[activeIndex];
    window.requestAnimationFrame(() => {
      this.commands?.executeCommand(NotebookCommands.RunCell.id, cell, this.parent);
    });
  };
  async update() {
    if (!this.parent) {
      return;
    }
    if (!(this.parent.model instanceof LibroJupyterModel)) {
      return;
    }
    const model = this.parent.model;
    const connection = model.kernelConnection;
    if (connection) {
      this.connectorToDispose.push(
        connection.statusChanged((status) => {
          if (status === 'dead') {
            this.kernelInited = false;
            this.list = undefined;
            this.connectorToDispose.dispose();
          }
        }),
      );
      this.connectorToDispose.push(
        connection.statusChanged((status) => {
          if (status === 'restarting') {
            this.kernelInited = false;
            this.list = undefined;
            this.setupConnector(model);
          }
        }),
      );
    }
    this.setupConnector(model);
  }

  protected async setupConnector(model: LibroJupyterModel) {
    if (!this.kernelInited) {
      model.kcReady.then(async (connection) => {
        const lang = (await connection.info).language_info.name;
        const languageModel = await Languages.getScript(lang);
        this.languageModel = languageModel;
        this.initOnKernel().then(() => {
          this.kernelInited = true;
          this.connectorToDispose.push(connection.iopubMessage(this.queryCall));
          this.performInspection();
        });
      });
    } else {
      if (model.kernelConnection) {
        this.connectorToDispose.push(model.kernelConnection.iopubMessage(this.queryCall));
        this.performInspection();
      }
    }
  }

  pause = () => {
    this.connectorToDispose.dispose();
    this.connectorToDispose = new DisposableCollection();
  };

  search = (v: string) => {
    this.searchValue = v;
  };

  /*
   * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
   */
  protected queryCall = (msg: KernelMessage.IMessage): void => {
    const msgType = msg.header.msg_type;
    switch (msgType) {
      case 'execute_input': {
        const code = (msg as KernelMessage.IExecuteInputMsg).content.code;
        if (
          !(code === this.languageModel?.queryCommand) &&
          !(code === this.languageModel?.matrixQueryCommand) &&
          !code.startsWith(this.languageModel?.widgetQueryCommand || '')
        ) {
          this.performInspection();
        }
        break;
      }
      default:
        break;
    }
  };

  public refresh = async () => {
    try {
      await this.performInspection();
      message.success(localize('notebook.variable.panel.refresh.success', 'Variable refresh successful'));
    } catch (ex) {
      message.error(localize('notebook.variable.panel.refresh.error', 'Variable refresh failed'));
    }
  };
  /**
   * Performs an inspection by sending an execute request with the query command to the kernel.
   */
  public performInspection = (): Promise<KernelMessage.IExecuteReplyMsg> => {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this.languageModel!.queryCommand,
      stop_on_error: false,
      store_history: false,
    };
    return this.fetch(content, this.handleQueryResponse);
  };

  protected handleQueryResponse = (response: KernelMessage.IIOPubMessage) => {
    const msgType = response.header.msg_type;
    switch (msgType) {
      case 'execute_result': {
        const payload = response as KernelMessage.IExecuteResultMsg;
        let content: string = payload.content.data['text/plain'] as string;
        if (content.slice(0, 1) === "'" || content.slice(0, 1) === '"') {
          content = content.slice(1, -1);
          content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
        }

        const update = JSON.parse(content) as IVariable[];
        this.list = update;
        break;
      }
      case 'display_data': {
        const payloadDisplay = response as KernelMessage.IExecuteResultMsg;
        let contentDisplay: string = payloadDisplay.content.data['text/plain'] as string;
        if (contentDisplay.slice(0, 1) === "'" || contentDisplay.slice(0, 1) === '"') {
          contentDisplay = contentDisplay.slice(1, -1);
          contentDisplay = contentDisplay.replace(/\\"/g, '"').replace(/\\'/g, "'");
        }

        const updateDisplay = JSON.parse(contentDisplay) as IVariable[];
        this.list = updateDisplay;
        break;
      }
      default:
        break;
    }
  };

  /**
   * Initializes the kernel by running the set up script located at _initScriptPath.
   */
  protected initOnKernel(): Promise<KernelMessage.IExecuteReplyMsg> {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this.languageModel!.initScript,
      stop_on_error: false,
      silent: true,
    };

    return this.fetch(content, () => {
      // no op
    });
  }

  protected fetch = async (
    content: KernelMessage.IExecuteRequestMsg['content'],
    ioCallback: (msg: KernelMessage.IIOPubMessage) => any,
  ) => {
    const model = this.parent!.model! as LibroJupyterModel;
    await model.kcReady;
    const connection = model.kernelConnection!;
    const future = connection.requestExecute(content);
    future.onIOPub = (msg) => {
      ioCallback(msg);
    };
    return future.done as Promise<KernelMessage.IExecuteReplyMsg>;
  };
}
