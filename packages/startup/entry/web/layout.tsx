import { DefaultLayout as RawDefaultLayout } from '@opensumi/ide-core-browser/lib/components';

export function DefaultLayout() {
  return RawDefaultLayout({
    topSlotDefaultSize: 35,
    topSlotZIndex: 2,
  });
}
