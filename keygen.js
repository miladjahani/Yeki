/* ═══ ابزار تولید کلید لایسنس معدن‌بان ═══
   طرز استفاده:  node keygen.js
   ⚠️ این فایل و private.key را هرگز به مشتری ندهید! */
const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

const PRIV = 'private.key', PUB = 'public.key';

function ensureKeys() {
  if (fs.existsSync(PRIV) && fs.existsSync(PUB)) return;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.writeFileSync(PUB, publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('🔑 جفت‌کلید جدید ساخته شد (private.key + public.key)');
  console.log('👉 محتوای public.key را داخل فایل public.key کنار برنامه قرار دهید.\n');
}
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function make(machineCode, edition, years) {
  const priv = fs.readFileSync(PRIV, 'utf8');
  const mcp = String(machineCode).trim().slice(0, 12);
  const d = new Date(); d.setFullYear(d.getFullYear() + years);
  const jal = gregToJal(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const expire = `${jal.jy}/${String(jal.jm).padStart(2, '0')}/${String(jal.jd).padStart(2, '0')}`;
  const msg = `${mcp}.${edition}.${expire}`;
  const sig = b64u(crypto.sign(null, Buffer.from(msg), { key: priv, format: 'pem', type: 'pkcs8' }));
  return `MHSE.${mcp}.${edition}.${expire}.${sig}`;
}
/* تبدیل میلادی→جلالی برای محاسبه انقضا */
const _div=(a,b)=>~~(a/b),_mod=(a,b)=>a-~~(a/b)*b;
function jalCal(jy){const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];const bl=breaks.length,gy=jy+621;let leapJ=-14,jp=breaks[0],jump=0,i;for(i=1;i<bl;i+=1){const jm=breaks[i];jump=jm-jp;if(jy<jm)break;leapJ=leapJ+_div(jump,33)*8+_div(_mod(jump,33),4);jp=jm}let n=jy-jp;leapJ=leapJ+_div(n,33)*8+_div(_mod(n,33)+3,4);if(_mod(jump,33)===4&&jump-n===4)leapJ+=1;const leapG=_div(gy,4)-_div((_div(gy,100)+1)*3,4)-150;const march=20+leapJ-leapG;if(jump-n<6)n=n-jump+_div(jump+4,33)*33;let leap=_mod(_mod(n+1,33)-1,4);if(leap===-1)leap=4;return{leap,gy,march}}
function g2d(gy,gm,gd){let d=_div((gy+_div(gm-8,6)+100100)*1461,4)+_div(153*_mod(gm+9,12)+2,5)+gd-34840408;d=d-_div(_div(gy+100100+_div(gm-8,6),100)*3,4)+752;return d}
function d2j(jdn){const gy=d2g(jdn).gy;let jy=gy-621;const r=jalCal(jy);const jdn1f=g2d(gy,3,r.march);let k=jdn-jdn1f,jd,jm;if(k>=0){if(k<=185){jm=1+_div(k,31);jd=_mod(k,31)+1;return{jy,jm,jd}}else k-=186}else{jy-=1;k+=179;if(r.leap===1)k+=1}jm=7+_div(k,30);jd=_mod(k,30)+1;return{jy,jm,jd}}
function d2g(jdn){let j=4*jdn+139361631;j=j+_div(_div(4*jdn+183187720,146097)*3,4)*4-3908;const i=_div(_mod(j,1461),4)*5+308;const gd=_div(_mod(i,153),5)+1,gm=_mod(_div(i,153),12)+1,gy=_div(j,1461)-100100+_div(8-gm,6);return{gy,gm,gd}}
const gregToJal=(gy,gm,gd)=>d2j(g2d(gy,gm,gd));

ensureKeys();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));
(async () => {
  const mc = await ask('🖥️  کد ماشین مشتری را وارد کنید: ');
  const ed = await ask('📦 نسخه (1=Basic  2=Pro  3=Enterprise): ');
  const yr = parseInt(await ask('⏳ مدت (سال، پیش‌فرض 1): ') || '1', 10);
  const edition = ['Basic', 'Pro', 'Enterprise'][(parseInt(ed, 10) || 2) - 1];
  console.log('\n✅ کلید لایسنس:\n\n   ' + make(mc, edition, yr) + '\n');
  console.log('⚠️  private.key را امن نگه دارید؛ این کلید قابل جعل نیست.');
  rl.close();
})();