'use strict';

var StreamIterator = require('../../scripts/stream-iterator'),
  inherits = require('inherits'),
  MemoryStream = require('memorystream');

var FakedStreamIterator = function (items) {
  StreamIterator.apply(this, arguments);

  this._items = items;

  // Fake stream
  var stream = new MemoryStream();
  var self = this;
  this.aborted = false;
  stream.abort = function () {
    self.aborted = true;
  };
  this.setStream(stream);

  // Emit on next tick so that callers have a chance to bind
  this._emitItemsOnNextTick();
};

inherits(FakedStreamIterator, StreamIterator);

FakedStreamIterator.prototype._emitItems = function () {
  var self = this;

  var n = 0;

  self._items.forEach(function (item) {
    if (!item.$error) {
      n++;
    }
  });

  var j = 0;

  // Trigger end after we have finished writing all items. TODO: this is needed, but should it be?
  // Should there be better handling in StreamIterator?
  self.on('item', function ( /* item */ ) {
    if (++j === n) {
      self._stream.end();
    }
  });

  var i = 0;

  self._items.forEach(function (item) {
    if (item.$error) {
      var err = new Error();
      err.code = item.$error.code;
      self._stream.emit('error', err);
    } else {
      i++;
      self._stream.write(JSON.stringify(item));
    }
  });
};

FakedStreamIterator.prototype._emitItemsOnNextTick = function () {
  var self = this;
  setTimeout(function () {
    self._emitItems();
  });
};

module.exports = FakedStreamIterator;
