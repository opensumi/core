import { App, WebRequester } from '@ali/ide-core-browser';
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { mainLayout } from '../src/browser';
import { fileTree } from '@ali/ide-file-tree/browser';

const requester = new WebRequester();
const slotMap = new Map();

ReactDom.render((
  <App
    requester={requester}
    modules={[mainLayout, fileTree]}
    slotMap={slotMap}
  />
), document.getElementById('main'));
