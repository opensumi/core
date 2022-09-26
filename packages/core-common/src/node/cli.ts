import mri from 'mri';

const _argv = process.argv.slice(2);

const argv = mri(_argv) as { [x: string]: unknown; _: (string | number)[] };

export { argv };
