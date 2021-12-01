# @opensumi/ide-core-browser

## Usage

### Utils

#### createOverlay
```tsx
import { createOverlay, destroyAllOverlays } from '@opensumi/ide-core-browser/lib/utils/create-overlay';

const overlayInstance = createOverlay(<h1 style={{color: 'white'}}>hello world</h1>);
overlayInstance.update(<h2 style={{color: 'white'}}>hello world</h2>);
overlayInstance.destroy();

destroyAllOverlays();
```
