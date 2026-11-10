import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const env = (k) => process.env[k] || "";
const db = () => getStore("essaylock");
const get = (k) => db().get(k, { type: "json" });
const put = (k, v) => db().setJSON(k, v);
const del = (k) => db().delete(k);
const J = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", ...h } });
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const scrypt = (p, salt) => new Promise((res, rej) => crypto.scrypt(p, salt, 64, (e, k) => (e ? rej(e) : res(k.toString("hex")))));
const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(crypto.randomBytes(8), (x) => A[x % A.length]).join("");
const okName = (id) => /^[a-z0-9_.-]{3,30}$/.test(id);
const okPw = (p) => p.length >= 6 && p.length <= 128;
const flagRe = /exited|left window|blocked|resized/i;
const EV = new Set(["Essay started", "Essay finished", "Exited fullscreen", "Left window or tab", "Returned to window", "Paste blocked", "Copy blocked", "Cut blocked", "Drop blocked", "Shortcut blocked", "Blocked input", "Large insert blocked", "Window resized (split screen or devtools?)"]);

// rate limiting (stored in Netlify Blobs)
async function hit(key, max, win) {
  const now = Date.now(), r = (await get("rl:" + key)) || { n: 0, t: now };
  if (now - r.t > win) { r.n = 0; r.t = now; }
  r.n++; await put("rl:" + key, r); return r.n > max;
}
async function blocked(key, max, win) { const r = await get("rl:" + key); return !!r && Date.now() - r.t <= win && r.n >= max; }

