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
  request({
    method: 'GET',
    uri: this.host + '/api/health_check',
    auth: {
      user: this.username,
      pass: this.password
    }
  }, function (err, resp, body) {
    callback(null, resp && resp.statusCode === 200)
  })
};

Client.prototype.getGenes = function (callback) {
  request({
    method: 'GET',
    uri: this.host + '/api/genes',
    auth: {
      user: this.username,
      pass: this.password
    }
  }, function (err, resp, body) {
    callback(null, JSON.parse(body).genes);
  })
  //TODO On error
};

module.exports = Client;