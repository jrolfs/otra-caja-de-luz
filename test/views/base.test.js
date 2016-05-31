import test from 'ava-spec';
import sinon from 'sinon';
import simulant from 'simulant';

import Base from '../../src/javascript/views/Base';
import EventEmitter from '../../src/javascript/mixins/EventEmitter';


const describe = test.describe;
const subject = 'base/View';

test.beforeEach(t => {
  t.context.build = (options = {}) => {
    return new Base(options);
  };

  t.context.extend = (prototype, options = {}, constructor) => {
    var ExtendedBase = constructor || function (options) {
      Base.call(this, options);
    };

    ExtendedBase.prototype = Object.create(Base.prototype);
    ExtendedBase.prototype.constructor = ExtendedBase;

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

    t.true(view.node instanceof HTMLDivElement);
  });

  it('creates root node using custom "nodeName"', t => {
    const view = t.context.build({ nodeName: 'span' });

    t.true(view.node instanceof HTMLSpanElement);
  });

  it('throws an error when custom "nodeName" is invalid', async t => {
    const error = await t.throws(function () { t.context.build({ nodeName: 'invalid' }); });

    t.true(/invalid nodeName/i.test(error.message));
  });

  it('adds className to root node', t => {
    const view = t.context.extend({ className: 'my-view' });

    t.true(view.node.className === 'my-view');
  });

  it('adds provided className option to root node', t => {
    const view = t.context.build({ className: 'my-view' });

    t.true(view.node.className === 'my-view');
  });
});

