// Outils communs aux fonctions Supabase de l'appli de commandes.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.2';

// Adresses autorisées à appeler les fonctions depuis un navigateur
const ALLOWED_ORIGINS = [
  'https://coolinecode.github.io',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

/** Clés du projet : ancien nom (anon / service_role) ou nouveau (publishable / secret). */
function keyFromEnv(legacyName: string, newName: string): string {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  try {
    const all = JSON.parse(Deno.env.get(newName) ?? '{}');
    return all.default ?? Object.values(all)[0] ?? '';
  } catch {
    return '';
  }
}
export const SUPABASE_URL = () => Deno.env.get('SUPABASE_URL') ?? '';
export const PUBLIC_KEY = () => keyFromEnv('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
export const SECRET_KEY = () => keyFromEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');

/** Client qui agit avec les droits de l'utilisateur connecté (les règles RLS s'appliquent). */
export function userClient(authHeader: string): SupabaseClient {
  return createClient(SUPABASE_URL(), PUBLIC_KEY(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/** Client serveur (contourne les règles RLS) : réservé aux tâches planifiées. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL(), SECRET_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const isEmail = (s: unknown): s is string =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Comparaison en temps constant (évite de deviner un secret caractère par caractère). */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Date et heure actuelles à Paris (gère l'heure d'été). */
export function parisNow(now = new Date()): { date: string; hour: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(get('hour'));
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour, minutes: hour * 60 + Number(get('minute')) };
}

/** Heure réglée (« 11:30 » ou 11.5) convertie en minutes depuis minuit. */
export function heureEnMinutes(v: unknown, defaut = 11 * 60 + 30): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 60);
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : defaut;
}

/** Lignes d'une commande, complétées des allergènes de la fiche catalogue. */
export async function itemsAvecAllergenes(sb: SupabaseClient, orderId: string): Promise<Record<string, unknown>[]> {
  const { data: items } = await sb.from('order_items').select('*').eq('order_id', orderId).order('position');
  const ids = [...new Set((items ?? []).map((i) => i.product_id).filter(Boolean))];
  if (!ids.length) return items ?? [];
  const { data: products } = await sb.from('products').select('id, allergenes').in('id', ids);
  const map = new Map((products ?? []).map((p) => [p.id, p.allergenes ?? '']));
  return (items ?? []).map((i) => ({ ...i, allergenes: map.get(i.product_id) ?? '' }));
}
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export interface SendResult { ok: boolean; messageId?: string; error?: string }

/** Envoi via l'API transactionnelle de Brevo. */
export async function sendWithBrevo(msg: {
  to: string; toName?: string; subject: string; html: string; text: string;
  fromEmail: string; fromName: string; replyTo?: string; bcc?: string;
}): Promise<SendResult> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) return { ok: false, error: 'BREVO_API_KEY absente' };
  const body: Record<string, unknown> = {
    sender: { email: msg.fromEmail, name: msg.fromName },
    to: [{ email: msg.to.trim(), ...(msg.toName ? { name: msg.toName } : {}) }],
    subject: msg.subject,
    htmlContent: msg.html,
    textContent: msg.text
  };
  if (msg.replyTo) body.replyTo = { email: msg.replyTo };
  if (msg.bcc && msg.bcc.trim().toLowerCase() !== msg.to.trim().toLowerCase()) body.bcc = [{ email: msg.bcc }];
  try {
    // Adresse de remplacement acceptée uniquement en local (tests) : la clé ne part jamais ailleurs
    const override = Deno.env.get('BREVO_API_URL') ?? '';
    const url = override.startsWith('http://localhost') ? override : 'https://api.brevo.com/v3/smtp/email';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `Brevo ${res.status} : ${data.message ?? data.code ?? 'erreur'}` };
    return { ok: true, messageId: data.messageId };
  } catch (e) {
    return { ok: false, error: 'Brevo injoignable : ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Expéditeur : variable d'environnement en priorité, sinon réglage de l'appli. */
export function sender(settings: Record<string, any>): { email: string; name: string } | null {
  const email = Deno.env.get('EMAIL_FROM') || settings?.email_expediteur || '';
  const name = settings?.boutique?.nom || "L'Atelier des Rêves";
  return isEmail(email) ? { email: email.trim(), name } : null;
}
