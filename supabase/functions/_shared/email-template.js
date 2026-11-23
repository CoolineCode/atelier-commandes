// =====================================================================
//  Modèles d'emails de L'Atelier des Rêves
//  Un seul fichier, utilisé par :
//  - l'appli (aperçu, et « Ouvrir dans ma messagerie » en mode texte) ;
//  - les fonctions Supabase (envoi réel de la confirmation et du rappel).
//  Charte : blanc dominant, rose #F7A19E en accent, texte cacao #3D2E2A,
//  logo rond. Mise en page en tableaux et styles en ligne, pour que les
//  messageries (Gmail, Outlook, Apple Mail) l'affichent correctement.
// =====================================================================

export const DEFAULT_SITE_URL = 'https://coolinecode.github.io/atelier-commandes/';

const C = {
  rose: '#F7A19E', roseVoile: '#FEF3F2', roseEncre: '#B0524C',
  cacao: '#3D2E2A', taupe: '#76625C', ligne: '#EEE2E0', blanc: '#FFFFFF'
};
const FONT = "'Figtree', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)
  .replace(/\u202f/g, '\u00a0');

export function fmtDateLong(s) {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  const txt = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return txt;
}
const fmtTime = (t) => t ? String(t).slice(0, 5).replace(':', 'h') : '';

/** Montants d'une commande : total, acompte, reste à payer au retrait. */
export function montants(order) {
  const total = round2(order.total_ttc || 0);
  const acompte = round2(order.acompte_montant || 0);
  const reste = order.paye ? 0 : Math.max(0, round2(total - acompte));
  return { total, acompte, reste, paye: !!order.paye };
}

/** Lieu de retrait (nom, adresse, consignes) à partir des réglages. */
export function lieuDe(order, settings) {
  const lieux = (settings && settings.lieux) || [];
  return lieux.find((l) => l.id === (order.lieu_retrait || 'boutique')) || lieux[0] || { nom: 'À la boutique', adresse: '', infos: '' };
}

function contexte(order, items, settings) {
  const s = settings || {};
  const b = s.boutique || {};
  return {
    o: order,
    items: (items || []).slice().sort((a, c) => (a.position || 0) - (c.position || 0)),
    m: montants(order),
    lieu: lieuDe(order, s),
    boutique: { nom: b.nom || "L'Atelier des Rêves", adresse: b.adresse || '', telephone: b.telephone || '', email: b.email || '' },
    paiement: s.paiement_texte || 'Carte bancaire ou espèces',
    pied: s.email_pied || '',
    siteUrl: s.site_url || DEFAULT_SITE_URL
  };
}

/**
 * Construit un email.
 * @param {'confirmation'|'rappel'} kind
 * @returns {{subject: string, html: string, text: string}}
 */
