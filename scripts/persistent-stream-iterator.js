'use strict';

var StreamIterator = require('./stream-iterator'),
  PersistentStream = require('./persistent-stream'),
  inherits = require('inherits'),
  req = require('request'),
  JSONStream = require('JSONStream');

var PersistentStreamIterator = function (requestOpts, JSONStreamParseStr, indefinite, request) {
  this._lastRequest = null;
  this._request = request ? request : req;
  this._create(requestOpts, JSONStreamParseStr, indefinite);
};

inherits(PersistentStreamIterator, StreamIterator);

PersistentStreamIterator.prototype._create = function (requestOpts, jsonStreamParseStr,
  indefinite) {

  var self = this,
    stream = new PersistentStream(indefinite);

  stream.pipeErrorsTo(this);

  stream.setStreamFactory(function () {

    self._lastRequest = self._request(requestOpts);

    return self._lastRequest
      .on('error', function (err) {
        stream.onError(err);
      })
      .pipe(JSONStream.parse(jsonStreamParseStr))
      .on('error', function (err) {
        // Yes, we actually need to listen for the error before and after the pipe
        stream.onError(err);
      });
  });

  this.setStream(stream);

};

PersistentStreamIterator.prototype.abort = function () {
  // _lastRequest may not exist as we may not be connected
  if (this._lastRequest) {
    this._lastRequest.abort();
  }

  // _stream may not exist as we may not be connected
  if (this._stream && this._stream.abort) {
    this._stream.abort();
  }

  return StreamIterator.prototype.abort.apply(this, arguments);
};

module.exports = PersistentStreamIterator;
