import test from 'ava-spec';
import sinon from 'sinon';
import simulant from 'simulant';

import Base from '../../src/javascript/views/Base';
import Gallery from '../../src/javascript/views/Gallery';


const describe = test.describe;
const subject = 'views/Gallery';

test.beforeEach(t => {
  t.context.build = (options = {}) => {
    return new Gallery(options);
  };
});

describe(`${subject} initialization`, it => {
  it('extends base view', t => {
    t.true(t.context.build() instanceof Base);
  });
});
