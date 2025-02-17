import cls from 'classnames';
import { debounce } from 'lodash';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

import { ClickOutside } from '@opensumi/ide-components/lib/click-outside';
import { AppConfig, LabelService } from '@opensumi/ide-core-browser';
import { Icon, Input, Scrollbars } from '@opensumi/ide-core-browser/lib/components';
import { RecentFilesManager } from '@opensumi/ide-core-browser/lib/quick-open/recent-files';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search/lib/common/file-search';
import { URI } from '@opensumi/ide-utils';

import { FileContext } from '../../../common/llm-context';

import styles from './style.module.less';

interface CandidateFileProps {
  uri: URI;
  active: boolean;
  selected: boolean;
  onDidSelect: (val: URI) => void;
  onDidDeselect: (val: URI) => void;
}

const CandidateFile = memo(({ uri, active, selected, onDidSelect, onDidDeselect }: CandidateFileProps) => {
  const labelService = useInjectable<LabelService>(LabelService);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const itemsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (active && itemsRef.current) {
      const scrollBehavior: ScrollIntoViewOptions = {
        behavior: 'instant',
        block: 'end',
      };
      itemsRef.current.scrollIntoView(scrollBehavior);
    }
  }, [active, itemsRef.current]);

  return (
    <div
      className={cls(styles.candidate_file, active && styles.active)}
      ref={(ele) => (itemsRef.current = ele)}
      onClick={() => (selected ? onDidDeselect(uri) : onDidSelect(uri))}
    >
      <Icon iconClass={labelService.getIcon(uri)} />
      <span className={styles.basename}>{uri.path.base}</span>
      <span className={styles.dir}>{URI.file(appConfig.workspaceDir).relative(uri.parent)?.toString()}</span>
      {selected && <Icon icon='check' style={{ marginLeft: 'auto', color: 'var(--editorGutter-addedBackground)' }} />}
    </div>
  );
});

interface ContextSelectorProps {
  addedFiles: FileContext[];
  onDidSelect: (val: URI) => void;
  onDidDeselect: (val: URI) => void;
  onDidClose: () => void;
}

export const ContextSelector = memo(({ addedFiles, onDidDeselect, onDidSelect, onDidClose }: ContextSelectorProps) => {
  const [candidateFiles, updateCandidateFiles] = useState<URI[]>([]);
  const [activeFile, setActiveFile] = useState<URI | null>(null);
  const [searching, toggleSearching] = useState(false);
  const [searchResults, updateSearchResults] = useState<URI[]>([]);

  const recentFilesManager: RecentFilesManager = useInjectable(RecentFilesManager);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const searchService = useInjectable<IFileSearchService>(FileSearchServicePath);

  const container = useRef<HTMLDivElement | null>();

  useEffect(() => {
    if (candidateFiles.length === 0) {
      recentFilesManager.getMostRecentlyOpenedFiles().then((files) => {
        const addedUris = addedFiles.map((val) => val.uri);
        const recentFiles = files.filter((file) => !addedUris.includes(new URI(file))).map((file) => new URI(file));
        updateCandidateFiles(recentFiles);
        setActiveFile(recentFiles[0] || null);
      });
    }
  }, [addedFiles]);

  const onDidInput = useCallback(
    debounce((ev) => {
      if (ev.target.value.trim() === '') {
        updateSearchResults([]);
        setActiveFile(candidateFiles[0]);
        return;
      }

      toggleSearching(true);
      searchService
        .find(ev.target.value, {
          rootUris: [appConfig.workspaceDir],
          limit: 200,
          useGitIgnore: true,
          noIgnoreParent: true,
          fuzzyMatch: true,
        })
        .then((res) => {
          const results = res.map((val) => new URI(val));
          updateSearchResults(results);
          setActiveFile(results[0]);
        })
        .finally(() => {
          toggleSearching(false);
        });
    }, 500),
    [],
  );

  const onDidKeyDown = useCallback(
    (event) => {
      const { key } = event;
      if (key === 'Escape') {
        onDidClose();
        return;
      }

      if (key === 'Enter' && activeFile) {
        onDidSelect(activeFile);
        return;
      }

      const validKeys = ['ArrowUp', 'ArrowDown'];

      if (!validKeys.includes(key)) {
        return;
      }

      const files = searchResults.length > 0 ? searchResults : candidateFiles;

      if (files.length === 0) {
        return;
      }

      const currentIndex = files.indexOf(activeFile!);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const lastIndex = files.length - 1;

      const nextIndex =
        key === 'ArrowUp' ? (safeIndex > 0 ? safeIndex - 1 : lastIndex) : safeIndex < lastIndex ? safeIndex + 1 : 0;

      setActiveFile(files[nextIndex]);
    },
    [activeFile, searchResults, candidateFiles],
  );

  return (
    <ClickOutside mouseEvents={['click', 'contextmenu']} onOutsideClick={() => onDidClose()}>
      <div className={styles.context_selector} onKeyDown={onDidKeyDown} tabIndex={-1}>
        <div style={{ padding: '4px' }}>
          <Input placeholder='Search files by name' autoFocus onInput={onDidInput} />
        </div>
        <Scrollbars forwardedRef={(el) => (el ? (container.current = el.ref) : null)}>
          <div className={styles.context_list}>
            {searching && <div className={styles.context_search_layer} />}
            <span className={styles.list_desc}>
              {searchResults.length > 0 ? 'Search Results' : 'Recent Opened Files'}
            </span>
            {(searchResults.length > 0 ? searchResults : candidateFiles).map((file) => (
              <CandidateFile
                key={file.toString()}
                uri={file}
                active={activeFile === file}
                onDidSelect={onDidSelect}
                onDidDeselect={onDidDeselect}
                selected={!!addedFiles.find((val) => val.uri.isEqual(file))}
              />
            ))}
          </div>
        </Scrollbars>
      </div>
    </ClickOutside>
  );
});
