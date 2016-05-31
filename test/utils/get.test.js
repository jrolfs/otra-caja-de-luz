import test from 'ava-spec';
import sinon from 'sinon';

import get from '../../src/javascript/utils/get';


const describe = test.describe;
const subject = 'utils/get';

test.beforeEach(t => {
  t.context.server = sinon.fakeServer.create({ respondImmediately: true });
});

test.afterEach(t => {
  t.context.server.restore();
});

describe(`${subject}`, it => {
  it('parses succesful response', async t => {
    const url = 'some/api/v1/images.json';
    const headers = { Authorization: 'Bearer [Le-Token]' };
    const handler = sinon.spy();
    const server = t.context.server;

    const json = `[
      { "id": 1, "url": "image1.png", "title": "Image 1" },
      { "id": 2, "url": "image2.jpeg", "title": "Image 2" }
    ]`;
    const results = [
      { id: 1, url: 'image1.png', title: 'Image 1' },
      { id: 2, url: 'image2.jpeg', title: 'Image 2' }
    ];

    server.respondWith('GET', url, [200, { 'Content-Type': 'application/json' }, json]);

    await get(url, headers).then(handler);

    t.deepEqual(server.requests[0].requestHeaders, headers);
    t.true(handler.calledWith(results));
  });

  it('handles error', async t => {
    const url = 'some/api/v1/images.json';
    const handler = sinon.spy();

    t.context.server.respondWith('GET', url, [500, { 'Content-Type': 'application/json' }, 'error']);

    await get(url).catch(handler);

    t.true(handler.calledWith({ status: 500, message: 'Internal Server Error' }));
  });
});
