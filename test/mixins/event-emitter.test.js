import test from 'ava-spec';
import sinon from 'sinon';
import assign from 'object-assign';

import EventEmitter from '../../src/javascript/mixins/EventEmitter';


const describe = test.describe;

test.beforeEach(t => {
  let TestConstructor = function () {};

  assign(TestConstructor.prototype, EventEmitter);

  t.context.emitter = new TestConstructor();
  t.context.callbacks = [...Array(3)].map(() => sinon.spy());
});

describe('mixins/EventEmitter', it => {

  describe('#on', it => {
    it('binds events across many names', t => {
      const emitter = t.context.emitter;
      const [callback1, callback2] = t.context.callbacks;

      emitter.on('event1', callback1);
      emitter.on('event2', callback2);

      emitter.trigger('event1');
      emitter.trigger('event2');

      t.true(callback1.calledOnce);
      t.true(callback2.calledOnce);
    });

    it('binds events with multiple, unique callbacks', t => {
      const emitter = t.context.emitter;
      const [callback1, callback2] = t.context.callbacks;

      emitter.on('event1', callback1);
      emitter.on('event1', callback2);

      emitter.trigger('event1');

      t.true(callback1.calledOnce);
      t.true(callback2.calledOnce);
    });

    it('binds events with multiple, non-unique callbacks', t => {
      const emitter = t.context.emitter;

      const callback = sinon.spy();

      emitter.on('event1', callback);
      emitter.on('event1', callback);

      emitter.trigger('event1');

      t.true(callback.calledTwice);
    });

    it('does not throw an error when no events have been registerd', t => {
      t.notThrows(() => t.context.emitter.trigger('unregistered'));
    });

    it('does not throw an error when supplied event has not been registerd', t => {
      const emitter = t.context.emitter;

      emitter.on('registered', () => {});

      t.notThrows(() => t.context.emitter.trigger('unregistered'));
    });
  });

  describe('#off', function() {
    it('removes all events by an eventName when no callback is provided', t => {
      const emitter = t.context.emitter;
      const [callback1, callback2, callback3] = t.context.callbacks;

      emitter.on('event1', callback1);
      emitter.on('event1', callback2);
      emitter.on('event2', callback3);
      emitter.off('event1');

      emitter.trigger('event1');
      emitter.trigger('event2');

      t.false(callback1.called);
      t.false(callback2.called);
      t.true(callback3.calledOnce);
    });

    it('removes only events that match an eventName and callback', t => {
      const emitter = t.context.emitter;
      const [callback1, callback2] = t.context.callbacks;

      emitter.on('event1', callback1);
      emitter.on('event1', callback2);
      emitter.off('event1', callback1);

      emitter.trigger('event1');

      t.false(callback1.called);
      t.true(callback2.calledOnce);
    });

    it('does not throw error when attempting to remove a non-existant callback', t => {
      const emitter = t.context.emitter;
      const [callback1, callback2] = t.context.callbacks;

      emitter.off('event1', callback1);
      emitter.trigger('event1');

      t.false(callback1.called);

      emitter.on('event1', callback1);
      emitter.off('event1', callback2);

      emitter.trigger('event1');

      t.true(callback1.calledOnce);
      t.false(callback2.calledOnce);
    });
  });

  return describe('trigger', function() {
    it('triggers callbacks in the order that they were registered', t => {
      const emitter = t.context.emitter;
      const [callback1, callback2, callback3] = t.context.callbacks;

      emitter.on('event1', callback1);
      emitter.on('event1', callback2);
      emitter.on('event1', callback3);

      emitter.trigger('event1');

      t.true(callback1.calledBefore(callback2));
      t.true(callback2.calledBefore(callback3));
    });


    it('triggers callback with arguments passed to trigger', t => {
      const emitter = t.context.emitter;
      const [argument1, argument2, argument3] = [10, 20, 30];
      const callback = sinon.spy();

      emitter.on('event1', callback);
      emitter.trigger('event1', argument1, argument2, argument3);

      t.true(callback.calledWith(argument1, argument2, argument3));
    });

    it('invokes callback with provided context', t => {
      const emitter = t.context.emitter;
      const callback = sinon.spy();
      const context = { foo: 'bar' };

      emitter.on('event1', callback, context);
      emitter.trigger('event1');

      t.true(callback.calledOn(context));
    });

    return it('invokes callbacks without provided context in context of itself', t => {
      const emitter = t.context.emitter;
      const callback = sinon.spy();

      emitter.on('event1', callback);
      emitter.trigger('event1');

      t.true(callback.calledOn(emitter));
    });
  });
});
