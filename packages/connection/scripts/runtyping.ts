import { Generator } from '@runtyping/zod';
import { writeFile } from 'fs-extra';
import { resolve } from 'path';
import { format, resolveConfig } from 'prettier';

const targetFile = resolve(__dirname, '../src/common/protocols/gen/common-zod.ts');

const prettierConfigFile = resolve(__dirname, '../../../.prettierrc');

const generator = new Generator({
  targetFile: targetFile,
  tsConfigFile: resolve(__dirname, '../../../configs/ts/tsconfig.resolve.json'),
});

generator
  .generate([
    { file: '@opensumi/ide-utils/src/uri.ts', type: 'UriComponents' },
    // { file: '@opensumi/ide-core-common/src/types/common.ts', type: 'ICommonServer' },
  ])
  .then(async (file) => {
    const fileStrin = file.getFullText();
    const config = await resolveConfig(prettierConfigFile);
    const formatted = format(fileStrin, { parser: 'typescript', ...config });
    console.log(formatted);
    writeFile(targetFile, formatted);
  });
