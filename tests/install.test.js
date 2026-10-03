// Lancer : node --test tests/install.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectPlatform, installMode, shouldRemind, REMIND_AFTER_DAYS } = require('../install.js');

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
};
const browser = () => ({ matches: false });
const installed = () => ({ matches: true });

test('système détecté d\'après le navigateur', () => {
  assert.equal(detectPlatform({ userAgent: UA.android }, browser).os, 'android');   // Android avant Linux
  assert.equal(detectPlatform({ userAgent: UA.iphone }, browser).os, 'ios');
  assert.equal(detectPlatform({ userAgent: UA.windows }, browser).os, 'windows');
  assert.equal(detectPlatform({ userAgent: UA.mac, platform: 'MacIntel', maxTouchPoints: 0 }, browser).os, 'mac');
  assert.equal(detectPlatform({ userAgent: UA.linux }, browser).os, 'linux');
  assert.equal(detectPlatform({ userAgent: 'inconnu' }, browser).os, 'other');
});

test('un iPad (qui se présente comme un Mac) est reconnu grâce à l\'écran tactile', () => {
  assert.equal(detectPlatform({ userAgent: UA.ipad, platform: 'MacIntel', maxTouchPoints: 5 }, browser).os, 'ios');
});

test('installée : mode standalone (matchMedia) ou navigator.standalone (iOS)', () => {
  assert.equal(detectPlatform({ userAgent: UA.android }, installed).standalone, true);
  assert.equal(detectPlatform({ userAgent: UA.iphone, standalone: true }, browser).standalone, true);
  assert.equal(detectPlatform({ userAgent: UA.iphone, standalone: false }, browser).standalone, false);
  assert.equal(detectPlatform({ userAgent: UA.android }, null).standalone, false);   // pas de matchMedia
});

test('quoi proposer : bouton, tutoriel iOS, ou rien', () => {
  const web = os => ({ os, standalone: false });
  assert.equal(installMode(web('android'), true), 'prompt');
  assert.equal(installMode(web('windows'), true), 'prompt');
  assert.equal(installMode(web('ios'), false), 'ios-tuto');
  assert.equal(installMode(web('android'), false), 'none', 'sans événement du navigateur, on ne promet rien');
  assert.equal(installMode(web('mac'), false), 'none');
  assert.equal(installMode({ os: 'android', standalone: true }, true), 'none', 'déjà installée');
  assert.equal(installMode({ os: 'ios', standalone: true }, false), 'none');
});

test('rappel : tout de suite si jamais fermé, puis seulement après une semaine', () => {
  const day = 24 * 3600 * 1000, now = 1000 * day;
  assert.equal(shouldRemind(null, now), true);
  assert.equal(shouldRemind(now - 2 * day, now), false);
  assert.equal(shouldRemind(now - REMIND_AFTER_DAYS * day, now), true);
});
