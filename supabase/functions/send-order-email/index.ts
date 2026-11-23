// =====================================================================
//  Fonction send-order-email
//  Envoie l'email de confirmation d'une commande au client.
//  Appelée par l'appli, avec la session de l'utilisatrice connectée :
//  les règles RLS s'appliquent, donc seule une adresse de app_admins
//  peut lire la commande et déclencher l'envoi. Le destinataire est
//  toujours l'email enregistré sur la commande (pas un paramètre libre).
// =====================================================================
import { buildEmail } from '../_shared/email-template.js';
import { corsHeaders, isEmail, json, sendWithBrevo, sender, userClient } from '../_shared/common.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'methode_non_autorisee' });

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json(req, 401, { error: 'non_connecte' });
  const sb = userClient(auth);
  const { data: who, error: authErr } = await sb.auth.getUser(auth.slice(7));
  if (authErr || !who?.user) return json(req, 401, { error: 'non_connecte' });

  let payload: { order_id?: string; type?: string };
  try { payload = await req.json(); } catch { return json(req, 400, { error: 'requete_invalide' }); }
  const type = payload.type ?? 'confirmation';
  if (!payload.order_id || !UUID.test(payload.order_id)) return json(req, 400, { error: 'commande_invalide' });
  if (type !== 'confirmation') return json(req, 400, { error: 'type_invalide' });

  // Lecture avec les droits de l'utilisatrice : rien n'est visible si elle n'est pas autorisée
  const { data: order, error: oErr } = await sb.from('orders').select('*').eq('id', payload.order_id).maybeSingle();
  if (oErr) return json(req, 500, { error: 'lecture_impossible', detail: oErr.message });
  if (!order) return json(req, 404, { error: 'commande_introuvable' });
  if (!isEmail(order.client_email)) return json(req, 422, { error: 'email_client_absent' });

  const [{ data: items }, { data: settingsRow }] = await Promise.all([
    sb.from('order_items').select('*').eq('order_id', order.id).order('position'),
    sb.from('settings').select('data').eq('id', 1).maybeSingle()
  ]);
  const settings = (settingsRow?.data ?? {}) as Record<string, any>;
  const from = sender(settings);
  if (!Deno.env.get('BREVO_API_KEY') || !from) return json(req, 503, { error: 'email_non_configure' });

  const mail = buildEmail('confirmation', order, items ?? [], settings);
  const res = await sendWithBrevo({
    to: order.client_email, toName: order.client_nom, subject: mail.subject, html: mail.html, text: mail.text,
    fromEmail: from.email, fromName: from.name,
    replyTo: settings?.boutique?.email || from.email,
    bcc: settings?.email_copie || undefined
  });

  await sb.from('email_log').insert({
    order_id: order.id, type: 'confirmation', destinataire: order.client_email,
    statut: res.ok ? 'envoye' : 'erreur', fournisseur_id: res.messageId ?? null, erreur: res.error ?? null
  });
  if (!res.ok) return json(req, 502, { error: 'envoi_echoue', detail: res.error });

  const sentAt = new Date().toISOString();
  await sb.from('orders').update({ confirmation_envoyee_le: sentAt }).eq('id', order.id);
  return json(req, 200, { ok: true, envoye_le: sentAt, destinataire: order.client_email });
});
