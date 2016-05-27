import test from 'ava-spec';

import Escaper from '../../src/javascript/utils/Escaper';


const describe = test.describe;
const subject = 'utils/Escaper';

test.beforeEach(t => {
  t.context.unescaped = '<a href=\'javascript:bad&#39; href="foo`">';
  t.context.escaped = '&lt;a href=&#x27;javascript:bad&amp;#39; href=&quot;foo&#x60;&quot;&gt;';
});

describe(`${subject} #escape`, it => {
  it('escapes dangerous entities', t => {
    t.true(Escaper.escape(t.context.unescaped) === t.context.escaped);
  });
});

describe(`${subject} #escapeObject`, it => {
  it('escapes recursively', t => {
    const { unescaped, escaped } = t.context;
    const escapedObject = Escaper.escapeObject({
      foo: {
        bar: {
          baz: unescaped
        },
        baz: unescaped
      },
      baz: unescaped
    });

    t.deepEqual(escapedObject, {
      foo: {
        bar: {
          baz: escaped
        },
        baz: escaped
      },
      baz: escaped
    });
  });
});
