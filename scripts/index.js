'use strict';

var FilteredStreamIterator = require('./filtered-stream-iterator'),
  PersistentStream = require('./persistent-stream'),
  StreamIterator = require('./stream-iterator');

module.exports = {
  FilteredStreamIterator: FilteredStreamIterator,
  PersistentStream: PersistentStream,
  StreamIterator: StreamIterator
};
