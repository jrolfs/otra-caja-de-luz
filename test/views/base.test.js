import test from 'ava-spec';

import Base from '../../src/javascript/views/Base';
import EventEmitter from '../../src/javascript/mixins/EventEmitter';


const describe = test.describe;
const subject = 'base/View';

test.beforeEach(t => {
  t.context.build = (options = {}) => {
    return new Base(options);
  };

  t.context.extend = (prototype, options = {}) => {
    var ExtendedBase = function (options) {
      Base.call(this, options);
    };

    ExtendedBase.prototype = Object.create(Base.prototype);
    ExtendedBase.prototype.constructor = Base;

    Object.assign(ExtendedBase.prototype, prototype);

    return new ExtendedBase(options);
  };
});

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

describe(`${subject} templating`, it => {

  const assertTemplate = (t, view) => {
    const nodes = view.node.childNodes;

    t.true(nodes.length === 2);

    const [ node1, node2 ] = nodes;

    t.true(node1 instanceof window.HTMLDivElement);
    t.true(node2 instanceof window.HTMLSpanElement);

    t.true(node1.className === 'foo');
    t.true(node2.className === 'bar');

    t.true(node1.textContent === 'Foo');
    t.true(node2.textContent === 'Bar');
  };

  it('renders a simple template', t => {
    const view = t.context.extend({
      template: () => [
        '<div class="foo">Foo</div>',
        '<span class="bar">Bar</span>'
      ]
    }).render();

    assertTemplate(t, view);
  });

  it('interpolates data into template', t => {
    const view = t.context.extend({
      template: function () {
        return [
          '<div class="', this.foo.toLowerCase(), '">', this.foo, '</div>',
          '<span class="', this.bar.toLowerCase(), '">', this.bar, '</span>'
        ];
      }
    }, {
      data: {
        foo: 'Foo',
        bar: 'Bar'
      }
    }).render();

    assertTemplate(t, view);
  });

  it('escapes interpolated data', t => {
    const view = t.context.extend({
      template: function () { return [this.foo.bad]; }
    }, {
      data: { foo: { bad: '<script></script>' } }
    }).render();

    t.true(view.node.innerHTML === '&lt;script&gt;&lt;/script&gt;');
  });

  it('throws an error when #template does not return an array', t => {
    const view = t.context.extend({ template: () => { 'not-template'; } });

    t.throws(() => view.render(), /must\sreturn.*array/);
  });
});
