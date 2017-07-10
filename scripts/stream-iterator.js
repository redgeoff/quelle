'use strict';

var inherits = require('inherits'),
  events = require('events'),
  Promise = require('bluebird'),
  sporks = require('sporks');

// NOTE: in order to include stream error handling in StreamIterator, we need to provide a
// setStream() function instead of automatically setting the stream in the constructor, which would
// result in a circular dependency. This is mainly due to the fact that the sequence of stream
// errors matters, i.e. you need to listen for errors before doing any piping.

var StreamIterator = function () {};

inherits(StreamIterator, events.EventEmitter);

StreamIterator.prototype._each = function (onItem) {
  var self = this;

  return new Promise(function (resolve, reject) {

    var hasItems = false;

    self.on('item', function (item) {
      hasItems = true;
      Promise.resolve().then(function () {
        return onItem(item);
      }).then(function () {
        self.next();
      }).catch(function (err) {
        reject(err);
      });
    });

    self.on('end', function () {
      resolve(hasItems);
    });

    self.on('error', function (err) {
      reject(err);
    });

  });
};

StreamIterator.prototype._throttledEach = function (onItem, throttler) {

  // NOTE: we need to use a Throttler as we need a construct that allows us to schedule concurrent
  // processes and also listen for the completion of any of them.

  var err;

  return this.each(function (item) {
    var promise = null;

    // Are we over the maxConcurrentProcesses? If so, we'll need to wait for the next process to
    // finish, i.e. it completes or there is an error.
    if (throttler.numProcesses() > throttler.getMaxConcurrentProcesses()) {
      promise = sporks.once(throttler, 'process-done-or-error');
    }

    // We schedule the process, without waiting for it resolve, as we want concurrency
    throttler.run(function () {
      return onItem(item);
    }).catch(function (_err) {
      // We are processing concurrently, but we still need to throw any errors
      err = _err;
    });

    return promise;

  }).then(function () {

    // Resolve after the last of the processes
    return throttler.allDone();

  }).then(function () {

    if (err) { // any errors
      throw err;
    }

  });
};

StreamIterator.prototype.each = function (onItem, throttler) {
  // The handling of concurrent processes adds a little overhead so we avoid this overhead when it
  // isn't needed
  if (typeof throttler === 'undefined') {
    return this._each(onItem);
  } else {
    return this._throttledEach(onItem, throttler);
  }
};

// TODO: deprecate and use non-static member instead?
StreamIterator.each = function (streamIterator, onItem, throttler) {
  // Use streamIterator._each so that we can extend the functionality
  return streamIterator._each(onItem, throttler);
};

StreamIterator.prototype.setStream = function (stream) {
  this._stream = stream;
  this._listenToStream();
};

StreamIterator.prototype._onData = function (data) {
  this._stream.pause();
  this._item(data);
};

StreamIterator.prototype._listenToStream = function () {
  var self = this;
  self._stream
    .on('data', function (data) {
      self._onData(data);
    })
    .on('end', function () {
      self._end();
    })
    .on('error', function (err) {
      self.emit('error', err);
    })
    .on('connect', function () {
      self.emit('connect');
    });
};

StreamIterator.prototype._item = function (data) {
  this.emit('item', data);
};

StreamIterator.prototype.next = function () {
  this._stream.resume();
};

StreamIterator.prototype._end = function () {
  this.emit('end');
};

StreamIterator.prototype.abort = function () {
  // Does the stream exist? It may not if we have yet to connect
  if (this._stream) {
    this._stream.aborted = true;
  }

  this._end();
};

StreamIterator.prototype.onError = function (err) {
  this.emit('error', err);
};

StreamIterator.prototype.toStream = function () {
  var self = this,
    stream = new events.EventEmitter();

  self.on('item', function (item) {
    stream.emit('data', item);
  });

  self.on('end', function () {
    stream.emit('end');
  });

  self.on('error', function (err) {
    stream.emit('error', err);
  });

  self.on('connect', function () {
    stream.emit('connect');
  });

  stream.pause = function () {
    // Pass call to underlying stream so that the flow can be controlled
    self._stream.pause();
  };

  stream.resume = function () {
    // Pass call to underlying stream so that the flow can be controlled
    self._stream.resume();
  };

  return stream;
};

StreamIterator.prototype.pipe = function (streamIterator) {
  // Use streams to link the two iterators
  streamIterator.setStream(this.toStream());

  // Support chaining
  return streamIterator;
};

module.exports = StreamIterator;
