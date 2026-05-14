import type { FooterConfig } from '../mention-input/types';

export interface ModeOption {
  id: string;
  name: string;
  description?: string;
}

export interface ACPFooterConfig extends FooterConfig {
  modeOptions?: ModeOption[];
  defaultMode?: string;
  /** Controlled current mode ID, synced to selector when changed */
  currentMode?: string;
  showModeSelector?: boolean;
  disableModeSelector?: boolean;
}
