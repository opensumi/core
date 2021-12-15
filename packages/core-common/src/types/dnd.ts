import { BasicEvent } from '../event-bus';

export interface IFileTreeDropEventPayload {
  event: DragEvent;
  targetDir?: string;
}

export class FileTreeDropEvent extends BasicEvent<IFileTreeDropEventPayload> {}
