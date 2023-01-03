const mri = require('mri');

class Commander {
  commandMap = new Map();
  addSubCommand(subCommand, options) {
    this.commandMap.set(subCommand, options);
  }

  run() {
    const argv = mri(process.argv.slice(2));

    const subCommand = argv._[0];

    if (subCommand) {
      const options = this.commandMap.get(subCommand);
      if (options && options.handler && typeof options.handler === 'function') {
        options.handler(argv._.slice(1), argv);
      }
      return;
    }

    console.log(`Usage:
${this.renderSubCommand()}

Good bye~`);
  }
  renderSubCommand() {
    const result = [];
    for (const [name, options] of this.commandMap.entries()) {
      result.push(`  - ${name}: ${options.help}`);
    }
    return result.join('\n');
  }
}

module.exports = Commander;
