import test from 'ava-spec';
import sinon from 'sinon';

import Base from '../../src/javascript/views/Base';
import Gallery from '../../src/javascript/views/Gallery';
import imgur from '../../src/javascript/utils/adapters/imgur';


const describe = test.describe;
const subject = 'views/Gallery';

test.beforeEach(t => {
  t.context.server = sinon.fakeServer.create();

  t.context.build = (options = {}) => {
    options = Object.assign({ adapter: imgur({ url: 'foo', id: 'bar' }) }, options);
    return new Gallery(options);
  };
});

test.afterEach(t => {
  t.context.server.restore();
});

describe(`${subject} initialization`, it => {
  it('extends base view', t => {
    t.true(t.context.build() instanceof Base);
  });
});

describe(`${subject} loading`, it => {
  it('displays loading element', t => {
    const view = t.context.build().render();

    t.is(view.node.children.length, 1);
    t.regex(view.node.children[0].className, /loading/);
  });
});
