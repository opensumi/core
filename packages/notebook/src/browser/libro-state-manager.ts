import { LibroView } from '@difizen/libro-jupyter/noeditor';

import { Autowired, Injectable } from '@opensumi/di';
import { StorageProvider, URI } from '@opensumi/ide-core-common';

export interface INotebookViewState {
  uri: string;
  scrollTop: number;
  lastActiveTime: number;
}

export interface INotebookStateManager {
  saveState(uri: URI, libroView: LibroView): void;
  restoreState(uri: URI, libroView: LibroView): Promise<boolean>;
  clearState(uri: URI): void;
  getAllStates(): Record<string, INotebookViewState>;
}

@Injectable()
export class LibroStateManager implements INotebookStateManager {
  private static readonly STORAGE_KEY = 'libro-notebook-states';
  public static readonly LIBRO_SCROLL_ELEMENT = '.libro-view-content';

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  private stateCache = new Map<string, INotebookViewState>();

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage() {
    try {
      const storage = await this.storageProvider(new URI('libro-notebook-storage'));
      const stored = await storage.get(LibroStateManager.STORAGE_KEY);
      if (stored && typeof stored === 'object') {
        Object.entries(stored).forEach(([uri, state]) => {
          if (this.isValidState(state)) {
            this.stateCache.set(uri, state as INotebookViewState);
          }
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load notebook states from storage:', error);
    }
  }

  private async saveToStorage() {
    try {
      const storage = await this.storageProvider(new URI('libro-notebook-storage'));
      const states: Record<string, INotebookViewState> = {};
      this.stateCache.forEach((state, uri) => {
        states[uri] = state;
      });
      await storage.set(LibroStateManager.STORAGE_KEY, states);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to save notebook states to storage:', error);
    }
  }

  private isValidState(state: any): state is INotebookViewState {
    return state && typeof state === 'object' && typeof state.uri === 'string' && typeof state.scrollTop === 'number';
  }

  saveState(uri: URI, libroView: LibroView): void {
    if (!libroView || !libroView.model || !libroView.container) {
      return;
    }

    try {
      const libroViewContent = libroView.container.current?.querySelector(LibroStateManager.LIBRO_SCROLL_ELEMENT);
      const state: INotebookViewState = {
        uri: uri.toString(),
        scrollTop: libroViewContent?.scrollTop || 0,
        lastActiveTime: Date.now(),
      };

      this.stateCache.set(uri.toString(), state);
      this.saveToStorage();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to save notebook state:', error);
    }
  }

  async restoreState(uri: URI, libroView: LibroView): Promise<boolean> {
    const state = this.stateCache.get(uri.toString());
    if (!state || !libroView || !libroView.model) {
      return false;
    }

    try {
      const libroViewContent = libroView.container?.current?.querySelector(LibroStateManager.LIBRO_SCROLL_ELEMENT);
      // 恢复 notebook 的滚动位置
      if (libroViewContent) {
        libroViewContent.scrollTop = state.scrollTop;
      }

      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to restore notebook state:', error);
      return false;
    }
  }

  clearState(uri: URI): void {
    this.stateCache.delete(uri.toString());
    this.saveToStorage();
  }

  getAllStates(): Record<string, INotebookViewState> {
    const states: Record<string, INotebookViewState> = {};
    this.stateCache.forEach((state, uri) => {
      states[uri] = state;
    });
    return states;
  }

  getState(uri: URI): INotebookViewState | undefined {
    return this.stateCache.get(uri.toString());
  }
}
