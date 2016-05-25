import { describe } from 'ava-spec';

import Base from '../../src/javascript/views/Base';


describe('base/View', it => {

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
});