export function buildEmail(kind, order, items, settings) {
  const x = contexte(order, items, settings);
  const { o, m, lieu, boutique } = x;
  const quand = `${fmtDateLong(o.date_retrait)}${o.creneau ? ' à ' + fmtTime(o.creneau) : ''}`;
  const prenom = (o.client_nom || '').trim();
  const isRappel = kind === 'rappel';

  const subject = isRappel
    ? `Rappel : votre commande vous attend ${fmtDateLong(o.date_retrait)}`
    : `Votre commande ${o.numero || ''} est confirmée`.replace(/\s+/g, ' ').trim();
  const titre = isRappel ? 'Votre commande vous attend' : 'Votre commande est confirmée';
  const intro = isRappel
    ? `Bonjour ${prenom}, petit rappel\u00a0: votre commande sera prête ${quand}.`
    : `Bonjour ${prenom}, merci pour votre commande\u00a0! Voici son récapitulatif.`;

  // ---------- Texte brut (aussi utilisé pour « Ouvrir dans ma messagerie »)
  const lignesTxt = x.items.map((i) => `- ${i.quantite} × ${i.libelle}${i.format ? ' (' + i.format + ')' : ''} : ${eur(i.total_ttc)}`).join('\n');
  const text = [
    titre.toUpperCase(), '',
    intro, '',
    `Commande : ${o.numero || ''}`,
    `Retrait : ${quand}`,
    `Lieu : ${lieu.nom}${lieu.adresse ? ', ' + lieu.adresse : ''}`,
    lieu.infos ? `Accès : ${lieu.infos}` : null, '',
    'Votre commande :', lignesTxt, '',
    `Total : ${eur(m.total)}`,
    m.acompte > 0 ? `Acompte versé : ${eur(m.acompte)}` : null,
    m.paye ? 'Commande déjà réglée.' : `Reste à payer au retrait : ${eur(m.reste)}`,
    m.paye ? null : `Moyens de paiement acceptés : ${x.paiement}`,
    o.message_gateau ? `\nInscription sur le gâteau : « ${o.message_gateau} »` : null,
    o.allergies ? `Allergies signalées : ${o.allergies}` : null, '',
    x.pied || null,
    `${boutique.nom}${boutique.adresse ? ' · ' + boutique.adresse : ''}`,
    [boutique.telephone, boutique.email].filter(Boolean).join(' · ') || null
  ].filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');

  // ---------- HTML
  const row = (label, value, strong) => `
    <tr>
      <td style="padding:6px 0;font:15px/1.4 ${FONT};color:${C.taupe};">${label}</td>
      <td align="right" style="padding:6px 0;font:${strong ? '700 18px' : '600 15px'}/1.4 ${FONT};color:${strong ? C.roseEncre : C.cacao};white-space:nowrap;">${value}</td>
    </tr>`;
  const lignesHtml = x.items.map((i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.ligne};font:15px/1.4 ${FONT};color:${C.cacao};">
        <strong>${esc(i.quantite)} ×</strong> ${esc(i.libelle)}${i.format ? ` <span style="color:${C.taupe};">(${esc(i.format)})</span>` : ''}
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.ligne};font:600 15px/1.4 ${FONT};color:${C.cacao};white-space:nowrap;">${eur(i.total_ttc)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.blanc};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.blanc};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td align="center" style="padding:0 0 18px;">
      <img src="${esc(x.siteUrl)}assets/logo.png" width="112" height="112" alt="${esc(boutique.nom)}" style="display:block;width:112px;height:112px;border-radius:56px;border:0;">
    </td></tr>
    <tr><td style="border:1px solid ${C.ligne};border-top:6px solid ${C.rose};border-radius:18px;padding:28px 28px 24px;">
      <h1 style="margin:0 0 10px;font:800 26px/1.2 ${FONT};color:${C.cacao};">${esc(titre)}</h1>
      <p style="margin:0 0 22px;font:16px/1.5 ${FONT};color:${C.cacao};">${esc(intro)}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.roseVoile};border-radius:14px;">
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 4px;font:600 13px/1.4 ${FONT};color:${C.roseEncre};">Retrait</p>
          <p style="margin:0 0 8px;font:700 18px/1.35 ${FONT};color:${C.cacao};">${esc(quand.charAt(0).toUpperCase() + quand.slice(1))}</p>
          <p style="margin:0;font:15px/1.5 ${FONT};color:${C.cacao};"><strong>${esc(lieu.nom)}</strong>${lieu.adresse ? `<br>${nl2br(lieu.adresse)}` : ''}${lieu.infos ? `<br><span style="color:${C.taupe};">${nl2br(lieu.infos)}</span>` : ''}</p>
        </td></tr>
      </table>

      <p style="margin:24px 0 4px;font:600 13px/1.4 ${FONT};color:${C.roseEncre};">Votre commande ${o.numero ? '<span style="color:' + C.taupe + ';font-weight:400;">· ' + esc(o.numero) + '</span>' : ''}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignesHtml}</table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
        ${row('Total TTC', eur(m.total))}
        ${m.acompte > 0 ? row('Acompte versé', '− ' + eur(m.acompte)) : ''}
        ${m.paye ? row('Commande', 'Déjà réglée', true) : row('Reste à payer au retrait', eur(m.reste), true)}
      </table>
      ${m.paye ? '' : `<p style="margin:12px 0 0;font:14px/1.5 ${FONT};color:${C.taupe};">Moyens de paiement acceptés&nbsp;: <strong style="color:${C.cacao};">${esc(x.paiement)}</strong></p>`}

      ${o.message_gateau || o.allergies ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px dashed ${C.ligne};">
        <tr><td style="padding-top:14px;font:14px/1.5 ${FONT};color:${C.cacao};">
          ${o.message_gateau ? `Inscription sur le gâteau&nbsp;: <strong>«&nbsp;${esc(o.message_gateau)}&nbsp;»</strong><br>` : ''}
          ${o.allergies ? `Allergies signalées&nbsp;: <strong>${esc(o.allergies)}</strong>` : ''}
        </td></tr>
      </table>` : ''}
    </td></tr>

    <tr><td align="center" style="padding:20px 12px 0;font:13px/1.6 ${FONT};color:${C.taupe};">
      ${x.pied ? `<p style="margin:0 0 10px;">${nl2br(x.pied)}</p>` : ''}
      <p style="margin:0;"><strong style="color:${C.cacao};">${esc(boutique.nom)}</strong>${boutique.adresse ? '<br>' + nl2br(boutique.adresse) : ''}</p>
      ${boutique.telephone || boutique.email ? `<p style="margin:4px 0 0;">${[boutique.telephone ? esc(boutique.telephone) : '', boutique.email ? `<a href="mailto:${esc(boutique.email)}" style="color:${C.roseEncre};">${esc(boutique.email)}</a>` : ''].filter(Boolean).join(' · ')}</p>` : ''}
      <p style="margin:10px 0 0;">Une question&nbsp;? Répondez simplement à cet email.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  return { subject, html, text };
}
