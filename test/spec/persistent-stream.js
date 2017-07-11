'use strict';

var quelle = require('../../scripts'),
  PersistentStream = quelle.PersistentStream,
  sporks = require('sporks'),
  events = require('events'),
  stream = require('stream'),
  JSONStream = require('JSONStream'),
  Promise = require('sporks/scripts/promise'),
  MemoryStream = require('memorystream');

describe('persistent-stream', function () {

  var persistentStream = null;

  beforeEach(function () {
    persistentStream = new PersistentStream();
  });

  it('should pipe errors to', function () {

    var emitter = new events.EventEmitter(),
      foo = {
        bar: 'yar'
      };

    persistentStream.pipeErrorsTo(emitter);

    var onError = sporks.once(emitter, 'error');

    persistentStream.emit('error', foo);

    return onError.then(function (args) {
      args[0].should.eql(foo);
    });
  });

  it('should handle invalid JSON', function () {

    return new Promise(function (resolve) {

      var s = new stream.Readable();
      s.push(
        '{ "total_rows": 2, "rows": [{ "foo": "bar" }, { "bad": bad }, { "yup": "oo" }  ] }'
      );
      s.push(null);

      var parser = JSONStream.parse('rows.*');

      s.pipe(parser).on('error', function (err) {
        (persistentStream._shouldReconnect(err) === true).should.eql(true);
        resolve();
      });

    });

  });

  it('should not connect when aborted', function () {

    persistentStream._aborted = true;

    persistentStream.setStreamFactory(function () {
      return new stream.Readable();
    });

    persistentStream._reconnect();

  });

  it('should connect when end of stream and listening indefinitely', function () {
    persistentStream = new PersistentStream(true);

    persistentStream.setStreamFactory(function () {
      return new MemoryStream();
    });

    // Wait for first connect
    return sporks.once(persistentStream, 'connect').then(function () {
      persistentStream._stream.emit('end');

      // Wait for subsequent connect
      return sporks.once(persistentStream, 'connect');
    });
  });

  it('should not emit error when not reconnecting', function () {

    var err = new Error();

    // We need to listen for the error before generating the error or else our test will exit
    // prematurely
    var promise = sporks.once(persistentStream, 'error').then(function (errors) {
      errors[0].should.eql(err);
    });

    persistentStream.onError(err);

    return promise;
  });

});
