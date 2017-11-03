'use strict';

var MemoryStream = require('memorystream');

var FakedJSONRequest = function (items, delayMs) {
  this._items = items;
  this._delayMs = delayMs;
  this._i = 0;

  this.aborted = false;
  this._stream = new MemoryStream();
  var self = this;
  this._stream.abort = function () {
    self.aborted = true;
  };
};

FakedJSONRequest.prototype._writeNextItem = function () {
  if (this._i === 0) {
    this._stream.write('[');
  }

  var item = this._items[this._i];

  // Simulate an error?
  if (item.$error) {

    var err = new Error();
    err.code = item.$error.code;
    this._stream.emit('error', err);

  } else if (item.$raw) {

    // Raw data
    this._stream.write(item.$raw);

  } else {

    // Not first item?
    if (this._j++ > 0) {
      this._stream.write(',');
    }

    this._stream.write(JSON.stringify(item));

  }

  this._i++;

  if (this._i === this._items.length) {
    this._stream.write(']');
    this._stream.end();
  }
};

FakedJSONRequest.prototype._writeNextItemAfterDelay = function () {
  var self = this;

  // More items?
  if (self._i < this._items.length) {
    setTimeout(function () {
      self._writeNextItem();
      self._writeNextItemAfterDelay();
    }, self._delayMs);
  }
};

FakedJSONRequest.prototype._writeNextItems = function () {
  this._j = 0;
  this._writeNextItemAfterDelay();
};

FakedJSONRequest.prototype._request = function () {
  this._writeNextItems();
};

FakedJSONRequest.prototype.request = function () {
  var self = this,
    selfArguments = arguments;

  // Run on next tick so that there is time for callers to bind to the stream
  setTimeout(function () {
    self._request.apply(self, selfArguments);
  });

  return self._stream;
};

FakedJSONRequest.prototype.requestFactory = function () {
  var self = this;
  return function () {
    return self.request.apply(self, arguments);
  };
};

module.exports = FakedJSONRequest;
