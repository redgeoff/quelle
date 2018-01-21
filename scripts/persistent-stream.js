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
    // stream will be falsy if the iterator was aborted before the stream was even created
    if (stream) {
      self._stream = stream;
      self._listenToStream();
      self._wrapStream();
      self.emit('connect');
    }
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

    // TODO: JSONStream throws errors like err.message='Error: Unexpected STRING(" }, { ") in state
    // COMMA'. Should we submit a PR that instead generates something like an InvalidJSONError?
    return new RegExp([
      // We sometimes get "Invalid JSON" errors when listening to CouchDB _db_updates feed and the
      // CouchDB instance is restarted.
      'Invalid JSON',

      // Occurs randomly when many simultaenous connections
      'emfile',
      'socket hang up',
      'HPE_INVALID_CHUNK_SIZE'

      // TODO: It is not clear why CouchDB responds with these timeout errors and immediately
      // retrying the request often leads to deadlocks when you are continuously listening. In
      // practice, it is better that your app throws a fatal error and then is restarted, e.g. via
      // Docker, as this seems to reliably recover from this state. At some point we should analyze
      // this better and determine where the bug lies and fix it at the root cause:
      // https://github.com/redgeoff/spiegel/issues/100
      //
      // Occurs randomly even when there is a relatively small amount of data, e.g. "The request
      // could not be processed in a reasonable amount of time"
      //
      // 'timeout'
    ].join('|'), 'i').test(err.message);
  }
};

PersistentStream.prototype._reconnect = function () {
  // Note: this is needed even though backoff.attempt already calls failure()
  this._backoff.failure();

  if (!this._aborted && !this._backoff.reachedMaxRetries()) {
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
