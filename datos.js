// Función de Vercel: guarda y entrega los datos de la app en Upstash Redis.
// GET  /api/datos?rev=N  → { rev, db } (o { rev, igual: true } si no cambió nada)
// PUT  /api/datos        → body { baseRev, db }. Si alguien guardó antes, responde 409 con lo último.
// Todas las llamadas exigen la clave de acceso (variable CLAVE_ACCESO en Vercel).
// vercel.json dirige /api/datos a este archivo (vive junto a index.html, sin carpeta api).
const crypto = require('crypto');

const KEY_DB = 'orden:db';
const KEY_REV = 'orden:rev';
const MAX_FALLOS = 20;           // intentos fallidos permitidos por IP…
const VENTANA_FALLOS = 15 * 60;  // …cada 15 minutos

// Guarda solo si nadie cambió los datos desde la versión que tenía el dispositivo.
const GUARDAR_SI_NO_CAMBIO = `
local cur = redis.call('GET', KEYS[2]) or '0'
if cur ~= ARGV[1] then return {0, cur} end
local nrev = tostring(tonumber(cur) + 1)
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], nrev)
return {1, nrev}`;

// La integración de Upstash en Vercel crea KV_REST_API_URL / KV_REST_API_TOKEN
// (o con otro prefijo si se eligió uno al conectarla).
function credenciales() {
  const env = process.env;
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) return [env.KV_REST_API_URL, env.KV_REST_API_TOKEN];
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) return [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN];
  const urlKey = Object.keys(env).find(k => k.endsWith('_REST_API_URL') && env[k.replace(/_URL$/, '_TOKEN')]);
  return urlKey ? [env[urlKey], env[urlKey.replace(/_URL$/, '_TOKEN')]] : [null, null];
}

class ErrorApp extends Error {
  constructor(status, codigo, mensaje) { super(mensaje); this.status = status; this.codigo = codigo; }
}

async function redis(cmd) {
  const [url, token] = credenciales();
  if (!url || !token) throw new ErrorApp(500, 'sin-base', 'Falta conectar la base de datos (Upstash Redis) al proyecto en Vercel.');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new ErrorApp(502, 'base', 'La base de datos respondió con un error: ' + (j.error || r.status));
  return j.result;
}

const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const claveOk = dada => dada.length > 0 && crypto.timingSafeEqual(hash(dada), hash(process.env.CLAVE_ACCESO));
const ipDe = req => String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'desconocida').split(',')[0].trim();

function leerClave(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return '';
  try { return decodeURIComponent(auth.slice(7)); } catch { return auth.slice(7); }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (!process.env.CLAVE_ACCESO || process.env.CLAVE_ACCESO.length < 8) {
      throw new ErrorApp(500, 'sin-clave', 'Falta la variable CLAVE_ACCESO en Vercel (mínimo 8 caracteres).');
    }
    const dada = leerClave(req);
    // Sin clave no se cuenta como intento: es la app preguntando si debe pedirla
    if (!dada) return res.status(401).json({ error: 'clave', mensaje: 'Ingresa la clave de acceso' });

    const keyFallos = 'orden:fallos:' + ipDe(req);
    const [fallos, rev] = await redis(['MGET', keyFallos, KEY_REV]);
    if (Number(fallos) >= MAX_FALLOS) {
      return res.status(429).json({ error: 'bloqueado', mensaje: 'Demasiados intentos con clave incorrecta. Espera 15 minutos.' });
    }
    if (!claveOk(dada)) {
      const n = await redis(['INCR', keyFallos]);
      if (n === 1) await redis(['EXPIRE', keyFallos, VENTANA_FALLOS]);
      return res.status(401).json({ error: 'clave', mensaje: 'Clave incorrecta' });
    }
    if (fallos) await redis(['DEL', keyFallos]);

    const actual = String(rev || '0');
    if (req.method === 'GET') {
      const pedida = req.query && req.query.rev;
      if (pedida != null && String(pedida) === actual) return res.status(200).json({ rev: actual, igual: true });
      const db = actual === '0' ? null : await redis(['GET', KEY_DB]);
      return res.status(200).json({ rev: actual, db: db ? JSON.parse(db) : null });
    }
    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
      if (!body || !body.db || typeof body.db !== 'object' || !Array.isArray(body.db.clientes)) {
        return res.status(400).json({ error: 'formato', mensaje: 'Datos con formato inválido' });
      }
      const base = String(body.baseRev == null ? '0' : body.baseRev);
      const [ok, nrev] = await redis(['EVAL', GUARDAR_SI_NO_CAMBIO, '2', KEY_DB, KEY_REV, base, JSON.stringify(body.db)]);
      if (Number(ok) === 1) return res.status(200).json({ rev: String(nrev) });
      const db = await redis(['GET', KEY_DB]);
      return res.status(409).json({ rev: String(nrev), db: db ? JSON.parse(db) : null });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'metodo', mensaje: 'Método no permitido' });
  } catch (e) {
    const status = e instanceof ErrorApp ? e.status : 500;
    return res.status(status).json({ error: e.codigo || 'servidor', mensaje: e.message || 'Error del servidor' });
  }
};
