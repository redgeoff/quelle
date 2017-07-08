'use strict';

var FakedJSONRequest = require('./faked-json-request'),
  PersistentStreamIterator = require('../../scripts/persistent-stream-iterator');

var MemoryStream = require('memorystream'),
  JSONStream = require('JSONStream');

describe('persistent-stream-iterator', function () {

  it('should read items', function () {
    var items = [
      { foo: 'bar' },
      { yar: 'nar' }
    ];

    var readItems = [];

    var request = new FakedJSONRequest(items);

    var iterator = new PersistentStreamIterator(null, '*', false, request.requestFactory());

    return iterator.each(function (item) {
      readItems.push(item);
    }).then(function () {
      readItems.should.eql(items);
    });
  });

});
