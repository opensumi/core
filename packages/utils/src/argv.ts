/* eslint-disable no-console */
import mri, { Argv, Options } from 'mri';

export function parseArgv(argv: string[], options?: Options) {
  return mri(argv, options);
}

export function parseString(str: string, options?: Options) {
  return mri(str.split(' '), options);
}

export class ArgvFactory {
  constructor(private factoryArgv: string[]) {}

  private _argv: Argv | undefined;
  get argv() {
    if (!this._argv) {
      const options = {
        string: this._string,
      } as Options;
      this._argv = mri(this.factoryArgv, options);
    }

    if (this._argv?.help && this.showHelp) {
      this.showUsage();
      process.exit(0);
    }

    return this._argv;
  }
  private _usage: string | undefined;
  usage(message: string) {
    this._usage = message;
    return this;
  }

  private showUsage() {
    if (this._usage) {
      console.log(this._usage.trimLeft());
      if (this.showHelp) {
        console.log('Usage:');
        console.log('    ' + this.showHelp);
      }
    }
  }

  private _string = [] as string[];
  string(k: string) {
    this._string.push(k);
    return this;
  }
  private showHelp: string | undefined;
  help() {
    this.showHelp = '--help Show help';
    return this;
  }
}
