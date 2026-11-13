// plays warp-cli's part for tests/selftest-neo5.js: remembers its registration and connection in a temporary file
const fs = require('fs'), path = require('path'), os = require('os');
const f = path.join(os.tmpdir(), 'neobase-fake-warp.json'), st = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {reg: false, on: false, mode: '', port: 0};
const a = process.argv.slice(2).join(' '), save = () => fs.writeFileSync(f, JSON.stringify(st));
if (a === 'registration show') { if (!st.reg) { console.error('Error: Missing registration'); process.exit(1); } console.log('Account type: Free'); }
else if (a === 'registration new') { st.reg = true; save(); console.log('Success'); }
else if (a === 'mode proxy') { st.mode = 'proxy'; save(); console.log('Success'); }
else if (a.startsWith('proxy port ')) { st.port = +a.split(' ')[2]; save(); console.log('Success'); }
else if (a === 'connect') { st.on = true; save(); console.log('Success'); }
else if (a === 'disconnect') { st.on = false; save(); console.log('Success'); }
else if (a === 'status') console.log('Status update: ' + (st.on ? 'Connected' : 'Disconnected'));
else { console.error('unrecognized subcommand ' + a); process.exit(2); }