// sessions: random token in an HttpOnly cookie, only its hash is stored server-side
const COOKIE = "__Host-sid";
async function newSession(id) {
  const tok = crypto.randomBytes(32).toString("base64url");
  await put("s:" + sha(tok), { u: id, exp: Date.now() + 8 * 3600e3, seen: Date.now() });
  return `${COOKIE}=${tok}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
}
async function session(req) {
  const m = (req.headers.get("cookie") || "").match(/(?:^|; )__Host-sid=([A-Za-z0-9_-]{20,64})/);
  if (!m) return null;
  const k = "s:" + sha(m[1]), s = await get(k), now = Date.now();
  if (!s || s.exp < now || now - s.seen > 2 * 3600e3) { if (s) await del(k); return null; } // 8h max, 2h idle
  if (now - s.seen > 300e3) { s.seen = now; await put(k, s); }
  return { ...s, k };
}
const csrfOk = (req) => {
  if (req.method === "GET") return true;
  if (req.headers.get("x-requested-with") !== "essaylock") return false;
  const o = req.headers.get("origin");
  try { return !o || new URL(o).host === new URL(req.url).host; } catch { return false; }
};
async function gateOpen(u) {
  if (u.allow) return true;
  if (!u.cls) return false;
  const t = await get("u:" + u.cls);
  return !!(t && t.active);
}

export default async (req, ctx) => {
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, ""), q = url.searchParams;
  if (!csrfOk(req)) return J({ error: "Blocked" }, 403);
  if (Number(req.headers.get("content-length") || 0) > 100000) return J({ error: "Too large" }, 413);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const ip = req.headers.get("x-nf-client-connection-ip") || (ctx && ctx.ip) || "x";
  const bad = async (msg, code) => { await hit("f:" + ip, 8, 900e3); return J({ error: msg }, code); };

  if ((path === "signup" || path === "login") && req.method === "POST") {
    if (await hit("ip:" + ip, 40, 600e3)) return J({ error: "Too many requests. Try again later." }, 429);
    if (await blocked("f:" + ip, 8, 900e3)) return J({ error: "Too many failed attempts. Try again in 15 minutes." }, 429);
  }

  if (path === "signup" && req.method === "POST") {
    const name = String(body.username || "").trim(), id = name.toLowerCase(), pw = String(body.password || "");
    if (!okName(id)) return J({ error: "Username: 3-30 letters, numbers, . _ -" }, 400);
    if (!okPw(pw)) return J({ error: "Password must be 6-128 characters" }, 400);
    if (await get("u:" + id)) return J({ error: "That username is taken" }, 409);
    const isT = body.role === "teacher";
    const u = { email: id, name, joined: Date.now(), cls: null, allow: false, role: isT ? "teacher" : "student", last: Date.now(), salt: crypto.randomBytes(16).toString("hex") };
    if (isT) {
      if (!env("TEACHER_CODE") || !same(body.code || "", env("TEACHER_CODE"))) return bad("Wrong teacher code", 403);
      u.code = newCode(); u.active = false; u.members = []; await put("c:" + u.code, id);
    } else {
      const code = String(body.code || "").toUpperCase().trim(), tId = await get("c:" + code), t = tId && (await get("u:" + tId));
      if (!t) return bad("That class code doesn't exist", 404);
      if (!t.members.includes(id)) t.members.push(id);
      await put("u:" + t.email, t); u.cls = t.email;
    }
    u.hash = await scrypt(pw, u.salt); await put("u:" + id, u);
    return J({ ok: true }, 200, { "set-cookie": await newSession(id) });
  }
  if (path === "login" && req.method === "POST") {
    const id = String(body.username || "").trim().toLowerCase();
    if (!okName(id)) return bad("Wrong username or password", 401);
    const f = (await get("lu:" + id)) || { c: 0, t: 0 };
    if (Date.now() < f.t) return J({ error: "Too many tries. Wait " + Math.ceil((f.t - Date.now()) / 1000) + "s." }, 429);
    const u = await get("u:" + id);
    const h = await scrypt(String(body.password || "").slice(0, 128), u ? u.salt : "0".repeat(32)); // same work whether or not the user exists
    if (!u || !same(h, u.hash)) { f.c++; if (f.c >= 5) f.t = Date.now() + 30000 * 2 ** Math.min(f.c - 5, 4); await put("lu:" + id, f); return bad("Wrong username or password", 401); }
    await put("lu:" + id, { c: 0, t: 0 }); u.last = Date.now(); await put("u:" + id, u);
    return J({ ok: true, role: u.role }, 200, { "set-cookie": await newSession(id) });
  }
  if (path === "logout") {
    const s = await session(req); if (s) await del(s.k);
    return J({ ok: true }, 200, { "set-cookie": `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` });
  }

  const s = await session(req);
  const me = s && (await get("u:" + s.u));
  if (!me) return J({ error: "Not signed in" }, 401);
  const isT = me.role === "teacher";

  if (path === "me") {
    const open = isT || (await gateOpen(me));
    return J({ name: me.name, role: me.role, joined: !!(isT || me.cls), open, code: isT ? me.code : undefined, active: isT ? me.active : undefined });
  }

  if (!isT) {
    if (path === "join" && req.method === "POST") {
      if (await blocked("f:" + ip, 8, 900e3)) return J({ error: "Too many failed attempts. Try again in 15 minutes." }, 429);
      const code = String(body.code || "").toUpperCase().trim(), tId = await get("c:" + code), t = tId && (await get("u:" + tId));
      if (!t) return bad("That class code doesn't exist", 404);
      if (!t.members.includes(me.email)) { t.members.push(me.email); await put("u:" + t.email, t); }
      me.cls = t.email; await put("u:" + me.email, me);
      return J({ ok: true });
    }
    if (path === "event" && req.method === "POST") {
      if (!(await gateOpen(me))) return J({ error: "Class not active" }, 403);
      if (await hit("ev:" + me.email, 600, 600e3)) return J({ error: "Slow down" }, 429);
      const type = String(body.type || "");
      if (!EV.has(type)) return J({ error: "Unknown event" }, 400);
      const ev = (await get("e:" + me.email)) || [];
      ev.push({ t: Date.now(), type, detail: String(body.detail || "").slice(0, 60) });
      await put("e:" + me.email, ev.slice(-500));
      return J({ ok: true });
    }
    if (path === "replay" && req.method === "POST") {
      if (!(await gateOpen(me))) return J({ error: "Class not active" }, 403);
      const r = (await get("r:" + me.email)) || { s: Date.now(), o: [] };
      for (const o of (Array.isArray(body.ops) ? body.ops : []).slice(0, 500)) {
        if (Array.isArray(o) && o.length === 4 && o.slice(0, 3).every((n) => Number.isInteger(n) && n >= 0) && typeof o[3] === "string" && o[3].length <= 12) r.o.push(o);
      }
      await put("r:" + me.email, { s: r.s, o: r.o.slice(-8000) });
      return J({ ok: true });
    }
    return J({ error: "Not found" }, 404);
  }

  // teacher routes (own class only)
  const mine = (e) => me.members.includes(String(e || "").toLowerCase());
  if (path === "class") {
    const roster = await Promise.all(me.members.map(async (e) => {
      const u = await get("u:" + e), ev = (await get("e:" + e)) || [];
      return { email: e, name: u.name, allow: !!u.allow, last: u.last, flags: ev.filter((x) => flagRe.test(x.type)).length };
    }));
    return J({ code: me.code, active: !!me.active, roster });
  }
  if (path === "class/active" && req.method === "POST") { me.active = !!body.active; await put("u:" + me.email, me); return J({ ok: true, active: me.active }); }
  if (path === "allow" && req.method === "POST") {
    if (!mine(body.email)) return J({ error: "Not in your class" }, 403);
    const u = await get("u:" + String(body.email).toLowerCase()); u.allow = !!body.allow; await put("u:" + u.email, u);
    return J({ ok: true });
  }
  if (path === "remove" && req.method === "POST") {
    if (!mine(body.email)) return J({ error: "Not in your class" }, 403);
    const u = await get("u:" + String(body.email).toLowerCase());
    me.members = me.members.filter((x) => x !== u.email); u.cls = null; u.allow = false;
    await put("u:" + me.email, me); await put("u:" + u.email, u);
    return J({ ok: true });
  }
  if (path === "reset" && req.method === "POST") {
    if (!mine(body.email)) return J({ error: "Not in your class" }, 403);
    const pw = String(body.password || ""); if (!okPw(pw)) return J({ error: "Password must be 6-128 characters" }, 400);
    const u = await get("u:" + String(body.email).toLowerCase());
    u.salt = crypto.randomBytes(16).toString("hex"); u.hash = await scrypt(pw, u.salt);
    await put("u:" + u.email, u); await put("lu:" + u.email, { c: 0, t: 0 });
    return J({ ok: true });
  }
  if (path === "events") { if (!mine(q.get("email"))) return J({ error: "Not in your class" }, 403); return J((await get("e:" + q.get("email").toLowerCase())) || []); }
  if (path === "replay") { if (!mine(q.get("email"))) return J({ error: "Not in your class" }, 403); return J((await get("r:" + q.get("email").toLowerCase())) || { o: [] }); }
  return J({ error: "Not found" }, 404);
};

export const config = { path: "/api/*" };
