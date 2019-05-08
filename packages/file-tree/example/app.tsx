import { App, WebRequester } from '@ali/ide-core-browser';
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { fileTree } from '../src/browser';

const requester = new WebRequester();
const slotMap = new Map();

ReactDom.render((
  <App
    requester={requester}
    modules={[fileTree]}
    slotMap={slotMap}
  />
), document.getElementById('main'));
