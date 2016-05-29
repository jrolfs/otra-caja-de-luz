import test from 'ava-spec';

import Base from '../../src/javascript/views/Base';
import EventEmitter from '../../src/javascript/mixins/EventEmitter';


const describe = test.describe;
const subject = 'base/View';

test.beforeEach(t => {
  t.context.build = (options = {}) => {
    return new Base(options);
  };

describe(`${subject} mixins`, it => {

  it('mixes in EventEmitter', t => {
    const view = t.context.build();

    t.plan(Object.keys(EventEmitter).length);

    for (let method in EventEmitter) {
      t.is(view[method], EventEmitter[method]);
    }
  });
});

describe(`${subject} initialization`, it => {

  it('assigns "nodeName" from options', t => {
    const view = t.context.build({ nodeName: 'li' });

    t.is(view.nodeName, 'li');
  });

  it('defaults "nodeName" to "div"', t => {
    const view = t.context.build();

    t.is(view.nodeName, 'div');
  });

  it('creates root node', t => {
    const view = t.context.build();

    t.true(view.node instanceof window.HTMLDivElement);
  });

  it('creates root node using custom "nodeName"', t => {
    const view = t.context.build({ nodeName: 'span' });

    t.true(view.node instanceof window.HTMLSpanElement);
  });

  it('throws an error when custom "nodeName" is invalid', async t => {
    const error = await t.throws(function () { t.context.build({ nodeName: 'invalid' }); });

    t.true(/invalid nodeName/i.test(error.message));
  });
});
