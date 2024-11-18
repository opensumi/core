import { RawContextKey } from '../raw-context-key';

export const DialogViewVisibleContext = new RawContextKey<boolean>('dialogViewVisible', false);
export const FileDialogViewVisibleContext = new RawContextKey<boolean>('fileDialogViewVisible', false);
