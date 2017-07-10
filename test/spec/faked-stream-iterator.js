'use strict';

var StreamIterator = require('../../scripts/stream-iterator'),
  inherits = require('inherits');

var FakedStreamIterator = function (items) {
  StreamIterator.apply(this, arguments);

  this._items = items;

  // Emit on next tick so that callers have a chance to bind
  this._emitItemsOnNextTick();
};

inherits(FakedStreamIterator, StreamIterator);

FakedStreamIterator.prototype._emitItems = function () {
  var self = this;

  self._items.forEach(function (item) {
    if (item.$error) {
      var err = new Error();
      err.code = item.$error.code;
      self.emit('error', err);
    } else {
      self.emit('item', item);
    }
  });

  self.emit('end');
};

FakedStreamIterator.prototype._emitItemsOnNextTick = function () {
  var self = this;
  setTimeout(function () {
    self._emitItems();
  });
};

module.exports = FakedStreamIterator;
