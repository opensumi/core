import mri from 'mri';

const _argv = process.argv.slice(2);

const argv = mri(_argv);

export { argv };
