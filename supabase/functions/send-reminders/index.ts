// =====================================================================
//  Fonction send-reminders
//  Envoie le rappel « votre commande vous attend » N jours avant le
//  retrait (2 par défaut). Déclenchée chaque heure (à h 35) par Supabase Cron ;
//  elle n'envoie qu'à partir de l'heure réglée (heure de Paris) et une
//  seule fois par commande (colonne rappel_envoye_le).
//  Protégée par un secret partagé (en-tête x-cron-secret) : personne
//  d'autre ne peut la déclencher.
//  Paramètres facultatifs (corps JSON) : { "dry_run": true } pour lister
//  sans envoyer, { "force": true } pour ignorer l'heure et l'interrupteur.
// =====================================================================
import { buildEmail } from '../_shared/email-template.js';
import { adminClient, addDays, heureEnMinutes, isEmail, itemsAvecAllergenes, json, parisNow, safeEqual, sendWithBrevo, sender } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(req, 405, { error: 'methode_non_autorisee' });
  const expected = Deno.env.get('CRON_SECRET') ?? '';
  if (!expected || !safeEqual(req.headers.get('x-cron-secret') ?? '', expected)) {
    return json(req, 401, { error: 'non_autorise' });
  }
  let opts: { dry_run?: boolean; force?: boolean } = {};
  try { opts = await req.json(); } catch { /* corps vide : options par défaut */ }

  const sb = adminClient();
  const { data: settingsRow, error: sErr } = await sb.from('settings').select('data').eq('id', 1).maybeSingle();
  if (sErr) return json(req, 500, { error: 'lecture_impossible', detail: sErr.message });
  const settings = (settingsRow?.data ?? {}) as Record<string, any>;

  const actif = settings.rappel_actif === true;
  const heure = heureEnMinutes(settings.rappel_heure);
  const jours = Number.isFinite(Number(settings.rappel_jours)) ? Number(settings.rappel_jours) : 2;
  const now = parisNow();
  if (!opts.force && !opts.dry_run) {
    if (!actif) return json(req, 200, { ok: true, ignore: 'rappels_desactives' });
    if (now.minutes < heure) return json(req, 200, { ok: true, ignore: 'trop_tot', minutes_paris: now.minutes, minutes_envoi: heure });
  }

  const cible = addDays(now.date, jours);
  const { data: orders, error: qErr } = await sb.from('orders')
    .select('*')
    .eq('date_retrait', cible)
    .not('statut', 'in', '("annulee","retiree")')
    .is('rappel_envoye_le', null);
  if (qErr) return json(req, 500, { error: 'lecture_impossible', detail: qErr.message });

  // Pas de rappel pour une commande passée le jour du rappel ou après : la confirmation suffit
  const tardives = (orders ?? []).filter((o) => o.created_at && parisNow(new Date(o.created_at)).date >= now.date);
  const candidates = (orders ?? []).filter((o) => !tardives.includes(o));
  const aEnvoyer = candidates.filter((o) => isEmail(o.client_email));
  const sansEmail = candidates.length - aEnvoyer.length;
  if (opts.dry_run) {
    return json(req, 200, { ok: true, dry_run: true, date_cible: cible, a_envoyer: aEnvoyer.map((o) => ({ numero: o.numero, client: o.client_nom })), sans_email: sansEmail, commandes_recentes: tardives.length });
  }

  const from = sender(settings);
  if (!Deno.env.get('BREVO_API_KEY') || !from) return json(req, 503, { error: 'email_non_configure' });

  const resultats: Array<{ numero: string; ok: boolean; erreur?: string }> = [];
  for (const o of aEnvoyer) {
    const items = await itemsAvecAllergenes(sb, o.id);
    const mail = buildEmail('rappel', o, items, settings);
    const res = await sendWithBrevo({
      to: o.client_email, toName: o.client_nom, subject: mail.subject, html: mail.html, text: mail.text,
      fromEmail: from.email, fromName: from.name, replyTo: settings?.boutique?.email || from.email
    });
    await sb.from('email_log').insert({
      order_id: o.id, type: 'rappel', destinataire: o.client_email,
      statut: res.ok ? 'envoye' : 'erreur', fournisseur_id: res.messageId ?? null, erreur: res.error ?? null
    });
    if (res.ok) await sb.from('orders').update({ rappel_envoye_le: new Date().toISOString() }).eq('id', o.id);
    resultats.push({ numero: o.numero, ok: res.ok, ...(res.error ? { erreur: res.error } : {}) });
  }
  return json(req, 200, { ok: true, date_cible: cible, envoyes: resultats.filter((r) => r.ok).length, erreurs: resultats.filter((r) => !r.ok), sans_email: sansEmail, commandes_recentes: tardives.length });
});
