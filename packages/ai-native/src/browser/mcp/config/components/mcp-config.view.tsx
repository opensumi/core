import cls from 'classnames';
import React, { useCallback } from 'react';

import { Badge, Button, Popover, PopoverTriggerType } from '@opensumi/ide-components';
import { AINativeSettingSectionsId, ILogger, useInjectable } from '@opensumi/ide-core-browser';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences';
import { PreferenceScope, localize } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import { BUILTIN_MCP_SERVER_NAME, ISumiMCPServerBackend, SumiMCPServerProxyServicePath } from '../../../../common';
import { MCPServerDescription } from '../../../../common/mcp-server-manager';
import { MCPServer, MCP_SERVER_TYPE } from '../../../../common/types';
import { MCPServerProxyService } from '../../mcp-server-proxy.service';

import styles from './mcp-config.module.less';
import { MCPServerForm, MCPServerFormData } from './mcp-server-form';

export const MCPConfigView: React.FC = () => {
  const mcpServerProxyService = useInjectable<MCPServerProxyService>(MCPServerProxyService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const sumiMCPServerBackendProxy = useInjectable<ISumiMCPServerBackend>(SumiMCPServerProxyServicePath);
  const logger = useInjectable<ILogger>(ILogger);
  const [servers, setServers] = React.useState<MCPServer[]>([]);
  const [formVisible, setFormVisible] = React.useState(false);
  const [editingServer, setEditingServer] = React.useState<MCPServerFormData | undefined>();
  const [loadingServer, setLoadingServer] = React.useState<string | undefined>();
  const loadServers = useCallback(async () => {
    const userServers = preferenceService.get<MCPServerDescription[]>(AINativeSettingSectionsId.MCPServers, []);
    const runningServers = await mcpServerProxyService.$getServers();
    const builtinServer = runningServers.find((server) => server.name === BUILTIN_MCP_SERVER_NAME);
    const allServers = userServers.map((server) => {
      const runningServer = runningServers.find((s) => s.name === server.name);
      return {
        ...server,
        name: server.name,
        isStarted: !!runningServer,
        tools: runningServer?.tools,
      };
    });
    allServers.unshift(builtinServer as any);
    setServers(allServers);
  }, [mcpServerProxyService]);

  React.useEffect(() => {
    loadServers();
    const disposer = mcpServerProxyService.onChangeMCPServers(() => {
      loadServers();
    });

    return () => {
      disposer.dispose();
    };
  }, []);

  const handleServerControl = useCallback(
    async (serverName: string, start: boolean) => {
      try {
        setLoadingServer(serverName);
        if (start) {
          await mcpServerProxyService.$startServer(serverName);
        } else {
          await mcpServerProxyService.$stopServer(serverName);
        }

        // Update enabled state in preferences
        const servers = preferenceService.get<MCPServerDescription[]>(AINativeSettingSectionsId.MCPServers, []);
        let updatedServers = servers;
        // 处理内置服务器的特殊情况
        if (serverName === BUILTIN_MCP_SERVER_NAME) {
          const builtinServerExists = servers.some((server) => server.name === BUILTIN_MCP_SERVER_NAME);
          if (!builtinServerExists && !start) {
            // 如果是停止内置服务器且之前没有配置，添加一个新的配置项
            // 内置服务器不需要 command，因为它是直接集成在 IDE 中的
            updatedServers = [
              ...servers,
              {
                name: BUILTIN_MCP_SERVER_NAME,
                enabled: false,
                command: '', // 内置服务器的 command 为空字符串
                type: MCP_SERVER_TYPE.STDIO,
              },
            ];
          } else {
            // 如果已经存在配置，更新 enabled 状态
            updatedServers = servers.map((server) => {
              if (server.name === BUILTIN_MCP_SERVER_NAME) {
                return { ...server, enabled: start };
              }
              return server;
            });
          }
        } else {
          // 处理其他外部服务器
          updatedServers = servers.map((server) => {
            if (server.name === serverName) {
              return { ...server, enabled: start };
            }
            return server;
          });
        }

        await preferenceService.set(AINativeSettingSectionsId.MCPServers, updatedServers, PreferenceScope.User);
        await loadServers();
        setLoadingServer(undefined);
      } catch (error) {
        const msg = error.message || error;
        logger.error(`Failed to ${start ? 'start' : 'stop'} server ${serverName}:`, error);
        messageService.error(error.message);
        setLoadingServer(undefined);
      }
    },
    [mcpServerProxyService, preferenceService, sumiMCPServerBackendProxy, loadServers],
  );

  const handleAddServer = useCallback(() => {
    setEditingServer(undefined);
    setFormVisible(true);
  }, [editingServer, formVisible]);

  const handleEditServer = useCallback(
    (server: MCPServer) => {
      const servers = preferenceService.get<MCPServerFormData[]>(AINativeSettingSectionsId.MCPServers, []);
      const serverConfig = servers.find((s) => s.name === server.name);

      if (serverConfig) {
        setEditingServer(serverConfig);
        setFormVisible(true);
      }
    },
    [editingServer, formVisible],
  );

  const handleDeleteServer = useCallback(
    async (serverName: string) => {
      const servers = preferenceService.get<MCPServerFormData[]>(AINativeSettingSectionsId.MCPServers, []);
      const updatedServers = servers.filter((s) => s.name !== serverName);
      sumiMCPServerBackendProxy.removeServer(serverName);
      await preferenceService.set(AINativeSettingSectionsId.MCPServers, updatedServers, PreferenceScope.User);
      await loadServers();
    },
    [editingServer, formVisible],
  );

  const handleSaveServer = useCallback(
    async (data: MCPServerFormData) => {
      const servers = preferenceService.get<MCPServerFormData[]>(AINativeSettingSectionsId.MCPServers, []);
      const existingIndex = servers.findIndex((s) => s.name === data.name);

      if (existingIndex >= 0) {
        servers[existingIndex] = data;
      } else {
        servers.push(data);
      }
      setServers(servers as MCPServer[]);
      setFormVisible(false);
      await sumiMCPServerBackendProxy.addOrUpdateServer(data as MCPServerDescription);
      await preferenceService.set(AINativeSettingSectionsId.MCPServers, servers, PreferenceScope.User);
      await loadServers();
    },
    [servers, formVisible, loadServers],
  );

  const getReadableServerType = useCallback((type: string) => {
    switch (type) {
      case MCP_SERVER_TYPE.STDIO:
        return localize('ai.native.mcp.type.stdio');
      case MCP_SERVER_TYPE.SSE:
        return localize('ai.native.mcp.type.sse');
      case MCP_SERVER_TYPE.BUILTIN:
        return localize('ai.native.mcp.type.builtin');
      default:
        return type;
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>MCP Servers</h2>
          <p className={styles.description}>{localize('ai.native.mcp.manage.connections')}</p>
        </div>
        <button className={styles.addButton} onClick={handleAddServer}>
          + {localize('ai.native.mcp.addMCPServer.title')}
        </button>
      </div>
      <div className={styles.serversList}>
        {servers.map((server) => (
          <div key={server.name} className={styles.serverItem}>
            <div className={styles.serverHeader}>
              <div className={styles.serverTitleRow}>
                <h3 className={styles.serverName}>
                  {server.name}
                  <span
                    className={cls(styles.serverStatusIcon, server.isStarted ? styles.active : styles.inactive)}
                  ></span>
                </h3>
              </div>
              <div className={styles.serverActions}>
                <Popover
                  id='mcp-server-action-popover'
                  trigger={PopoverTriggerType.hover}
                  content={
                    server.isStarted ? localize('ai.native.mcp.disable.title') : localize('ai.native.mcp.enable.title')
                  }
                >
                  <Button
                    type='default'
                    className={cls(styles.serverActionButton, server.isStarted && styles.active)}
                    onClick={() => handleServerControl(server.name, !server.isStarted)}
                  >
                    <i
                      className={`codicon ${
                        loadingServer === server.name
                          ? 'codicon-loading kt-icon-loading'
                          : server.isStarted
                          ? 'codicon-check'
                          : 'codicon-circle'
                      }`}
                    />
                    <span>{localize(server.isStarted ? 'ai.native.mcp.enabled' : 'ai.native.mcp.disabled')}</span>
                  </Button>
                </Popover>
                {server.name !== BUILTIN_MCP_SERVER_NAME && (
                  <Button
                    type='icon'
                    iconClass='codicon codicon-edit'
                    className={styles.iconButton}
                    title='Edit'
                    onClick={() => handleEditServer(server)}
                  />
                )}

                {server.name !== BUILTIN_MCP_SERVER_NAME && (
                  <Button
                    type='icon'
                    iconClass='codicon codicon-trash'
                    className={styles.iconButton}
                    title='Delete'
                    onClick={() => handleDeleteServer(server.name)}
                  />
                )}
              </div>
            </div>
            <div className={styles.serverDetail}>
              {server.type && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Type:</span>
                  <Badge className={cls(styles.serverType, styles.typeTag)}>{getReadableServerType(server.type)}</Badge>
                </div>
              )}
            </div>
            {server.tools && server.tools.length > 0 && (
              <div className={styles.serverDetail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Tools:</span>
                  <span className={styles.detailContent}>
                    {server.tools.map((tool, index) => (
                      <Badge key={index} className={styles.toolTag} title={tool.description}>
                        {tool.name}
                      </Badge>
                    ))}
                  </span>
                </div>
              </div>
            )}
            {server.command && (
              <div className={styles.serverDetail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Command:</span>
                  <span className={styles.detailContent}>{server.command}</span>
                </div>
              </div>
            )}
            {server.serverHost && (
              <div className={styles.serverDetail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Server Link:</span>
                  <span className={cls(styles.detailContent, styles.link)}>{server.serverHost}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <MCPServerForm
        visible={formVisible}
        initialData={editingServer}
        servers={servers}
        onSave={handleSaveServer}
        onCancel={() => setFormVisible(false)}
      />
    </div>
  );
};
