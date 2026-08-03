const { execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PUBKEY_FILE = path.join(__dirname, 'public.key');
const TRIAL_DAYS = 30;

// کلید عمومی — با اجرای keygen.js ساخته می‌شود
let PUBKEY = '';
try { PUBKEY = fs.readFileSync(PUBKEY_FILE, 'utf8').trim(); } catch (e) {}

/* ── اثر انگشت سخت‌افزاری ── */
function wmic(cmd) {
  try {
    const out = execSync(cmd, { windowsHide: true, encoding: 'utf8', timeout: 8000 })
      .trim().split(/\r?\n/).filter(Boolean);
    return out.slice(1).join('|').replace(/\s+/g, '');
  } catch (e) { return ''; }
}
function powershell(cmd) {
  try {
    return execSync(`powershell -NoProfile -Command "${cmd}"`,
      { windowsHide: true, encoding: 'utf8', timeout: 12000 }).trim();
  } catch (e) { return ''; }
}
function machineCode() {
  let board = wmic('wmic baseboard get serialnumber');
  if (!board) board = powershell('(Get-CimInstance Win32_BaseBoard).SerialNumber');
  let cpu = wmic('wmic cpu get processorid');
  if (!cpu) cpu = powershell('(Get-CimInstance Win32_Processor).ProcessorId');
  let bios = wmic('wmic csproduct get uuid');
  if (!bios) bios = powershell('(Get-CimInstance Win32_ComputerSystemProduct).UUID');
  const raw = [board, cpu, bios].join('#') + '#' + (os.hostname() || '');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/* ── اعتبارسنجی کلید ── */
function verifyKey(key, mc) {
  const parts = String(key || '').trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'MHSE' || !PUBKEY) return null;
  const [, mcp, edition, expire, sig] = parts;
  if (mcp !== mc.slice(0, 12)) return null;               // قفل روی همین ماشین
  const msg = `${mcp}.${edition}.${expire}`;
  const buf = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const ok = crypto.verify(null, Buffer.from(msg),
    { key: PUBKEY, format: 'pem', type: 'spki' }, buf);
  if (!ok) return null;
  const ep = expire.split('/').map(Number);
  const expDate = new Date(ep[0], ep[1] - 1, ep[2], 23, 59, 59);
  if (isNaN(expDate)) return null;
  return { key: key.trim(), mcp, edition, expire, expDate: expDate.toISOString(), activatedAt: Date.now() };
}

/* ── وضعیت لایسنس ── */
function status(store) {
  const mc = machineCode();
  const lic = store.kvGet('license');
  if (lic && lic.expDate && PUBKEY) {
    const msg = `${lic.mcp}.${lic.edition}.${lic.expire}`;
    const buf = Buffer.from(lic.key.split('.')[4].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    let ok = false;
    try {
      ok = crypto.verify(null, Buffer.from(msg),
        { key: PUBKEY, format: 'pem', type: 'spki' }, buf) && lic.mcp === mc.slice(0, 12);
    } catch (e) {}
    if (ok) {
      if (new Date(lic.expDate).getTime() >= Date.now())
        return { mode: 'active', edition: lic.edition, expire: lic.expire, machineCode: mc };
      return { mode: 'expired', edition: lic.edition, expire: lic.expire, machineCode: mc };
    }
  }
  const trial = store.kvGet('trial');
  if (!trial || !trial.start) return { mode: 'none', trialDays: TRIAL_DAYS, machineCode: mc };
  if (trial.start > Date.now()) return { mode: 'expired-trial', machineCode: mc };   // دستکاری ساعت
  const elapsed = Math.floor((Date.now() - trial.start) / 864e5);
  if (elapsed >= TRIAL_DAYS) return { mode: 'expired-trial', machineCode: mc };
  return { mode: 'trial', daysLeft: TRIAL_DAYS - elapsed, trialDays: TRIAL_DAYS, machineCode: mc };
}
function activate(store, key) {
  const lic = verifyKey(key, machineCode());
  if (!lic) return { ok: false, msg: 'کلید نامعتبر است یا متعلق به سیستم دیگری است' };
  if (new Date(lic.expDate).getTime() < Date.now()) return { ok: false, msg: 'این کلید منقضی شده است' };
  store.kvSet('license', lic); store.audit('license-activated', lic.edition);
  return { ok: true };
}
function startTrial(store) {
  const t = store.kvGet('trial');
  if (t && t.start) return { ok: false, msg: 'دوره آزمایشی قبلاً استفاده شده است' };
  store.kvSet('trial', { start: Date.now() }); store.audit('trial-started');
  return { ok: true };
}
function deactivate(store) { store.kvSet('license', null); store.audit('license-deactivated'); return { ok: true }; }
module.exports = { status, activate, startTrial, deactivate, machineCode };