# VPN

A VPN for the websites opened in NeoDex, and only them: your PC, games and Discord do not go through it. It is the **VPN** button in the address bar, next to ADBLOCK.

*Version française : [README.md](README.md)*

## Use

- **Click** VPN: on or off.
- **Right click**: choose the exit.
  - **Anywhere but France** (default) or a country (United States, United Kingdom, Germany, Netherlands, Switzerland, Sweden, Canada, Japan): through **Tor**, free and with no account. Slower, and some sites ask for a check.
  - **Cloudflare WARP**: fast, free, no account, but sites see you in your own country.
- The plugin's tab shows the same in large, with the address the sites see.

The VPN turns itself back on at launch if it was on, before the sites load.

## What gets installed

- **Tor**: the official "Tor Expert Bundle" from torproject.org (about 25 MB), downloaded once into the plugin's folder after you agree. It only runs if its fingerprint is in the list signed by the Tor Browser key (key fingerprint pinned in the code). A Tor Browser already installed on the Desktop or in the usual folder also works.
- **Cloudflare WARP**: installed with winget (Windows' installer), only if you choose WARP. Windows may ask for administrator rights.

## Permissions

**Full access**: it has to set the proxy of NeoDex's websites, run Tor or WARP on your PC and put its button in the address bar.

## Since NeoDex 3.1.15

The VPN used to be inside NeoDex. Since 3.1.16 it is this plugin: it takes over your setting (on or off, and the country) the first time it opens. Tor downloaded by the old VPN is downloaded again once.
