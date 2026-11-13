// lancé par le test « local » de NeoDex : le bouton est à sa place, l'onglet s'affiche, le pays se choisit sans rien allumer ni installer
module.exports = async ({ js, sleep }) => {
  const r = await js(`(async () => {
    const b = document.getElementById('bVpn'), after = b?.previousElementSibling?.id, view = document.getElementById(APPS['plugin:neodex.vpn'].view);
    const s1 = await neo.pluginMain('neodex.vpn', 'state'), s2 = await neo.pluginMain('neodex.vpn', 'country', 'us'), s3 = await neo.pluginMain('neodex.vpn', 'country', 'xfr');
    return { btn: b?.textContent, after, n: document.querySelectorAll('#bVpn').length, tab: view.querySelectorAll('.vpList button').length, big: view.querySelector('.vpBig')?.textContent,
      on: s1.on, c: [s1.country, s2.country, s3.country].join('>'), pays: Object.keys(s1.countries).length };
  })()`);
  if (r.btn !== 'VPN OFF' || r.after !== 'bShield' || r.n !== 1) throw new Error('bouton : ' + JSON.stringify(r));
  if (r.tab !== 10 || r.big !== 'COUPÉ' || r.on) throw new Error('onglet : ' + JSON.stringify(r));
  if (!r.c.endsWith('>us>xfr') || r.pays !== 9) throw new Error('pays : ' + JSON.stringify(r));
  await sleep(300);
  return 'bouton VPN après ADBLOCK, onglet avec 10 sorties, pays changé sans rien allumer';
};
