import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';

import { MCPServerProxyService } from '../../mcp-server-proxy.service';

import styles from './mcp-config.module.less';

export const MCPConfigView: React.FC = () => {
  const mcpServerProxyService = useInjectable<MCPServerProxyService>(MCPServerProxyService);
  const [tools, setTools] = React.useState<any[]>([]);

  React.useEffect(() => {
    const loadTools = async () => {
      const allTools = await mcpServerProxyService.getAllMCPTools();
      setTools(allTools);
    };
    loadTools();

    const disposer = mcpServerProxyService.onChangeMCPServers(() => {
      loadTools();
    });

    return () => {
      disposer.dispose();
    };
  }, [mcpServerProxyService]);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>MCP Tools Configuration</h2>
      <div className={styles.toolsList}>
        {tools.map((tool, index) => (
          <div key={index} className={styles.toolItem}>
            <h3 className={styles.toolTitle}>{tool.name}</h3>
            <p className={styles.toolDescription}>{tool.description}</p>
            <div className={styles.toolProvider}>Provider: {tool.providerName}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
