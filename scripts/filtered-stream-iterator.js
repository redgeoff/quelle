'use strict';

var StreamIterator = require('./stream-iterator'),
  inherits = require('inherits'),
  Promise = require('sporks/scripts/promise');

// onItem can be a promise factory or just a factory. It should return null when the item should be
// filtered out.
var FilteredStreamIterator = function (streamIterator, onItem) {
  this._streamIterator = streamIterator;
  this._onItem = onItem;

  // Pipe data so that we can filter it in FilteredStreamIterator
  streamIterator.pipe(this);
};

inherits(FilteredStreamIterator, StreamIterator);

FilteredStreamIterator.prototype._onData = function (data) {
  var self = this;

  // Wrap in Promise as onItem may or may not be a promise
  return Promise.resolve().then(function () {
    return self._onItem ? self._onItem(data) : data;
  }).then(function (data) {
    if (data !== undefined) { // include?
      StreamIterator.prototype._onData.apply(self, arguments);
    } else {
      // Progress the stream while skipping the item
      StreamIterator.prototype.next.apply(self, arguments);
    }
  });
};

module.exports = FilteredStreamIterator;
