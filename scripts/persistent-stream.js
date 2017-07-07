'use strict';

var Backoff = require('backoff-promise'),
  sporks = require('sporks'),
  events = require('events'),
  inherits = require('inherits');

// NOTE: need to connect in setStreamFactory and not the constructor as error reporting requires a
// circular dependency
var PersistentStream = function (indefinite) {
  this._backoff = new Backoff();
  this._indefinite = indefinite;
  this._aborted = false;
};

inherits(PersistentStream, events.EventEmitter);

PersistentStream.prototype.connect = function () {
  var self = this;
  return self._backoff.attempt(function () {
    return self._streamFactory();
  }).then(function (stream) {
    self._stream = stream;
    self._listenToStream();
    self._wrapStream();
    self.emit('connect');
  });
};

PersistentStream.prototype.setStreamFactory = function (streamFactory) {
  this._streamFactory = streamFactory;
  if (!this._aborted) {
    this.connect();
  }
};

PersistentStream.prototype._listenToStream = function () {

  var self = this,
    events = ['data', 'error'];

  events.forEach(function (event) {
    self._stream.on(event, function () {
      var args = sporks.toArgsArray(arguments);
      self.emit.apply(self, [event].concat(args));
    });
  });

  self._stream.on('end', function () {
    // Should we reconnect?
    if (self._indefinite && !self._aborted) {
      // We don't call failure() here as we didn't get a 'end' event during a connection startup
      // failure and therefore want to reconnect without any delay
      self.connect();
    } else {
      var args = sporks.toArgsArray(arguments);
      self.emit.apply(self, ['end'].concat(args));
    }
  });

};

PersistentStream.prototype._wrapStream = function () {

  var fns = ['pause', 'resume'];

  fns.forEach(function (fn) {
    PersistentStream.prototype[fn] = function () {
      return this._stream[fn].apply(this._stream, arguments);
    };
  });

};

PersistentStream.prototype._shouldReconnect = function (err) {
  switch (err.code) {

  case 'ECONNREFUSED': // Connection refused, e.g. because DB being restarted

  case 'ENETUNREACH': // Can occur when box sleeps/wakes-up

    // Can occur randomly when there are many simultaenous connections
  case 'ECONNRESET':
  case 'ETIMEDOUT':
  case 'HPE_INVALID_CHUNK_SIZE':

    return true;

  default:
    // We sometimes get "Invalid JSON" errors when listening to CouchDB _db_updates feed and the
    // CouchDB instance is restarted.
    //
    // TODO: JSONStream throws errors like err.message='Error: Unexpected STRING(" }, { ") in state
    // COMMA'. Should we submit a PR that instead generates something like an InvalidJSONError?
    //
    // - emfile => occurs randomly when many simultaenous connections
    // - socket hang up => occurs randomly when many simultaenous connections
    // - HPE_INVALID_CHUNK_SIZE => occurs randomly when many simultaenous connections
    return /Invalid JSON|emfile|socket hang up|HPE_INVALID_CHUNK_SIZE/.test(err.message);
  }
};

PersistentStream.prototype._reconnect = function () {
  // TODO: remove? Isn't this already called by backoff.attempt when there is a failure?
  this._backoff.failure();

  if (!this._aborted) {
    this.connect();
  }
};

PersistentStream.prototype.onError = function (err) {
  if (this._shouldReconnect(err)) {
    this._reconnect();
  } else {
    // Doesn't warrant a reconnect so we emit the error to any listeners so that they can handle it
    this.emit('error', err);
  }
};

PersistentStream.prototype.pipeErrorsTo = function (emitter) {
  var self = this;
  self.on('error', function (err) {
    // Ignore any errors that will lead to a reconnect like 'Invalid JSON (Unexpected "h" at
    // position 1 in state STOP)'
    if (!self._shouldReconnect(err)) {
      var args = sporks.toArgsArray(arguments);
      emitter.emit.apply(emitter, ['error'].concat(args));
    }
  });
};

PersistentStream.prototype.abort = function () {
  this._aborted = true;
};

module.exports = PersistentStream;
