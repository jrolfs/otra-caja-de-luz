import test from 'ava';

import Base from '../../src/javascript/views/Base';


test('assigns "nodeName" from options', t => {
  const base = new Base({ nodeName: 'li' });

  t.is(base.nodeName, 'li');
});

test('defaults "nodeName" to "div"', t => {
  const base = new Base();

  t.is(base.nodeName, 'div');
});

test('creates root node', t => {
  const base = new Base();

  t.true(base.node instanceof window.HTMLDivElement);
});
