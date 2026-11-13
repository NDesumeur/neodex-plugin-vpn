// VPN, volet système : seuls les sites ouverts dans NeoDex passent par lui, pas le reste du PC (comme le VPN d'Opera GX).
// Par défaut, Tor (gratuit, sans compte) avec une sortie dans le pays choisi, ou « partout sauf la France ». Au choix, Cloudflare WARP
// en mode proxy (rapide, mais il sort dans ton pays). Tor est le « Tor Expert Bundle » officiel de torproject.org (environ 25 Mo),
// téléchargé une fois dans le dossier du plugin et jamais lancé sans vérification : son empreinte SHA-256 doit être dans la liste signée
// par la clé de Tor Browser (empreinte épinglée dans TOR_KEY). Un Tor Browser déjà installé marche aussi. WARP s'installe avec winget.
// NeoDex donne au plugin les sessions des sites (api.webSessions) : il y pose le proxy, et le retire quand on le coupe ou le désactive.
const path = require('path'), fs = require('fs'), { execFile, spawn } = require('child_process');
const pgp = require('./pgp');
const TOR_KEY = 'EF6E286DDA85EA2A4BA7DE684E2C6E8793298290';  // « Tor Browser Developers (signing key) », publiée sur torproject.org
const PORT = 40000, TOR_PORT = 9155, sleep = ms => new Promise(r => setTimeout(r, ms));
// les pays proposés : Tor a beaucoup de sorties dans chacun. « xfr » : n'importe quel pays sauf la France
const COUNTRIES = { xfr: 'Partout sauf la France', us: 'États-Unis', gb: 'Royaume-Uni', de: 'Allemagne', nl: 'Pays-Bas', ch: 'Suisse', se: 'Suède', ca: 'Canada', jp: 'Japon' };
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';  // celui de Windows : le tar de Git prend « C: » pour un serveur

// le pays d'une adresse IPv4 d'après le fichier geoip de Tor (lignes « début,fin,PAYS » triées) : Cloudflare répond « T1 »
// pour toutes les sorties Tor, il ne dit donc pas où l'on sort ; null pour une IPv6 ou une adresse absente
function geoCountry(text, ip) {
  const p = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip || ''); if (!p) return null;
  const n = ((+p[1] * 256 + +p[2]) * 256 + +p[3]) * 256 + +p[4];
  const rows = geoCountry.cache?.text === text ? geoCountry.cache.rows
    : (geoCountry.cache = { text, rows: text.split('\n').filter(l => l && l[0] !== '#').map(l => l.split(',')) }).rows;
  let lo = 0, hi = rows.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1, r = rows[m]; if (n < +r[0]) hi = m - 1; else if (n > +r[1]) lo = m + 1; else return r[2].trim().toLowerCase(); }
  return null;
}
// les versions stables listées sur torproject.org, la plus récente d'abord (« 16.0a14 » est une alpha, ignorée)
const torVersions = html => [...html.matchAll(/href="(\d+(?:\.\d+)+)\/"/g)].map(m => m[1]).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));

