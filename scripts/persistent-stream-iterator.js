'use strict';

var StreamIterator = require('./stream-iterator'),
  PersistentStream = require('./persistent-stream'),
  inherits = require('inherits'),
  req = require('request'),
  JSONStream = require('JSONStream');

var PersistentStreamIterator = function (requestOpts, JSONStreamParseStr, indefinite, request,
  forceReconnectAfterMilliseconds) {
  StreamIterator.apply(this, arguments);

  this._lastRequest = null;

  // TODO: in the future we should create a very basic test API server that serves JSON to actually
  // test with request. For now, this level of coverage is handled by Slouch.
  /* istanbul ignore next */
  this._request = request ? request : req;

  // When continuously listening to a CouchDB stream our stream can just deadlock, even when we
  // specify a heartbeat=60s. This rarely happens, about once a week, but when it does it can cause
  // major issues for users. It isn't clear if this issue is at the CouchDB, AWS load balancer or
  // Slouch layer as there are no errors generated, but we can avoid it by simply reconnecting
  // periodically.
  this._forceReconnectTimeout = null;
  this._forceReconnectAfterMilliseconds = forceReconnectAfterMilliseconds;

  this._create(requestOpts, JSONStreamParseStr, indefinite);
};

inherits(PersistentStreamIterator, StreamIterator);

PersistentStreamIterator.prototype._onceData = function ( /* stream, data, requestOpts */ ) {
  // This is a hook for detecting errors, reported as JSON, like authentication errors reported by
  // CouchDB.

  // Do nothing by default
};

PersistentStreamIterator.prototype._clearAnyForceReconnectTimeout = function () {
  clearTimeout(this._forceReconnectTimeout);
};

PersistentStreamIterator.prototype._forceReconnect = function () {
  this._lastRequest.abort();

  // If we haven't yet received data then issuing lastRequest.abort() does not lead to an 'end'
  // event. Therefore, we need to manually emit an 'end' event so that the PersistentStream can
  // reconnect.
  if (!this._receivedData) {
    this._stream._stream.emit('end');
  }
};

PersistentStreamIterator.prototype._startAnyForceReconnectTimeout = function () {
  var self = this;
  if (self._forceReconnectAfterMilliseconds) {
    self._clearAnyForceReconnectTimeout();
    self._forceReconnectTimeout = setTimeout(function () {
      self._forceReconnect();
    }, self._forceReconnectAfterMilliseconds);
  }
};

PersistentStreamIterator.prototype._create = function (requestOpts, jsonStreamParseStr,
  indefinite) {

  var self = this,
    stream = new PersistentStream(indefinite);

  stream.pipeErrorsTo(this);

  stream.setStreamFactory(function () {

    // Make sure the iterator wasn't immediately aborted
    if (!self._aborted) {

      self._receivedData = false;

      self._lastRequest = self._request(requestOpts);

      self._startAnyForceReconnectTimeout();

      return self._lastRequest
        .on('error', function (err) {
          stream.onError(err);
        })
        .once('data', function (data) {
          self._receivedData = true;

          // Analyze the raw data before it is piped to the JSONStream.
          self._onceData(stream, data, requestOpts);
        })
        .pipe(JSONStream.parse(jsonStreamParseStr))
        .on('error', function (err) {
          // Yes, we actually need to listen for the error before and after the pipe
          stream.onError(err);
        });

    }
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

  // Stop any force reconnect loop
  this._clearAnyForceReconnectTimeout();

  return StreamIterator.prototype.abort.apply(this, arguments);
};

module.exports = PersistentStreamIterator;