describe(`${subject} templating`, it => {

  const assertTemplate = (t, view) => {
    const nodes = view.node.childNodes;

    t.true(nodes.length === 2);

    const [ node1, node2 ] = nodes;

    t.true(node1 instanceof HTMLDivElement);
    t.true(node2 instanceof HTMLSpanElement);

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

  it('passes view instance to template', t => {
    const template = sinon.spy((view) => []);
    const view = t.context.extend({ template }).render();

    t.true(template.calledWith(view));
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

    t.throws(() => view.render(), /must\sreturn.*array/i);
  });
});

describe(`${subject} rendering`, it => {
  it('unbinds events from children', t => {
    const view = t.context.extend({
      addChildren: function () {
        var child1 = this.child1 = new Base().render();
        var child2 = this.child2 = new Base().render();

        this.bind(child1, 'foo', this.onChildFoo);
        this.bind(child2, 'bar', this.onChildBar);

        this.node.appendChild(child1.node);
        this.node.appendChild(child2.node);

        return [child1, child2];
      },
      onChildFoo: sinon.spy(),
      onChildBar: sinon.spy(),
      onThingChange: sinon.spy()
    },
    null,
    function (options) {
      Base.call(this, options);

      this.thing = new (Object.assign(function() {}.prototype, EventEmitter)).constructor;
      this.bind(this.thing, 'change', this.onThingChange);
    }).render();

    const [firstChild1, firstChild2] = view._children;

    view.thing.trigger('change');
    firstChild1.trigger('foo');
    firstChild2.trigger('bar');

    t.true(view.onChildFoo.calledOnce);
    t.true(view.onChildBar.calledOnce);
    t.true(view.onThingChange.calledOnce);

    view.render();

    view.thing.trigger('change');
    firstChild1.trigger('foo');
    firstChild2.trigger('bar');

    t.true(view.onChildFoo.calledOnce);
    t.true(view.onChildBar.calledOnce);
    t.true(view.onThingChange.calledTwice);
  });

  it('adds children if function is defined', t => {
    const view = t.context.extend({ addChildren: sinon.spy() }).render();

    t.true(view.addChildren.calledOnce);
  });
});

describe(`${subject} event handling`, it => {

  it('handles events on bound to root node', t => {
    const view = t.context.extend({
      listeners: function () {
        return {
          keyup: this.onKeyUp,
          click: this.onClick
        };
      },
      onKeyUp: sinon.spy(),
      onClick: sinon.spy()
    }).render();

    simulant.fire(view.node, 'keyup');
    simulant.fire(view.node, 'click');

    t.true(view.onKeyUp.calledOnce);
    t.true(view.onClick.calledOnce);
  });

  it('binds listeners on root node to instance context', t => {
    const view = t.context.extend({
      listeners: function () { return { keyup: this.onKeyUp }; },
      onKeyUp: function (event)  {
        t.is(this, view);
      }
    }).render();

    simulant.fire(view.node, 'keyup');
  });

  it('handles events on bound to child nodes', t => {
    const view = t.context.extend({
      template: () => [
        '<div class="foo" data-event-id="click-foo">Foo</div>',
        '<span class="bar" data-event-id="hover-bar">Bar</span>',
        '<span class="baz">Bar</span>'
      ],
      listeners: function () {
        return {
          click: { id: 'click-foo', listener: this.onFooClick },
          mouseover: { id: 'hover-bar', listener: this.onBarMouseover }
        };
      },
      onFooClick: sinon.spy(),
      onBarMouseover: sinon.spy()
    }).render();

    const baz = view.node.getElementsByClassName('baz')[0];

    simulant.fire(view.node, 'click');
    simulant.fire(view.node, 'mouseover');
    simulant.fire(baz, 'click');
    simulant.fire(baz, 'mouseover');
    simulant.fire(view.node.getElementsByClassName('foo')[0], 'click');
    simulant.fire(view.node.getElementsByClassName('bar')[0], 'mouseover');

    t.true(view.onFooClick.calledOnce);
    t.true(view.onBarMouseover.calledOnce);
  });

  it('passes event to handlers bound to child nodes', t => {
    const view = t.context.extend({
      template: () => [ '<div class="foo" data-event-id="click-foo">Foo</div>'],
      listeners: function () {
        return { click: { id: 'click-foo', listener: this.onFooClick } };
      },
      onFooClick: sinon.spy((event) => {
        t.true(event instanceof Event);
      })
    }).render();

    simulant.fire(view.node.getElementsByClassName('foo')[0], 'click');
  });

  it('throws an error when event id is invalid', t => {
    t.throws(() => {
      t.context.extend({
        listeners: function () { return { click: { id: null } }; }
      });
    }, /must.*valid.*event id/i);
  });

  it('throws an error when event listener is invalid', t => {
    t.throws(() => {
      t.context.extend({
        listeners: function () { return { click: { id: 'foo', listener: this.onFooClick } }; }
      });
    }, /must.*valid.*listener/i);
  });
});

describe(`${subject} removal`, it => {

  const assertRemoval = (t, view) => {
    document.body.appendChild(view.node);
    t.is(document.body.children.length, 1);

    view.remove();

    t.is(document.body.children.length, 0);
  };

  it('removes root node via Element.remove', t => {
    const view = t.context.build();

    assertRemoval(t, view);
  });

  it('removes root node when Element.remove does not exist', t => {
    const view = t.context.build();

    view.node.remove = 'not-implemented';

    assertRemoval(t, view);
  });

  it('removes any children', t => {
    const view = t.context.extend({
      addChildren: function () {
        var child1 = this.child1 = new Base().render();
        var child2 = this.child2 = new Base().render();

        sinon.spy(child1, 'remove');
        sinon.spy(child2, 'remove');

        this.node.appendChild(child1.node);
        this.node.appendChild(child2.node);

        return [child1, child2];
      }
    }).render();

    view.remove();

    t.is(view._children.length, 0);
    t.true(view.child1.remove.calledOnce);
    t.true(view.child2.remove.calledOnce);
  });

  it('unbinds all events', t => {
    const view = t.context.build();

    sinon.spy(view, 'unbindAll');
    view.remove();

    t.true(view.unbindAll.calledOnce);
  });
});

describe(`${subject} children`, it => {

  it('stores children returned from addChildren', t => {
    const view = t.context.extend({
      addChildren: function () {
        var child1 = this.child1 = new Base().render();
        var child2 = this.child2 = new Base().render();

        this.node.appendChild(child1.node);
        this.node.appendChild(child2.node);

        return [child1, child2];
      }
    }).render();

    t.is(view._children.length, 2);
    t.is(view._children[0], view.child1);
    t.is(view._children[1], view.child2);
  });
});

describe(`${subject} bindings`, it => {

  const buildViewWithBindings = (t) => {
    return t.context.extend({
      addChildren: function () {
        var child1 = this.child1 = new Base().render();
        var child2 = this.child2 = new Base().render();

        this.bind(child1, 'foo', this.onChildFoo);
        this.bind(child1, 'bar', this.onChildBar);
        this.bind(child2, 'baz', this.onChildBaz);

        this.node.appendChild(child1.node);
        this.node.appendChild(child2.node);

        return [child1, child2];
      },
      onChildFoo: sinon.spy(),
      onChildBar: sinon.spy(),
      onChildBaz: sinon.spy()
    }).render();
  };

  it('binds event to target', t => {
    const view = buildViewWithBindings(t);

    view.child1.trigger('foo');

    t.true(view.onChildFoo.calledOnce);
  });

  it('removes event from target when provided event', t => {
    const view = buildViewWithBindings(t);

    view.unbind(view.child1, 'foo');
    view.child1.trigger('foo');
    view.child1.trigger('bar');

    t.false(view.onChildFoo.calledOnce);
    t.true(view.onChildBar.calledOnce);
  });

  it('removes event from target when provided event and callback', t => {
    const view = buildViewWithBindings(t);

    view.unbind(view.child1, 'foo', view.onChildFoo);
    view.child1.trigger('foo');
    view.child1.trigger('bar');

    t.false(view.onChildFoo.calledOnce);
    t.true(view.onChildBar.calledOnce);
  });

  it('removes all events from target', t => {
    const view = buildViewWithBindings(t);

    view.unbind(view.child1);
    view.child1.trigger('foo');
    view.child1.trigger('bar');
    view.child2.trigger('baz');

    t.false(view.onChildFoo.calledOnce);
    t.false(view.onChildBar.calledOnce);
    t.true(view.onChildBaz.calledOnce);
  });

  it('unbindAll unbinds all events', t => {
    const view = buildViewWithBindings(t);

    view.unbindAll();
    view.child1.trigger('foo');
    view.child1.trigger('bar');
    view.child2.trigger('baz');

    t.false(view.onChildFoo.calledOnce);
    t.false(view.onChildBar.calledOnce);
    t.false(view.onChildBaz.calledOnce);
  });
});
