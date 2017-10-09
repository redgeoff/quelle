'use strict';

var FakedStreamIterator = require('./faked-stream-iterator'),
  Throttler = require('squadron').Throttler,
  sporks = require('sporks');

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

  it('should handle error when processing item', function () {
    var err = new Error('some error');
    var iterator = new FakedStreamIterator(expItems);

    return sporks.shouldThrow(function () {
      return iterator.each(function () {
        throw err;
      });
    }, err);
  });

  it('should throttle when reading items', function () {
    var readItems = [];
    var iterator = new FakedStreamIterator(expItems);
    var throttler = new Throttler();

    return iterator.each(function (jsonItem) {
      var item = JSON.parse(jsonItem);
      readItems.push(item);
    }, throttler).then(function () {
      readItems.should.eql(expItems);
    });
  });

  it('should wait for process done when throttling', function () {

    var items = [{
        foo: 'bar'
      },
      {
        yar: 'nar'
      },
      {
        jar: 'aar'
      }
    ];

    var readItems = [];
    var iterator = new FakedStreamIterator(items);
    var throttler = new Throttler(1);

    return iterator.each(function (jsonItem) {
      var item = JSON.parse(jsonItem);
      readItems.push(item);

      // Delay to allow for time for items to get backlogged
      return sporks.timeout(100);
    }, throttler).then(function () {
      readItems.should.eql(items);
    });
  });

  it('should handle an error when throttling', function () {
    var err = new Error('some error');
    var iterator = new FakedStreamIterator(expItems);
    var throttler = new Throttler();

    return sporks.shouldThrow(function () {
      return iterator.each(function () {
        throw err;
      }, throttler);
    }, err);
  });

  it('should pass error to stream', function () {
    var err = new Error('some error');
    var iterator = new FakedStreamIterator(expItems);

    var stream = iterator.toStream();

    var promise = sporks.once(stream, 'error').then(function (errors) {
      errors[0].should.eql(err);
    });

    iterator.emit('error', err);

    return promise;
  });

  it('should pass connect to stream', function () {
    var iterator = new FakedStreamIterator(expItems);

    var stream = iterator.toStream();

    var promise = sporks.once(stream, 'connect');

    iterator.emit('connect');

    return promise;
  });

});
