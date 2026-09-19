import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const scrypt = promisify(scryptCallback);
const duration = 12 * 60 * 60 * 1000;
export async function passwordHash(password) {
  const salt = randomBytes(32).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function verify(password, encoded) {
  const [salt, hash] = encoded.split(':');
  if (!/^[a-f0-9]{64}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const derived = await scrypt(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}
export function createAuth({ directory, secure, allowSetup, configuredHash }) {
  const sessions = new Map();
  const challenges = new Map();
  const failures = [];
  const file = path.join(directory, '.admin-password');
  const cookieName = secure ? '__Host-blog-session' : 'blog-session';
  const cookie = (value, maxAge) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const hash = async () => configuredHash || await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  function session(req) {
    const id = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const value = sessions.get(id);
    if (!value || value.expires < Date.now()) { sessions.delete(id); return null; }
    return { ...value, id };
  }
  function challenge(req) { return (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('blog-login='))?.slice(11); }
  async function info(req, res, loginPage = false) {
    const current = session(req);
    if (current) return { authenticated: true, token: current.token };
    if (!loginPage) return { authenticated: false };
    const nonce = randomBytes(32).toString('hex');
    for (const [key, expires] of challenges) if (expires < Date.now()) challenges.delete(key);
    if (challenges.size >= 1000) challenges.delete(challenges.keys().next().value);
    challenges.set(nonce, Date.now() + 10 * 60 * 1000);
    res.setHeader('Set-Cookie', `blog-login=${nonce}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600${secure ? '; Secure' : ''}`);
    const configured = Boolean(await hash());
    return { authenticated: false, token: nonce, setup: !configured && allowSetup, unavailable: !configured && !allowSetup };
  }
  async function login(req, res, input) {
    const nonce = challenge(req);
    if (!nonce || nonce !== req.headers['x-writing-token'] || !(challenges.get(nonce) > Date.now())) throw Object.assign(new Error('Reload the login page and try again.'), { status: 403 });
    while (failures.length && failures[0] < Date.now() - 15 * 60 * 1000) failures.shift();
    if (failures.length >= 10) throw Object.assign(new Error('Too many attempts. Try again in 15 minutes.'), { status: 429 });
    const password = input.password;
    if (typeof password !== 'string' || password.length > 512) throw new Error('Enter your password.');
    let encoded = await hash();
    if (!encoded && allowSetup) {
      if (password.length < 12) throw new Error('Choose a password with at least 12 characters.');
      encoded = await passwordHash(password);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(file, encoded, { flag: 'wx', mode: 0o600 });
    } else if (!encoded || !await verify(password, encoded)) {
      failures.push(Date.now());
      throw Object.assign(new Error('Incorrect password.'), { status: 401 });
    }
    challenges.delete(nonce);
    failures.length = 0;
    for (const [id, value] of sessions) if (value.expires < Date.now()) sessions.delete(id);
    const id = randomBytes(32).toString('hex');
    sessions.set(id, { token: randomBytes(32).toString('hex'), expires: Date.now() + duration });
    res.setHeader('Set-Cookie', [cookie(id, duration / 1000), 'blog-login=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);
    return { authenticated: true };
  }
  function logout(req, res) { sessions.delete(session(req)?.id); res.setHeader('Set-Cookie', cookie('', 0)); }
  return { session, info, login, logout };
}
