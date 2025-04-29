import cls from 'classnames';
import React, { ChangeEvent, FC, FormEvent, useCallback, useEffect, useState } from 'react';

import { Select } from '@opensumi/ide-components';
import { Button } from '@opensumi/ide-components/lib/button';
import { Modal } from '@opensumi/ide-components/lib/modal';
import { useInjectable } from '@opensumi/ide-core-browser';
import { formatLocalize, localize } from '@opensumi/ide-core-common';
import { IMessageService } from '@opensumi/ide-overlay';

import { MCPServer, MCP_SERVER_TYPE } from '../../../../common/types';

import styles from './mcp-server-form.module.less';
export interface MCPServerFormData {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type: MCP_SERVER_TYPE;
  url?: string;
}

interface Props {
  visible: boolean;
  initialData?: MCPServerFormData;
  servers: MCPServer[];
  onSave: (data: MCPServerFormData) => void;
  onCancel: () => void;
}

export const MCPServerForm: FC<Props> = ({ visible, initialData, onSave, onCancel, servers: existingServers }) => {
  const [formData, setFormData] = useState<MCPServerFormData>(() => ({
    name: '',
    command: '',
    args: [],
    env: {},
    type: MCP_SERVER_TYPE.STDIO,
    ...initialData,
  }));
  const messageService = useInjectable<IMessageService>(IMessageService);
  const [argsText, setArgsText] = useState(() => initialData?.args?.join(' ') || '');
  const [envText, setEnvText] = useState(() => {
    if (!initialData?.env) {
      return '';
    }
    return Object.entries(initialData.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  });

  useEffect(() => {
    setFormData({
      name: '',
      command: '',
      args: [],
      env: {},
      type: MCP_SERVER_TYPE.STDIO,
      ...initialData,
    });
    setArgsText(initialData?.args?.join(' ') || '');
    setEnvText(
      initialData?.env
        ? Object.entries(initialData.env)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n')
        : '',
    );
  }, [initialData]);

  const validateForm = useCallback(
    (formData: MCPServerFormData) => {
      if (formData.name.trim() === '') {
        messageService.error(localize('ai.native.mcp.name.isRequired'));
        return false;
      }
      if (
        !initialData &&
        existingServers.some((server) => server.name.toLocaleLowerCase() === formData.name.toLocaleLowerCase())
      ) {
        messageService.error(formatLocalize('ai.native.mcp.serverNameExists', formData.name));
        return false;
      }
      if (formData.type === MCP_SERVER_TYPE.SSE) {
        const isServerHostValid = formData.url?.trim() !== '';
        if (!isServerHostValid) {
          messageService.error(localize('ai.native.mcp.url.isRequired'));
        }
        return isServerHostValid;
      }
      const isCommandValid = formData.command?.trim() !== '';
      if (!isCommandValid) {
        messageService.error(localize('ai.native.mcp.command.isRequired'));
      }
      return isCommandValid;
    },
    [existingServers, initialData],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const isValid = validateForm(formData);
      if (!isValid) {
        return;
      }
      const form = {
        ...formData,
      };
      if (formData.type === MCP_SERVER_TYPE.SSE) {
        form.url = form.url?.trim();
      } else {
        const args = argsText.split(' ').filter(Boolean);
        const env = envText
          .split('\n')
          .filter(Boolean)
          .reduce((acc, line) => {
            const [key, value] = line.split('=');
            if (key && value) {
              acc[key.trim()] = value.trim();
            }
            return acc;
          }, {} as Record<string, string>);
        form.args = args;
        form.env = env;
      }

      setFormData({
        ...formData,
        name: '',
        command: '',
        url: '',
        args: [],
        env: {},
      });

      onSave(form);
    },
    [formData, argsText, envText, onSave, validateForm],
  );

  const handleCommandChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, command: e.target.value });
    },
    [formData, argsText],
  );

  const handleArgsChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setArgsText(e.target.value);
    },
    [argsText],
  );

  const handleEnvChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setEnvText(e.target.value);
    },
    [envText],
  );

  const handleServerHostChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setFormData({ ...formData, url: e.target.value });
    },
    [formData],
  );

  const handleTypeChange = useCallback(
    (value: MCP_SERVER_TYPE) => {
      setFormData({
        ...formData,
        type: value,
        command: '',
        args: [],
        env: {},
        url: '',
      });
    },
    [formData],
  );

  const renderFormItems = useCallback(() => {
    if (formData?.type === MCP_SERVER_TYPE.STDIO) {
      return (
        <>
          <div className={styles.formItem}>
            <label>{localize('ai.native.mcp.command')}</label>
            <input
              type='text'
              value={formData.command}
              onChange={handleCommandChange}
              placeholder={localize('ai.native.mcp.command.placeHolder')}
              required
            />
          </div>
          <div className={styles.formItem}>
            <label>{localize('ai.native.mcp.args')}</label>
            <textarea
              value={argsText}
              onChange={handleArgsChange}
              placeholder={localize('ai.native.mcp.args.placeHolder')}
              rows={3}
            />
          </div>
          <div className={styles.formItem}>
            <label>{localize('ai.native.mcp.env')}</label>
            <textarea
              value={envText}
              onChange={handleEnvChange}
              placeholder={localize('ai.native.mcp.env.placeHolder')}
              rows={3}
            />
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className={styles.formItem}>
            <label>{localize('ai.native.mcp.url')}</label>
            <textarea
              value={formData.url}
              onChange={handleServerHostChange}
              placeholder={localize('ai.native.mcp.url.placeHolder')}
              rows={3}
            />
          </div>
        </>
      );
    }
  }, [formData, argsText, envText]);

  return (
    <Modal
      title={initialData ? localize('ai.native.mcp.editMCPServer.title') : localize('ai.native.mcp.addMCPServer.title')}
      visible={visible}
      onCancel={onCancel}
      centered
      width={600}
      footer={null}
      style={{
        background: 'var(--editor-background)',
      }}
    >
      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <div className={styles.formRow}>
          <div className={cls(styles.formItem, styles.formItemName)}>
            <label>{localize('ai.native.mcp.name')}</label>
            <input
              type='text'
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={localize('ai.native.mcp.name.placeHolder')}
              required
            />
          </div>
          <div className={cls(styles.formItem, styles.formItemType)}>
            <label>{localize('ai.native.mcp.type')}</label>
            <Select
              size='large'
              value={formData.type}
              options={[
                { label: localize('ai.native.mcp.stdio'), value: MCP_SERVER_TYPE.STDIO },
                { label: localize('ai.native.mcp.sse'), value: MCP_SERVER_TYPE.SSE },
              ]}
              className={styles.formItemSelect}
              onChange={handleTypeChange}
            />
          </div>
        </div>
        {renderFormItems()}
        <div className={styles.formActions}>
          <Button onClick={onCancel} type='primary' className={styles.secondaryButton}>
            {localize('ai.native.mcp.buttonCancel')}
          </Button>
          <Button onClick={handleSubmit} type='primary'>
            {initialData ? localize('ai.native.mcp.buttonUpdate') : localize('ai.native.mcp.buttonSave')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
