'use strict';

var FakedJSONRequest = require('./faked-json-request'),
  PersistentStreamIterator = require('../../scripts/persistent-stream-iterator'),
  inherits = require('inherits');

describe('persistent-stream-iterator', function () {

  var expItems = [{
      foo: 'bar'
    },
    {
      yar: 'nar'
    }
  ];

  it('should read items', function () {
    var readItems = [];
    var request = new FakedJSONRequest(expItems);
    var iterator = new PersistentStreamIterator(null, '*', false, request.requestFactory());

    return iterator.each(function (item) {
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
    var request = new FakedJSONRequest(items);
    var iterator = new PersistentStreamIterator(null, '*', false, request.requestFactory());

    return iterator.each(function (item) {
      readItems.push(item);
    }).then(function () {
      readItems.should.eql(expItems);
    });
  });

  it('should throw when JSON error', function () {
    var items = [{
        foo: 'bar'
      },
      {
        $raw: 'some-bad-JSON'
      },
      {
        yar: 'nar'
      }
    ];

    var readItems = [];
    var request = new FakedJSONRequest(items);
    var iterator = new PersistentStreamIterator(null, '*', false, request.requestFactory());

    // TODO: modify sporks.shouldThrow to also accept regex so that can clean up logic below
    var hasError = false;

    return iterator.each(function (item) {
      readItems.push(item);
    }).catch(function (err) {
      if (/Invalid JSON/.test(err.message)) {
        hasError = true;
      }
    }).then(function () {
      readItems.should.eql([items[0]]);
      hasError.should.eql(true);
    });
  });

  it('should abort', function () {
    var readItems = [];
    var request = new FakedJSONRequest(expItems);
    var iterator = new PersistentStreamIterator(null, '*', false, request.requestFactory());

    return iterator.each(function (item) {
      readItems.push(item);
      iterator.abort();
    }).then(function () {
      request.aborted.should.eql(true);
      readItems.should.eql([expItems[0]]);
    });
  });

  it('should abort when no request and no stream', function () {
    var request = new FakedJSONRequest(expItems);

    var FakedPersistentStreamIterator = function () {
      PersistentStreamIterator.apply(this, arguments);
    };
    inherits(FakedPersistentStreamIterator, PersistentStreamIterator);
    FakedPersistentStreamIterator.prototype._create = function () {};

    var iterator = new FakedPersistentStreamIterator(null, '*', false, request.requestFactory());

    iterator.abort();
  });

});
