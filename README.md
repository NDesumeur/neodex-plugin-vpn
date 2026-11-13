# VPN

Le VPN des sites ouverts dans NeoDex, et seulement eux : ton PC, tes jeux et Discord ne passent pas par lui. C'est le bouton **VPN** de la barre d'adresse, à côté d'ADBLOCK.

*English version: [README.en.md](README.en.md)*

## Utilisation

- **Clic** sur VPN : allumer ou couper.
- **Clic droit** : choisir la sortie.
  - **Partout sauf la France** (par défaut) ou un pays (États-Unis, Royaume-Uni, Allemagne, Pays-Bas, Suisse, Suède, Canada, Japon) : par **Tor**, gratuit et sans compte. Plus lent, et certains sites demandent une vérification.
  - **Cloudflare WARP** : rapide, gratuit et sans compte, mais les sites te voient dans ton pays.
- L'onglet du plugin montre la même chose en grand, avec l'adresse que voient les sites.

Le VPN se rallume tout seul au lancement s'il était allumé, avant que les sites ne chargent.

## Ce qui est installé

- **Tor** : le « Tor Expert Bundle » officiel de torproject.org (environ 25 Mo), téléchargé une fois dans le dossier du plugin, après ton accord. Il n'est lancé que si son empreinte est dans la liste signée par la clé de Tor Browser (empreinte de la clé écrite dans le code). Un Tor Browser déjà installé sur le Bureau ou dans le dossier habituel marche aussi.
- **Cloudflare WARP** : installé avec winget (l'installeur de Windows), seulement si tu choisis WARP. Windows peut demander l'autorisation administrateur.

## Autorisations

**Accès complet** : il faut régler le proxy des sites de NeoDex, lancer Tor ou WARP sur ton PC et mettre le bouton dans la barre d'adresse.

## Depuis NeoDex 3.1.15

Le VPN était dans NeoDex. Depuis la 3.1.16, c'est ce plugin : il reprend ton réglage (allumé ou non, et le pays) la première fois qu'il s'ouvre. Tor déjà téléchargé par l'ancien VPN est retéléchargé une fois.

## Pour les développeurs

`node test-main.js` vérifie le volet système avec un faux warp-cli et un faux tor.exe (`tools/`) : rien n'est installé, aucun vrai proxy n'est posé.
