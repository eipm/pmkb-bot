/**
 * Created by mim2070 on 3/27/17.
 */
'use strict';

const request = require('request');

function Client(host, username, password) {
  this.host = host;
  this.username = username;
  this.password = password;
}

Client.prototype.isAlive = function (callback) {
  this._get('/api/health_check', function (err, resp, body) {
    callback(null, resp && resp.statusCode === 200)
  })
};

Client.prototype.getGenes = function (callback) {
  this._get('/api/genes', function (err, resp, body) {
    callback(null, JSON.parse(body).genes);
  })
};

Client.prototype._get = function (endpoint, callback) {
  request({
    method: 'GET',
    uri: this.host + endpoint,
    auth: {
      user: this.username,
      pass: this.password
    }
  }, callback);
}

module.exports = Client;