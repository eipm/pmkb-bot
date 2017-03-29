/**
 * Created by mim2070 on 12/1/16.
 */
'use strict';
const configs = require('nconf');
const path = require('path');

// Set the order of precedence to read configs from, i.e. configs from env have highest precedence
configs
  .env()
  .file({file: path.join(__dirname, 'default.json')});

module.exports = configs;