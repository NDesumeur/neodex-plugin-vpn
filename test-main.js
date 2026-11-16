// node test-main.js : le volet système avec un faux warp-cli et un faux tor.exe (rien n'est installé, aucun vrai proxy n'est posé)
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), m = require('./main.js');
assert.equal(m.geoCountry('# x\n16777216,16777471,AU\n16777472,16778239,CN\n', '1.0.1.5'), 'cn');
assert.equal(m.geoCountry('16777216,16777471,AU', '9.9.9.9'), null);
assert.equal(m.torVersions('<a href="15.0.9/"> <a href="16.0a14/"> <a href="16.0/"> <a href="15.0.10/">').join(), '16.0,15.0.10,15.0.9');
require('./pgp.js');  // ses propres vérifications (console.assert)
const fakeState = path.join(os.tmpdir(), 'neobase-fake-warp.json'); fs.rmSync(fakeState, { force: true });
const proxy = () => s1.last, mk = () => ({ last: 'direct', setProxy(p) { this.last = p.mode || p.proxyRules; return Promise.resolve(); },
  fetch: async u => ({ text: async () => 'ip=1.2.3.4\nloc=US', arrayBuffer: async () => (await new Promise(r => setTimeout(r, 40)), new ArrayBuffer(/__down/.test(u) ? 2000000 : 0)) }) }), s1 = mk(), s2 = mk();
let doc = {}, events = 0, disposed = null; const h = new Map(), cbs = [];
const api = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'neo-vpn-')), readDoc: n => doc[n], writeDoc: (n, d) => { doc[n] = d; }, emit: () => events++,
  ipcMain: { handle: (n, f) => h.set(n, (...a) => f({}, ...a)) }, webSessions: f => { cbs.push(f); f(s1); } };
const call = (n, ...a) => h.get(n)(...a);
(async () => {
  disposed = m(api, { warp: path.join(__dirname, 'tools', 'fake-warp.js'), tor: path.join(__dirname, 'tools', 'fake-tor.js') });
  let st = await call('state'); assert.equal(st.country, 'xfr'); assert.equal(Object.keys(st.countries).length, 9);
  st = await call('set', true); assert.ok(st.on, st.msg); assert.equal(proxy(), 'socks5://127.0.0.1:9155');  // Tor, partout sauf la France
  cbs[0](s2); assert.equal(s2.last, 'socks5://127.0.0.1:9155');  // une fenêtre privée ouverte ensuite passe aussi par le VPN
  st = await call('country', ''); assert.ok(st.on); assert.equal(proxy(), 'socks5://127.0.0.1:40000');  // Cloudflare WARP
  const w = JSON.parse(fs.readFileSync(fakeState, 'utf8')); assert.ok(w.reg && w.on && w.mode === 'proxy' && w.port === 40000, JSON.stringify(w));
  st = await call('country', 'zz'); assert.equal(st.country, '');  // pays inconnu : WARP
  const sp = await call('speed'); assert.ok(sp.mbps > 50 && sp.mbps < 500 && sp.ms >= 0, JSON.stringify(sp));  // 2 Mo en ~40 ms
  st = await call('state'); assert.deepEqual(Object.keys(st.speeds), ['warp']);
  st = await call('set', false); assert.ok(!st.on); assert.equal(proxy(), 'direct');
  await assert.rejects(call('speed'), /allume le VPN/); assert.ok((await call('set', false)).on === false);  // une mesure refusée ne bloque pas la suite
  assert.deepEqual({ ...doc.reglages, speeds: undefined }, { on: false, country: '', speeds: undefined });
  st = await call('legacy', { vpn: true, vpnCountry: 'us' }); assert.ok(st.on && st.country === 'us', JSON.stringify(st));  // les réglages de l'ancien VPN du cœur, repris une fois
  st = await call('legacy', { vpn: false, vpnCountry: 'de' }); assert.equal(st.country, 'us');
  await assert.rejects(call('install'), /pas pendant un test/);
  disposed(); await new Promise(r => setTimeout(r, 50)); assert.equal(proxy(), 'direct');  // désactivé : les sites reviennent en direct
  console.log('ok · ' + events + ' changements d\'état envoyés à la page');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
