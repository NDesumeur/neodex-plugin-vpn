// VPN, côté page : le bouton VPN de la barre d'adresse (clic : allumer / couper ; clic droit : le pays) et l'onglet du plugin
// (état, adresse vue par les sites, choix du pays). Tout le travail se fait dans le volet système (main.js).
const CSS = `
.vpWrap{max-width:clamp(720px,72vw,1400px);margin:0 auto;padding:clamp(16px,1.6vw,30px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));align-items:start;gap:clamp(12px,1.2vw,22px);box-sizing:border-box}
.vpCard{padding:clamp(14px,1.3vw,24px);display:flex;flex-direction:column;gap:8px;background:color-mix(in srgb,var(--line2,#3a2a6e) 45%,#000);box-shadow:inset 0 0 0 2px var(--line2,#3a2a6e)}
.vpCard .t{font:clamp(8px,.6vw,11px) var(--title);letter-spacing:1px;color:var(--lilac,#c9bde6)}
.vpBig{font:clamp(20px,1.7vw,32px) var(--title);color:#fff}.vpBig.on{color:#3fdc7a}
.vpRow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.vpHint{font-size:clamp(12px,.85vw,15px);color:var(--muted,#9a8cc0);line-height:1.5}
.vpList{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(190px,13vw,280px),1fr));gap:clamp(6px,.5vw,10px)}
.vpList button{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:5px;height:auto;min-height:clamp(52px,3.6vw,68px);padding:10px 14px;white-space:normal;overflow-wrap:anywhere;text-indent:0}
.vpList button small{display:block;margin:0;font-size:clamp(11px,.75vw,14px);color:var(--muted,#9a8cc0)}
.vpList button{text-align:left}.vpList button.sel{box-shadow:inset 0 0 0 2px var(--magenta,#ff4fd8)}
`;
export default async function (ctx) {
  const { el, toast, neo, host } = ctx, ID = ctx.id, call = (n, ...a) => neo.pluginMain(ID, n, ...a);
  host.addStyle(CSS);
  const box = (cls, kids) => { const d = el('div', cls); d.append(...kids); return d; };
  // NeoDex 3.1.15 et avant ont leur propre VPN (et pas les sessions des sites pour un plugin) : on ne touche à rien
  let st; try { st = await call('state'); } catch (e) { ctx.view.replaceChildren(el('div', 'hint', 'Le plugin VPN demande NeoDex 3.1.16 ou plus récent : ta version a encore son propre bouton VPN.')); return; }
  let now = { on: false, busy: false, msg: '' }, alive = true;
  ctx.onClose(() => { alive = false; btn.remove(); pop.remove(); });

  // le bouton, à sa place d'avant : juste après ADBLOCK dans la barre d'adresse
  document.getElementById('bVpn')?.remove();
  const btn = el('button', 'btn px off', 'VPN OFF'); btn.id = 'bVpn';
  const shield = document.getElementById('bShield'); if (shield) shield.after(btn); else document.body.append(btn);
  const where = s => s.country === 'xfr' ? 'dehors de France' : s.country ? (s.countries?.[s.country] || s.country) : '';
  function show(s) {
    now = { ...now, ...s };
    btn.className = 'btn px ' + (s.busy ? 'busy' : s.on ? 'on' : 'off');
    btn.textContent = s.busy ? 'VPN…' : s.on ? 'VPN ON' : 'VPN OFF';
    btn.title = (s.busy ? s.msg : s.on ? (where(s) ? `VPN actif : les sites te voient en ${where(s)} (par Tor)` : 'VPN actif : les sites voient une adresse de Cloudflare WARP, pas la tienne') + ' · cliquer pour le couper'
      : 'Activer le VPN pour les sites ouverts dans NeoDex') + ' · clic droit : choisir le pays';
    if (s.msg && !s.busy) toast('VPN : ' + s.msg, true);
    paint();
  }
  neo.onPluginMain(e => { if (alive && e.id === ID && e.name === 'state') show(e.data); });

  // Tor ou WARP pas encore là : on dit ce qui va être téléchargé, puis on l'installe
  async function install(st) {
    const tor = !!st.country;
    const ok = await host.confirm(tor
      ? "Le VPN passe par Tor, gratuit et sans compte, pour que les sites te voient ailleurs qu'en France (plus lent qu'une connexion directe, et certains sites demandent une vérification). Il faut télécharger Tor une fois (environ 25 Mo, depuis torproject.org, signature vérifiée).\n\nTélécharger Tor maintenant ?"
      : "Le VPN utilise Cloudflare WARP, gratuit et sans compte. Il faut l'installer une fois (environ 100 Mo, Windows peut demander l'autorisation administrateur). En l'installant tu acceptes les conditions de Cloudflare.\n\nInstaller WARP maintenant ?");
    if (!ok) return false;
    show({ ...now, busy: true, msg: tor ? 'Téléchargement de Tor…' : 'Installation de Cloudflare WARP…' }); toast(tor ? 'Téléchargement de Tor… (moins d’une minute)' : 'Installation de Cloudflare WARP… (une à deux minutes)');
    try { await call('install'); return true; } catch (e) { show({ ...now, busy: false, msg: (tor ? "Tor ne s'est pas installé : " : "WARP ne s'est pas installé : ") + e.message }); return false; }
  }
  const tell = () => call('check').then(c => { if (!c) return; toast(now.country || c.warp ? `VPN actif · les sites voient ${c.ip} (${c.loc})` : 'VPN actif, mais Cloudflare ne voit pas WARP : recharge la page'); if (view.isConnected) ipLine.textContent = `Les sites voient ${c.ip} (${c.loc})`; }, () => {});
  async function toggle() {
    if (now.busy) return;
    const st = await call('state');
    if (!now.on && !st.installed && !await install(st)) return;
    const s = await call('set', !now.on);
    if (s.on) tell(); else if (!s.msg) toast('VPN coupé');
  }
  async function pick(c) {
    pop.classList.remove('on');
    const s = await call('state');
    if (c && !s.torInstalled) { const before = s.country; await call('country', c); if (!await install({ country: c })) { await call('country', before); return; } }
    const n = await call('country', c);
    show({ ...n, msg: n.msg || '' });
    if (n.on) tell(); else toast(c ? `Pays du VPN : ${s.countries[c]} · active le VPN pour l'utiliser` : 'Pays du VPN : Cloudflare WARP (sortie dans ton pays)');
  }
  const CHOICES = s => [['', 'Cloudflare WARP', 'rapide, mais sort dans ton pays'], ...Object.entries(s.countries).map(([k, v]) => [k, v, k === 'xfr' ? 'Tor choisit un pays, jamais la France' : 'par Tor'])];
  btn.onclick = toggle;
  // clic droit : le pays. Cloudflare WARP (rapide, reste dans ton pays) ou un pays par Tor (plus lent, sortie dans ce pays)
  const pop = el('div', 'tbPop px vpnPop'); document.body.append(pop);
  btn.oncontextmenu = async e => {
    e.preventDefault();
    const s = await call('state'), r = btn.getBoundingClientRect(), item = typeof tbItem === 'function' ? tbItem : ((l, t, f) => { const b = el('button', '', l); b.title = t; b.onclick = f; return b; });
    pop.replaceChildren(el('div', 'label', 'PAYS DU VPN'), ...CHOICES(s).map(([k, v, h]) => item((k === s.country ? '● ' : '') + v, h, () => pick(k))));
    pop.style.top = r.bottom + 6 + 'px'; pop.style.left = Math.max(8, r.left - 120) + 'px'; pop.style.right = 'auto';
    pop.classList.add('on');
  };
  document.addEventListener('pointerdown', e => { if (alive && !e.target.closest('.vpnPop')) pop.classList.remove('on'); }, true);

  // l'onglet du plugin : la même chose en grand
  const view = ctx.view, big = el('div', 'vpBig', '…'), ipLine = el('div', 'vpHint', ''), list = el('div', 'vpList'), go = el('button', 'btn px', 'ACTIVER'), sp = el('button', 'btn px', 'MESURER LA VITESSE');
  go.onclick = toggle;
  const speedText = r => String(r.mbps).replace('.', ',') + ' Mbit/s · ' + r.ms + ' ms';
  sp.title = 'Ping et débit (2 Mo téléchargés) par la sortie actuelle ; le résultat reste noté à côté du pays';
  sp.onclick = async () => { sp.disabled = true; sp.textContent = 'MESURE…';
    try { const r = await call('speed'); toast('Vitesse du VPN : ' + speedText(r)); } catch (e) { toast('Mesure impossible : ' + e.message.replace(/^Error invoking remote method '[^']*': (Error: )?/, ''), true); }
    sp.textContent = 'MESURER LA VITESSE'; paint(); };
  view.replaceChildren(box('vpWrap', [
    box('vpCard', [el('div', 't', 'VPN DES SITES'), big, box('vpRow', [go, sp]), ipLine,
      el('div', 'vpHint', 'Seuls les sites ouverts dans NeoDex passent par le VPN : le reste de ton PC (jeux, Discord, Windows) n\'est pas touché.')]),
    box('vpCard', [el('div', 't', 'PAYS DE SORTIE'), list,
      el('div', 'vpHint', 'Un pays : par Tor, gratuit et sans compte, plus lent. Cloudflare WARP : rapide, mais les sites te voient dans ton pays. Le bouton VPN de la barre d\'adresse fait la même chose (clic droit : le pays).')]),
  ]));
  function paint() {
    if (!now.countries) return;
    big.textContent = now.busy ? (now.msg || '…') : now.on ? 'ACTIF' + (where(now) ? ' · ' + where(now).toUpperCase() : ' · WARP') : 'COUPÉ';
    big.className = 'vpBig' + (now.on ? ' on' : ''); go.textContent = now.on ? 'COUPER' : 'ACTIVER'; go.disabled = !!now.busy; if (sp.textContent !== 'MESURE…') sp.disabled = !now.on || !!now.busy;
    if (!now.on) ipLine.textContent = '';
    list.replaceChildren(...CHOICES(now).map(([k, v, h]) => { const b = el('button', 'btn px' + (k === now.country ? ' sel' : '')), r = now.speeds?.[k || 'warp'];
      b.append(el('span', '', v), el('small', '', r ? speedText(r) : 'pas encore mesuré')); b.title = h + (r ? ' · mesuré le ' + new Date(r.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''); b.onclick = () => pick(k); return b; }));
  }
  view.__vp = { show };  // pour l'auto-test
  ctx.onOpen(() => { if (now.on) tell(); });

  // l'ancien VPN du cœur (NeoDex 3.1.15 et avant) : ses réglages repris une fois, et rallumé s'il l'était
  try { const old = await ctx.legacy.settings(); if (old && 'vpnCountry' in old) st = await call('legacy', { vpn: !!old.vpn, vpnCountry: old.vpnCountry }); } catch {}
  show({ ...st, msg: '' });
}
