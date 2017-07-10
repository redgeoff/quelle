'use strict';

var FakedStreamIterator = require('./faked-stream-iterator');

describe('stream-iterator', function () {

  var expItems = [{
      foo: 'bar'
    },
    {
      yar: 'nar'
    }
  ];

  it('should read items', function () {
    var readItems = [];
    var iterator = new FakedStreamIterator(expItems);

    return iterator.each(function (jsonItem) {
      var item = JSON.parse(jsonItem);
      readItems.push(item);
    }).then(function () {
      readItems.should.eql(expItems);
    });
  });

  it('should read items and handle error', function () {
    var items = [{
        foo: 'bar'
      },
      {
        $error: {
          code: 'ECONNREFUSED'
        }
      },
      {
        yar: 'nar'
      }
    ];

    var readItems = [];
    var iterator = new FakedStreamIterator(items);

    // TODO: modify sporks.shouldThrow to also accept regex so that can clean up logic below
    var hasError = false;

    return iterator.each(function (jsonItem) {
      var item = JSON.parse(jsonItem);
      readItems.push(item);
    }).catch(function (err) {
      if (err.code === 'ECONNREFUSED') {
        hasError = true;
      }
    }).then(function () {
      readItems.should.eql([expItems[0]]);
      hasError.should.eql(true);
    });
  });

});
