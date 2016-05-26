import { describe } from 'ava-spec';

import Base from '../../src/javascript/views/Base';
import EventEmitter from '../../src/javascript/mixins/EventEmitter';


describe('base/View', it => {

  it('mixes in EventEmitter', t => {
    const base = new Base();

    t.plan(Object.keys(EventEmitter).length);

    for (let method in EventEmitter) {
      t.is(base[method], EventEmitter[method]);
    }
  });

  it('assigns "nodeName" from options', t => {
    const base = new Base({ nodeName: 'li' });

    t.is(base.nodeName, 'li');
  });

  it('defaults "nodeName" to "div"', t => {
    const base = new Base();

    t.is(base.nodeName, 'div');
  });

  it('creates root node', t => {
    const base = new Base();

    t.true(base.node instanceof window.HTMLDivElement);
  });

  it('creates root node using custom "nodeName"', t => {
    const base = new Base({ nodeName: 'span' });

    t.true(base.node instanceof window.HTMLSpanElement);
  });

  it('throws an error when custom "nodeName" is invalid', async t => {
    const error = await t.throws(function () { new Base({ nodeName: 'invalid' }); });

    t.true(/invalid nodeName/i.test(error.message));
  });
});
