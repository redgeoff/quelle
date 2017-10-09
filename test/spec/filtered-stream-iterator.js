'use strict';

var FakedStreamIterator = require('./faked-stream-iterator'),
  FilteredStreamIterator = require('../../scripts/filtered-stream-iterator');

describe('filtered-stream-iterator', function () {

  var expItems = [{
      foo: 'bar'
    },
    {
      yar: 'nar'
    }
  ];

  it('should filter items', function () {
    var items = [{
        foo: 'bar'
      },
      {
        ignore: true,
        jar: 'aar'
      },
      {
        yar: 'nar'
      }
    ];

    var readItems = [];
    var iterator = new FilteredStreamIterator(new FakedStreamIterator(items), function (
      jsonItem) {
      var item = JSON.parse(jsonItem);
      return item.ignore ? undefined : item;
    });

    return iterator.each(function (item) {
      readItems.push(item);
    }).then(function () {
      readItems.should.eql(expItems);
    });
  });

  it('should allow all items when no onItem', function () {

    var readItems = [];
    var iterator = new FilteredStreamIterator(new FakedStreamIterator(expItems));

    return iterator.each(function (jsonItem) {
      var item = JSON.parse(jsonItem);
      readItems.push(item);
    }).then(function () {
      readItems.should.eql(expItems);
    });
  });

  it('should abort', function () {
    var readItems = [];
    var iterator = new FilteredStreamIterator(new FakedStreamIterator(expItems));

    return iterator.each(function (jsonItem) {
      var item = JSON.parse(jsonItem);
      readItems.push(item);
      iterator.abort();
    }).then(function () {
      readItems.should.eql([expItems[0]]);
    });
  });

});
