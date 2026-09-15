import test from 'node:test';
import assert from 'node:assert/strict';
import { trackPrematchViewport } from '../src/utils/prematchViewport.js';

function fixture(withViewport = true) {
  const view = Object.assign(new EventTarget(), { innerHeight: 760 });
  if (withViewport) view.visualViewport = Object.assign(new EventTarget(), {
    height: 760, offsetTop: 0, scale: 1
  });
  const values = new Map();
  const style = { setProperty: (key, value) => values.set(key, value), removeProperty: (key) => values.delete(key) };
  return { view, values, style };
}

test('tracks keyboard resize and viewport panning, ignores pinch zoom, and cleans up', () => {
  const { view, values, style } = fixture();
  const stop = trackPrematchViewport(view, style);
  const viewport = view.visualViewport;
  assert.equal(values.get('--prematch-viewport-height'), '760px');
  viewport.height = 380;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(values.get('--prematch-viewport-height'), '380px');
  viewport.offsetTop = 46;
  viewport.dispatchEvent(new Event('scroll'));
  assert.equal(values.get('--prematch-viewport-top'), '46px');
  viewport.scale = 2;
  viewport.height = 190;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(values.get('--prematch-viewport-height'), '380px');
  viewport.scale = 1;
  viewport.height = 760;
  viewport.offsetTop = 0;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(values.get('--prematch-viewport-height'), '760px');
  stop();
  view.dispatchEvent(new Event('resize'));
  viewport.dispatchEvent(new Event('resize'));
  viewport.dispatchEvent(new Event('scroll'));
  assert.equal(values.size, 0);
});

test('older WebViews fall back to innerHeight and window resize', () => {
  const { view, values, style } = fixture(false);
  const stop = trackPrematchViewport(view, style);
  view.innerHeight = 360;
  view.dispatchEvent(new Event('resize'));
  assert.equal(values.get('--prematch-viewport-height'), '360px');
  assert.equal(values.get('--prematch-viewport-top'), '0px');
  stop();
  assert.equal(values.size, 0);
});
