#!/usr/bin/env node

const Commander = require('./commander');
const { rebuild } = require('./rebuild-native');

const commander = new Commander();
commander.addSubCommand('rebuild', {
  handler: (_, argv) => {
    console.log(_);
    console.log(argv);
    rebuild(argv);
  },
  help: 'rebuild current working directory native modules',
});

commander.run();
