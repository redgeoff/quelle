'use strict';

var MemoryStream = require('memorystream');

var FakedJSONRequest = function (items) {
  this._items = items;
  this._i = 0;
  this._stream = new MemoryStream();
};

FakedJSONRequest.prototype._writeNextItems = function () {
  var j = 0;

  if (this._i === 0) {
    this._stream.write('[');
  }

  // Resume from where we left off
  while (this._i < this._items.length) {
    // // TODO: construct for simulating errors by including an error item
    // if (item.$error) {
    //   this._stream.emit('error', ???);
    // } else {
    //
    // }

    // Not first item?
    if (j++ > 0) {
      this._stream.write(',');
    }

    this._stream.write(JSON.stringify(this._items[this._i]));
    this._i++;
  }

  if (this._i === this._items.length) {
    this._stream.write(']');
    this._stream.end();
  }
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
