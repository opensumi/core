import React, { useState, useEffect } from 'react';
import { localize } from '@opensumi/ide-core-common';
import { useInjectable, getOctIcon } from '@opensumi/ide-core-browser';
import { Input, Button } from '@opensumi/ide-components';
import { observer } from 'mobx-react-lite';
import { ICodeAPIProvider } from '../common/types';
import type { CodeAPIProvider } from '../code-api.provider';
import styles from './github.module.less';

export const GitHubView: React.FC = observer(() => {
  const { github } = useInjectable<CodeAPIProvider>(ICodeAPIProvider);
  const { resources } = github;
  const [tokenValue, setTokenValue] = useState('');
  const [validating, setValidating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const validateToken = async () => {
    if (!tokenValue) {return;}
    setValidating(true);
    try {
      await github.validateToken(tokenValue);
      setTokenValue('');
    } finally {
      setValidating(false);
    }
  };

  const refresh = async () => {
    setSyncing(true);
    try {
      await github.refresh();
    } finally {
      setSyncing(false);
    }
  };

  const renderRateLimit = (key: keyof typeof resources, title: string) => {
    const data = resources[key];
    return (
      <div className={styles.resource}>
        <div className={styles.resourceTitle}>{title}</div>
        <ul className={styles.rateList}>
          <li>
            {localize('github.rate-limit-limit')}
            <span className={styles.rateData}>{data.limit}</span>
          </li>
          <li>
            {localize('github.rate-limit-remaining')}
            <span className={styles.rateData}>{data.remaining}</span>
          </li>
          <li>
            {localize('github.rate-limit-reset')}
            <span className={styles.rateData}>{formateTime(data.reset * 1000)}</span>
          </li>
        </ul>
      </div>
    );
  };

  const renderNoToken = () => (
      <div>
        <div className={styles.title}>
          {localize('github.auth-title')}
          <a
            href='https://github.com/settings/tokens/new?scopes=repo&description=Ant%20Codespaces'
            target='_blank'
            style={{ marginLeft: 8 }}
          >
            <i className={getOctIcon('link')}></i> {localize('github.auth-goto')}
          </a>
        </div>
        <div className={styles.authTip}>
          {localize('github.auth-tip')}{' '}
          <a href='https://docs.github.com/en/rest/overview/resources-in-the-rest-api#authentication' target='_blank'>
            {localize('common.ref-doc')}
          </a>
        </div>
        <div className={styles.authInput}>
          <Input
            size='small'
            placeholder={`${localize('github.auth-input')} OAuth Token`}
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <Button size='small' style={{ marginRight: 8 }} onClick={() => validateToken()} loading={validating}>
            {localize('common.save')}
          </Button>
          <Button size='small' onClick={() => setTokenValue('')} loading={validating} type='default'>
            {localize('common.reset')}
          </Button>
        </div>
      </div>
    );

  const renderHasToken = () => {
    const token = github.OAUTH_TOKEN!;
    return (
      <div>
        <div className={styles.title}>{localize('github.auth-has-token-title')}</div>
        <div>{localize('github.auth-cur-token')}</div>
        <div>
          {token.slice(0, 6)}
          {token.slice(6).replace(/./g, '*')}
        </div>
        <div style={{ marginTop: 8 }}>
          <Button onClick={() => github.clearToken()} type='default'>
            {localize('common.clear')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        {localize('github.rate-limiting-info')}{' '}
        <span style={{ marginLeft: 8, cursor: 'pointer' }} onClick={() => refresh()} title={localize('common.refresh')}>
          <i className={`${getOctIcon('sync')} ${syncing ? 'octicon-animation-spin' : ''}`}></i>
        </span>
      </div>
      <div>
        {renderRateLimit('core', 'Core')}
        {renderRateLimit('graphql', 'GraphQL')}
      </div>
      {github.OAUTH_TOKEN ? renderHasToken() : renderNoToken()}
    </div>
  );
});

function formateTime(n: number) {
  if (n <= 0) {return '-';}
  const date = new Date(n);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}`;
}
