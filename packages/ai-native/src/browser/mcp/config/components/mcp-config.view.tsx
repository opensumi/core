import cls from 'classnames';
import React, { useCallback } from 'react';

import { Badge, Button, Icon, Popover, PopoverTriggerType } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { MCPConfigServiceToken, localize } from '@opensumi/ide-core-common';

import { BUILTIN_MCP_SERVER_NAME } from '../../../../common';
import { MCPServer } from '../../../../common/types';
import { MCPConfigService } from '../mcp-config.service';

import styles from './mcp-config.module.less';
import { MCPServerForm, MCPServerFormData } from './mcp-server-form';

export const MCPConfigView: React.FC = () => {
  const mcpConfigService = useInjectable<MCPConfigService>(MCPConfigServiceToken);
  const [servers, setServers] = React.useState<MCPServer[]>([]);
  const [formVisible, setFormVisible] = React.useState(false);
  const [editingServer, setEditingServer] = React.useState<MCPServerFormData | undefined>();
  const [loadingServer, setLoadingServer] = React.useState<string | undefined>();
  const [isReady, setIsReady] = React.useState(false);

  const loadServers = useCallback(async () => {
    const allServers = await mcpConfigService.getServers();
    setServers(allServers);
  }, [mcpConfigService]);

  React.useEffect(() => {
    loadServers();
    const disposer = mcpConfigService.onMCPServersChange((isReady) => {
      if (isReady) {
        setIsReady(true);
      }
      loadServers();
    });

    return () => {
      disposer.dispose();
    };
  }, [loadServers]);

  const handleServerControl = useCallback(
    async (serverName: string, start: boolean) => {
      try {
        setLoadingServer(serverName);
        await mcpConfigService.controlServer(serverName, start);
        await loadServers();
        setLoadingServer(undefined);
      } catch (error) {
        setLoadingServer(undefined);
      }
    },
    [mcpConfigService, loadServers],
  );

  const handleAddServer = useCallback(() => {
    setEditingServer(undefined);
    setFormVisible(true);
  }, []);

  const handleEditServer = useCallback(
    async (server: MCPServer) => {
      const serverConfig = await mcpConfigService.getServerConfigByName(server.name);
      if (serverConfig) {
        setEditingServer(serverConfig);
        setFormVisible(true);
      }
    },
    [mcpConfigService],
  );

  const handleDeleteServer = useCallback(
    async (serverName: string) => {
      await mcpConfigService.deleteServer(serverName);
      await loadServers();
    },
    [mcpConfigService, loadServers],
  );

  const handleSaveServer = useCallback(
    async (data: MCPServerFormData) => {
      await mcpConfigService.saveServer(data);
      setFormVisible(false);
      await loadServers();
    },
    [mcpConfigService, loadServers],
  );

  const handleSyncServer = useCallback(
    async (server: MCPServer) => {
      setLoadingServer(server.name);
      await mcpConfigService.syncServer(server.name);
      await loadServers();
      setLoadingServer(undefined);
    },
    [mcpConfigService, loadServers],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>MCP Servers</h2>
          <p className={styles.description}>{localize('ai.native.mcp.manage.connections')}</p>
        </div>
        <button className={styles.actionButton} onClick={handleAddServer}>
          <Icon icon='plus' className={styles.actionButtonIcon} />
          {localize('ai.native.mcp.addMCPServer.title')}
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
                        loadingServer === server.name || (!isReady && server.name !== BUILTIN_MCP_SERVER_NAME)
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
                    title={localize('ai.native.mcp.tool.action.edit')}
                    onClick={() => handleEditServer(server)}
                  />
                )}
                {server.name !== BUILTIN_MCP_SERVER_NAME && (
                  <Button
                    type='icon'
                    iconClass='codicon codicon-sync'
                    className={styles.iconButton}
                    title={localize('ai.native.mcp.tool.action.sync')}
                    onClick={() => handleSyncServer(server)}
                  />
                )}
                {server.name !== BUILTIN_MCP_SERVER_NAME && (
                  <Button
                    type='icon'
                    iconClass='codicon codicon-trash'
                    className={styles.iconButton}
                    title={localize('ai.native.mcp.tool.action.delete')}
                    onClick={() => handleDeleteServer(server.name)}
                  />
                )}
              </div>
            </div>
            <div className={styles.serverDetail}>
              {server.type && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Type:</span>
                  <Badge className={cls(styles.serverType, styles.typeTag)}>
                    {mcpConfigService.getReadableServerType(server.type)}
                  </Badge>
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
            {server.url && (
              <div className={styles.serverDetail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Server Link:</span>
                  <span className={cls(styles.detailContent, styles.link)}>{server.url}</span>
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
