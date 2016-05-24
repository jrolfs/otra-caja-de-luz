import test from 'ava';

import Base from '../../src/javascript/views/Base';


test('Test test, please ignore', t => {
  const base = new Base({ test: 'test' });

  t.is(base.getTest(), 'test');
});