// test : { warp, tor } = faux warp-cli et faux tor.exe (des scripts node), passés seulement par test-main.js
module.exports = function (api, test = {}) {
  if (typeof api.webSessions !== 'function') throw new Error('il faut NeoDex 3.1.16 ou plus récent');  // avant, le VPN était dans NeoDex
  const dataDir = api.dataDir; fs.mkdirSync(dataDir, { recursive: true });
  const cfg = { on: false, country: 'xfr', ...(api.readDoc('reglages') || {}) };  // '' = WARP ; sinon le pays de la sortie Tor
  const save = () => api.writeDoc('reglages', cfg);
  const sessions = new Set();
  const cli = () => test.warp || path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Cloudflare', 'Cloudflare WARP', 'warp-cli.exe');
  const warp = (...args) => new Promise((ok, ko) => {
    const [exe, a] = test.warp ? ['node', [cli(), ...args]] : [cli(), ['--accept-tos', ...args]];
    execFile(exe, a, { windowsHide: true, timeout: 30000 }, (e, out, err) => e ? ko(new Error(String(err || out || e.message).trim())) : ok(String(out).trim()));
  });
  // warp-cli a changé ses commandes en 2024 : la nouvelle forme d'abord, l'ancienne si ce WARP est plus vieux
  const either = (now, old) => warp(...now).catch(() => warp(...old));
  let state = { on: false, busy: false, msg: '' };
  const view = () => ({ ...state, country: cfg.country, countries: COUNTRIES, installed: cfg.country ? !!torExe() : fs.existsSync(cli()), torInstalled: !!torExe() });
  const tell = () => api.emit('state', view());
  const proxyOf = on => on ? { proxyRules: `socks5://127.0.0.1:${cfg.country ? TOR_PORT : PORT}`, proxyBypassRules: '<local>' } : { mode: 'direct' };

  // ---- Tor : lancé par le plugin, sa sortie épinglée sur un pays
  const torRoots = () => [path.join(process.env.USERPROFILE || '', 'Desktop', 'Tor Browser'), path.join(process.env.LOCALAPPDATA || '', 'Tor Browser'), path.join(process.env.ProgramFiles || '', 'Tor Browser')];
  const bundle = () => path.join(dataDir, 'tor-bundle');
  const torExe = () => test.tor || (test.warp ? null : [path.join(bundle(), 'tor', 'tor.exe'), ...torRoots().map(r => path.join(r, 'Browser', 'TorBrowser', 'Tor', 'tor.exe'))].find(f => fs.existsSync(f)));
  const torGeo = exe => exe.startsWith(bundle()) ? path.join(bundle(), 'data') : path.join(path.dirname(exe), '..', 'Data', 'Tor');  // les fichiers des pays (geoip) dont Tor a besoin
  async function torDownload() {
    const DIST = 'https://dist.torproject.org/torbrowser/', list = await (await fetch(DIST)).text();
    const vers = torVersions(list), get = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + ' ' + u); return Buffer.from(await r.arrayBuffer()); };
    const key = await get('https://keys.openpgp.org/vks/v1/by-fingerprint/' + TOR_KEY);
    for (const v of vers.slice(0, 3)) {
      const name = `tor-expert-bundle-windows-x86_64-${v}.tar.gz`;
      const sums = await get(`${DIST}${v}/sha256sums-signed-build.txt`).catch(() => null); if (!sums) continue;
      if (!pgp.verify(sums, await get(`${DIST}${v}/sha256sums-signed-build.txt.asc`), key, TOR_KEY)) throw new Error('Tor : signature invalide, téléchargement refusé');
      const want = pgp.sumOf(sums, name); if (!want) continue;  // une version sans Windows (Android seulement)
      const buf = await get(DIST + v + '/' + name);
      if (pgp.sha256(buf) !== want) throw new Error('Tor : fichier modifié, téléchargement refusé');
      const tgz = path.join(dataDir, 'tor-bundle.tar.gz'); fs.writeFileSync(tgz, buf);
      fs.rmSync(bundle(), { recursive: true, force: true }); fs.mkdirSync(bundle(), { recursive: true });
      await new Promise((ok, ko) => execFile(TAR, ['-xzf', tgz, '-C', bundle()], { windowsHide: true, timeout: 120000 }, e => e ? ko(e) : ok()));
      fs.rmSync(tgz, { force: true });
      if (fs.existsSync(path.join(bundle(), 'tor', 'tor.exe'))) return true;
    }
    throw new Error('Tor est introuvable sur torproject.org');
  }
  let tor = null;
  const torStop = () => { if (tor) { try { tor.kill(); } catch {} tor = null; } };
  function torStart(country) {
    torStop();
    const exe = torExe(); if (!exe) throw new Error("Tor n'est pas installé");
    const geo = torGeo(exe), dir = path.join(dataDir, 'tor');
    fs.mkdirSync(dir, { recursive: true });
    const rc = path.join(dir, 'torrc');
    fs.writeFileSync(rc, [`SocksPort 127.0.0.1:${TOR_PORT}`, `DataDirectory ${dir}`, `GeoIPFile ${path.join(geo, 'geoip')}`,
      `GeoIPv6File ${path.join(geo, 'geoip6')}`, country === 'xfr' ? 'ExcludeExitNodes {fr}' : `ExitNodes {${country}}`, 'StrictNodes 1', 'Log notice stdout'].join('\n'));
    return new Promise((ok, ko) => {
      const p = tor = test.tor ? spawn('node', [exe], { windowsHide: true }) : spawn(exe, ['-f', rc], { windowsHide: true });
      let log = '';
      const t = setTimeout(() => { torStop(); ko(new Error('Tor ne se connecte pas (réseau bloqué ?)')); }, 120000);
      p.stdout.on('data', d => { log += d; if (/Bootstrapped 100%/.test(log)) { clearTimeout(t); ok(); } });
      p.on('exit', () => { clearTimeout(t); if (tor === p) tor = null; ko(new Error('Tor s\'est arrêté : ' + (log.trim().split('\n').pop() || '?'))); });
    });
  }
  const applyProxy = on => Promise.all([...sessions].map(s => s.setProxy(proxyOf(on)).then(() => s.closeAllConnections?.())));

  async function connect() {
    if (!fs.existsSync(cli())) throw new Error("Cloudflare WARP n'est pas installé");
    try { await either(['registration', 'show'], ['account']); } catch { await either(['registration', 'new'], ['register']); }
    await either(['mode', 'proxy'], ['set-mode', 'proxy']);
    await either(['proxy', 'port', String(PORT)], ['set-proxy-port', String(PORT)]);
    await warp('connect');
    for (let i = 0; i < 40; i++) { if (/\bConnected\b/.test(await warp('status').catch(() => ''))) return; await sleep(500); }
    throw new Error('WARP ne se connecte pas (réseau bloqué ?)');
  }
  let job = Promise.resolve();
  const set = on => (job = job.then(async () => {
    state = { on: state.on, busy: true, msg: on ? 'Connexion…' : 'Déconnexion…' }; tell();
    try {
      if (on && cfg.country) {
        await warp('disconnect').catch(() => {}); await torStart(cfg.country); await applyProxy(true);
        const c = test.tor ? null : await check().catch(() => null);
        const loc = c?.loc?.toLowerCase(), want = cfg.country;
        if (c && loc !== 't1' && (want === 'xfr' ? loc === 'fr' : loc !== want)) throw new Error(want === 'xfr' ? 'la sortie Tor est en France, réessaie' : `la sortie Tor est en ${c.loc || '?'} et pas en ${COUNTRIES[want]}, réessaie`);
      }
      else if (on) { torStop(); await connect(); await applyProxy(true); }
      else { await applyProxy(false); torStop(); await warp('disconnect').catch(() => {}); }
      state = { on, busy: false, msg: '' };
      if (cfg.on !== on) { cfg.on = on; save(); }
    } catch (e) { await applyProxy(false); state = { on: false, busy: false, msg: e.message }; }
    tell(); return view();
  }));
  // l'adresse que voient les sites, et si elle passe par WARP (la page de Cloudflare le dit)
  async function check() {
    const s = [...sessions][0]; if (!s) return null;
    const t = await (await s.fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' })).text();
    const f = Object.fromEntries(t.split('\n').map(l => l.split('=')).filter(p => p.length === 2));
    let loc = f.loc;
    if (loc === 'T1') { const exe = torExe(); try { loc = (exe && geoCountry(fs.readFileSync(path.join(torGeo(exe), 'geoip'), 'utf8'), f.ip) || 'T1').toUpperCase(); } catch {} }
    return { ip: f.ip, loc, warp: f.warp === 'on' || f.warp === 'plus' };
  }

  api.ipcMain.handle('state', () => view());
  api.ipcMain.handle('set', (_, on) => set(!!on));
  // le pays : '' = WARP ; un changement VPN allumé reconnecte par la nouvelle sortie (Tor pas encore installé : l'installation d'abord)
  api.ipcMain.handle('country', (_, c) => {
    c = Object.hasOwn(COUNTRIES, c) ? c : '';
    if (cfg.country !== c) { cfg.country = c; save(); }
    return state.on && (!c || torExe()) ? set(true) : view();
  });
  api.ipcMain.handle('check', check);
  // les réglages de l'ancien VPN du cœur (NeoDex 3.1.15 et avant), repris une fois par la page
  api.ipcMain.handle('legacy', (_, old) => { if (cfg.legacy) return view(); cfg.legacy = 1; if (old && typeof old.vpnCountry === 'string') cfg.country = Object.hasOwn(COUNTRIES, old.vpnCountry) ? old.vpnCountry : ''; save(); return old?.vpn ? set(true) : view(); });
  api.ipcMain.handle('install', () => new Promise((ok, ko) => {
    if (test.warp) return ko(new Error('pas pendant un test'));  // n'installe jamais rien pendant un test
    if (cfg.country) return torDownload().then(ok, e => ko(new Error(e.message)));  // un pays : c'est Tor qu'il faut
    execFile('winget', ['install', '--id', 'Cloudflare.Warp', '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements'], { windowsHide: true, timeout: 600000 },
      (e, out) => fs.existsSync(cli()) ? ok(true) : ko(new Error(e ? String(out || e.message).trim().split('\n').pop() : "l'installation n'a pas abouti")));
  }));

  // chaque session des sites (la normale et les fenêtres privées) passe par le VPN tant qu'il est allumé
  api.webSessions(ses => { sessions.add(ses); if (state.on || state.busy) ses.setProxy(proxyOf(true)); });
  // allumé au dernier lancement : les sites attendent la connexion plutôt que de montrer la vraie adresse un instant
  if (cfg.on) { state = { on: true, busy: true, msg: 'Connexion…' }; applyProxy(true); set(true); }
  const quit = () => { torStop(); if (state.on && !cfg.country) warp('disconnect').catch(() => {}); };
  api.electron?.app?.on?.('will-quit', quit);
  // désactivé, désinstallé ou mis à jour : les sites reviennent en direct
  return () => { api.electron?.app?.off?.('will-quit', quit); quit(); applyProxy(false); };
};
module.exports.geoCountry = geoCountry; module.exports.torVersions = torVersions; module.exports.COUNTRIES = COUNTRIES;
