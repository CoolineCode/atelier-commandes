/* =====================================================================
   L'Atelier des Rêves — Appli de prise de commande (V1)
   Vanilla JS. Deux sources de données interchangeables :
   - DemoStore     : localStorage, données d'exemple
   - SupabaseStore : base Supabase (voir supabase/schema.sql)
   ===================================================================== */
(function () {
  'use strict';

  const CFG = Object.assign({ MODE: 'demo', SUPABASE_URL: '', SUPABASE_ANON_KEY: '', NOM_BOUTIQUE: "L'Atelier des Rêves" }, window.APP_CONFIG || {});
  const logoImg = document.querySelector('.rail-logo img');
  const LOGO_SRC = logoImg ? logoImg.getAttribute('src') : 'assets/logo.png';

  /* ------------------------------------------------------------------
     Utilitaires
     ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const num = (v, d = 0) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  const euroFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const eur = (n) => euroFmt.format(Number(n) || 0);
  const pct = (t) => (Math.round(Number(t) * 1000) / 10).toString().replace('.', ',') + ' %';

  // Dates en heure locale, toujours au format AAAA-MM-JJ (jamais toISOString : décalage UTC)
  const pad = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => toDateStr(new Date());
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); };
  const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
  const weekday = (s) => parseDate(s).getDay(); // 0 = dimanche
  const mondayOf = (s) => { const w = weekday(s); return addDays(s, w === 0 ? -6 : 1 - w); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtDay = (s, opts) => cap(parseDate(s).toLocaleDateString('fr-FR', opts || { weekday: 'long', day: 'numeric', month: 'long' }));
  const fmtShort = (s) => parseDate(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const relDay = (s) => {
    const d = diffDays(s, today());
    if (d === 0) return "Aujourd'hui";
    if (d === 1) return 'Demain';
    if (d === -1) return 'Hier';
    return null;
  };
  const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const timeToMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const fmtTime = (t) => t ? t.replace(':', 'h') : '';

  const safeStorage = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    remove(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ------------------------------------------------------------------
     Icônes (traits simples, couleur héritée)
     ------------------------------------------------------------------ */
  const ICONS = {
    day: '<path d="M12 3v2M12 19v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M3 12h2M19 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    cake: '<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 16c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0"/><path d="M12 12V8M12 5.5c.8-.9.8-1.8 0-2.5-.8.7-.8 1.6 0 2.5z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ------------------------------------------------------------------
     Référentiels
     ------------------------------------------------------------------ */
  const STATUTS = {
    recue: { label: 'Reçue', next: 'preparation', action: 'Commencer' },
    preparation: { label: 'En préparation', next: 'prete', action: 'Marquer prête' },
    prete: { label: 'Prête', next: 'retiree', action: 'Marquer retirée' },
    retiree: { label: 'Retirée' },
    annulee: { label: 'Annulée' }
  };
  const FLOW = ['recue', 'preparation', 'prete', 'retiree'];
  const CANAUX = { telephone: 'Téléphone', boutique: 'En boutique', email: 'Email', reseaux: 'Réseaux sociaux', autre: 'Autre' };
  const MOYENS = ['Carte bancaire', 'Espèces', 'Chèque', 'Virement', 'Autre'];
  const TVAS = [0.055, 0.10, 0.20];
  const CATEGORIES = ['Entremets', 'Tarte', 'Bûche', 'Galette', "Gâteau d'anniversaire", 'Pièce montée / wedding cake', 'Petits gâteaux', 'Viennoiserie', 'Chocolat / confiserie', 'Autre'];
  const SAISONS = ["Toute l'année", 'Galette', 'Saint-Valentin', 'Pâques', 'Fête des mères', 'Fête des pères', 'Été', 'Halloween', 'Noël', 'Autre'];

  const DEFAULT_SETTINGS = {
    creneau_minutes: 30,
    max_commandes_creneau: 4,
    capacite_jour: 25,
    horaires: {
      0: { ouvert: true, debut: '08:00', fin: '13:00' },
      1: { ouvert: false, debut: '08:00', fin: '19:00' },
      2: { ouvert: true, debut: '08:00', fin: '19:00' },
      3: { ouvert: true, debut: '08:00', fin: '19:00' },
      4: { ouvert: true, debut: '08:00', fin: '19:00' },
      5: { ouvert: true, debut: '08:00', fin: '19:00' },
      6: { ouvert: true, debut: '08:00', fin: '19:00' }
    },
    fermetures: []
  };
  const mergeSettings = (data) => {
    const d = data || {};
    const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    ['creneau_minutes', 'max_commandes_creneau', 'capacite_jour'].forEach((k) => { if (d[k] != null) out[k] = Number(d[k]); });
    if (d.horaires) for (let i = 0; i < 7; i++) if (d.horaires[i]) out.horaires[i] = Object.assign(out.horaires[i], d.horaires[i]);
    if (Array.isArray(d.fermetures)) out.fermetures = d.fermetures;
    return out;
  };

  /* ------------------------------------------------------------------
     Données de démonstration (relatives à la date du jour)
     ------------------------------------------------------------------ */
  function buildDemoData() {
    const t = today();
    const y = parseDate(t).getFullYear();
    const P = (nom, format, categorie, saison, prix_ttc, prix_ht_pro, delai, allergenes, description) => ({
      id: uid(), nom, format, categorie, saison, prix_ttc, prix_ht_pro, tva: 0.055, delai_jours: delai,
      allergenes, description, actif: true, created_at: new Date().toISOString()
    });
    const products = [
      P('Bûche praliné noisette', '6 parts', 'Bûche', 'Noël', 34, null, 3, 'Gluten, œufs, lait, fruits à coque', 'Biscuit noisette, mousse praliné, croustillant feuilletine'),
      P('Bûche framboise vanille', '6 parts', 'Bûche', 'Noël', 34, null, 3, 'Gluten, œufs, lait', 'Mousse vanille, insert framboise'),
      P('Bûche chocolat intense', '8 parts', 'Bûche', 'Noël', 42, null, 3, 'Gluten, œufs, lait, soja', 'Trois textures de chocolat noir'),
      P('Galette frangipane', '6 parts', 'Galette', 'Galette', 22, 17.5, 2, 'Gluten, œufs, lait, fruits à coque', 'Feuilletage pur beurre, crème d’amande'),
      P('Fraisier', '6 parts', 'Entremets', "Toute l'année", 30, null, 2, 'Gluten, œufs, lait', 'Génoise, crème mousseline, fraises fraîches'),
      P('Paris-Brest', '6 parts', 'Entremets', "Toute l'année", 28, null, 2, 'Gluten, œufs, lait, fruits à coque', 'Pâte à choux, crème praliné'),
      P('Entremets trois chocolats', '8 parts', 'Entremets', "Toute l'année", 32, null, 2, 'Gluten, œufs, lait, soja', ''),
      P('Tarte citron meringuée', '8 parts', 'Tarte', "Toute l'année", 26, 21, 1, 'Gluten, œufs, lait', ''),
      P('Number cake', '10 parts', "Gâteau d'anniversaire", "Toute l'année", 45, null, 5, 'Gluten, œufs, lait', 'Chiffre ou lettre, décor au choix'),
      P('Assortiment de mignardises', '24 pièces', 'Petits gâteaux', "Toute l'année", 36, 28, 3, 'Gluten, œufs, lait, fruits à coque', ''),
      P('Plateau mignardises pro', '50 pièces', 'Petits gâteaux', "Toute l'année", 69, 55, 4, 'Gluten, œufs, lait, fruits à coque', 'Réservé aux professionnels')
    ];
    const byName = (n) => products.find((p) => p.nom === n);
    const C = (nom, telephone, email, type, societe) => ({ id: uid(), nom, telephone, email, type: type || 'particulier', societe: societe || '', siret: '', notes: '', created_at: new Date().toISOString() });
    const customers = [
      C('Camille Lefebvre', '06 12 45 78 31', 'camille.lefebvre@exemple.fr'),
      C('Julien Morel', '06 33 21 09 87', ''),
      C('Sophie Dubois', '07 61 22 48 15', 'sophie.d@exemple.fr'),
      C('Nadia Benali', '06 98 14 52 63', ''),
      C('Lucas Vermeulen', '06 45 87 12 09', 'lucas.v@exemple.fr'),
      C('Marie Delattre', '06 71 30 66 42', ''),
      C('Élodie Lambert', '07 82 54 19 70', 'elodie.lambert@exemple.fr'),
      C('Hugo Desmet', '06 27 93 41 58', ''),
      C('Cabinet Leroy & Associés', '03 20 00 00 00', 'accueil@leroy-associes.exemple', 'pro', 'Cabinet Leroy & Associés'),
      C('Café du Parvis', '03 20 11 11 11', 'contact@cafeduparvis.exemple', 'pro', 'Café du Parvis')
    ];
    const cu = (n) => customers.find((c) => c.nom === n);

    const orders = []; const items = []; let seq = 0;
    const O = (dayOffset, creneau, client, lines, statut, extra) => {
      const c = cu(client);
      const order = Object.assign({
        id: uid(), numero: `CMD-${y}-${String(++seq).padStart(5, '0')}`,
        customer_id: c.id, client_nom: c.nom, client_tel: c.telephone, client_email: c.email,
        type: c.type, canal: 'telephone', date_retrait: addDays(t, dayOffset), creneau, statut: statut || 'recue',
        message_gateau: '', allergies: '', notes: '', paye: false, moyen_paiement: null, paye_le: null,
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(), updated_at: new Date().toISOString()
      }, extra || {});
      const its = lines.map(([nom, q], i) => {
        const p = byName(nom);
        return Object.assign({ id: uid(), order_id: order.id, product_id: p.id, libelle: p.nom, format: p.format, position: i },
          priceLine(lineFromProduct(p, order.type), q, order.type));
      });
      Object.assign(order, sumLines(its));
      if (order.statut === 'retiree' && !order.paye) Object.assign(order, { paye: true, moyen_paiement: 'Carte bancaire', paye_le: new Date().toISOString() });
      orders.push(order); items.push(...its);
    };
    O(-1, '10:00', 'Hugo Desmet', [['Fraisier', 1]], 'retiree');
    O(-1, '16:30', 'Marie Delattre', [['Tarte citron meringuée', 1]], 'retiree');
    O(0, '09:30', 'Camille Lefebvre', [['Paris-Brest', 1]], 'prete', { message_gateau: '' });
    O(0, '11:00', 'Cabinet Leroy & Associés', [['Plateau mignardises pro', 2]], 'prete', { canal: 'email', notes: 'Livraison à l’accueil du cabinet, demander Mme Roussel' });
    O(0, '11:00', 'Julien Morel', [['Number cake', 1]], 'preparation', { message_gateau: 'Joyeux anniversaire Léon — chiffre 7', allergies: 'Sans fruits à coque' });
    O(0, '15:00', 'Sophie Dubois', [['Fraisier', 1], ['Tarte citron meringuée', 1]], 'recue');
    O(0, '17:30', 'Nadia Benali', [['Entremets trois chocolats', 1]], 'recue', { canal: 'boutique', paye: true, moyen_paiement: 'Espèces', paye_le: new Date().toISOString() });
    O(1, '10:30', 'Lucas Vermeulen', [['Fraisier', 2]], 'recue', { message_gateau: 'Bon départ Claire !' });
    O(1, '12:00', 'Café du Parvis', [['Assortiment de mignardises', 3], ['Tarte citron meringuée', 2]], 'recue', { canal: 'email' });
    O(1, '16:00', 'Élodie Lambert', [['Paris-Brest', 1]], 'recue');
    O(2, '09:00', 'Marie Delattre', [['Entremets trois chocolats', 1], ['Assortiment de mignardises', 1]], 'recue');
    O(3, '14:30', 'Camille Lefebvre', [['Number cake', 1]], 'recue', { message_gateau: 'Lettre A, décor fleurs roses' });
    O(4, '11:30', 'Hugo Desmet', [['Fraisier', 1]], 'annulee', { notes: 'Annulée par le client au téléphone' });
    O(5, '10:00', 'Sophie Dubois', [['Tarte citron meringuée', 2]], 'recue');
    const xmas = `${y}-12-24`;
    if (diffDays(xmas, t) > 0) {
      O(diffDays(xmas, t), '09:00', 'Élodie Lambert', [['Bûche praliné noisette', 1]], 'recue');
      O(diffDays(xmas, t), '09:30', 'Julien Morel', [['Bûche chocolat intense', 1], ['Bûche framboise vanille', 1]], 'recue');
      O(diffDays(xmas, t), '10:00', 'Cabinet Leroy & Associés', [['Bûche praliné noisette', 6]], 'recue', { canal: 'email' });
    }

    const milestones = [
      { id: uid(), nom: 'Noël', debut_commandes: `${y}-11-15`, fin_commandes: `${y}-12-21`, debut_retrait: `${y}-12-22`, fin_retrait: `${y}-12-24`, capacite_jour: 60, notes: 'Bûches uniquement le 24' },
      { id: uid(), nom: 'Galette des rois', debut_commandes: `${y}-12-26`, fin_commandes: `${y + 1}-01-30`, debut_retrait: `${y + 1}-01-02`, fin_retrait: `${y + 1}-01-31`, capacite_jour: 40, notes: '' }
    ];
    const settings = mergeSettings({ fermetures: [{ id: uid(), debut: `${y}-12-25`, fin: `${y + 1}-01-01`, libelle: 'Congés de fin d’année' }] });
    return { products, customers, orders, items, milestones, settings, seq };
  }

  /* ------------------------------------------------------------------
     Calcul des prix
     Particulier : le prix de référence est le TTC.
     Professionnel : le prix de référence est le HT.
     Arrondi ligne par ligne, puis somme des lignes.
     ------------------------------------------------------------------ */
  function lineFromProduct(p, type) {
    const tva = Number(p.tva) || 0;
    const unit_ttc = p.prix_ttc != null ? Number(p.prix_ttc) : round2(Number(p.prix_ht_pro || 0) * (1 + tva));
    const unit_ht = (type === 'pro' && p.prix_ht_pro != null && p.prix_ht_pro !== '') ? Number(p.prix_ht_pro) : round2(unit_ttc / (1 + tva));
    return { unit_ttc, unit_ht, tva };
  }
  function priceLine(base, quantite, type) {
    const q = Math.max(0, Math.round(Number(quantite) || 0));
    const tva = Number(base.tva) || 0;
    let unit_ht, unit_ttc, total_ht, total_ttc;
    if (type === 'pro') {
      unit_ht = round2(base.unit_ht);
      unit_ttc = round2(unit_ht * (1 + tva));
      total_ht = round2(unit_ht * q);
      total_ttc = round2(total_ht * (1 + tva));
    } else {
      unit_ttc = round2(base.unit_ttc);
      unit_ht = round2(unit_ttc / (1 + tva));
      total_ttc = round2(unit_ttc * q);
      total_ht = round2(total_ttc / (1 + tva));
    }
    return { quantite: q, tva, prix_unitaire_ht: unit_ht, prix_unitaire_ttc: unit_ttc, total_ht, total_ttc };
  }
  function sumLines(lines) {
    const total_ht = round2(lines.reduce((s, l) => s + Number(l.total_ht || 0), 0));
    const total_ttc = round2(lines.reduce((s, l) => s + Number(l.total_ttc || 0), 0));
    return { total_ht, total_ttc, total_tva: round2(total_ttc - total_ht) };
  }

  /* ------------------------------------------------------------------
     Sources de données
     ------------------------------------------------------------------ */
  const DEMO_KEY = 'atelier-reves-demo-v1';

  const DemoStore = {
    label: 'Démo',
    data: null,
    persist() { safeStorage.set(DEMO_KEY, JSON.stringify(this.data)); },
    async init() {
      const raw = safeStorage.get(DEMO_KEY);
      try { this.data = raw ? JSON.parse(raw) : null; } catch (e) { this.data = null; }
      if (!this.data || !Array.isArray(this.data.orders)) { this.data = buildDemoData(); this.persist(); }
      this.data.settings = mergeSettings(this.data.settings);
      return { user: { email: 'mode démo' } };
    },
    async loadAll() { return JSON.parse(JSON.stringify(this.data)); },
    async saveOrder(order, items) {
      const d = this.data; const now = new Date().toISOString();
      let saved;
      if (order.id) {
        const i = d.orders.findIndex((o) => o.id === order.id);
        if (i < 0) throw new Error('Commande introuvable');
        saved = Object.assign({}, d.orders[i], order, { updated_at: now });
        d.orders[i] = saved;
        d.items = d.items.filter((it) => it.order_id !== order.id);
      } else {
        d.seq = (d.seq || 0) + 1;
        saved = Object.assign({ statut: 'recue', paye: false }, order, {
          id: uid(), numero: `CMD-${new Date().getFullYear()}-${String(d.seq).padStart(5, '0')}`, created_at: now, updated_at: now
        });
        d.orders.push(saved);
      }
      const savedItems = items.map((it, i) => Object.assign({}, it, { id: uid(), order_id: saved.id, position: i }));
      d.items.push(...savedItems);
      this.persist();
      return { order: JSON.parse(JSON.stringify(saved)), items: JSON.parse(JSON.stringify(savedItems)) };
    },
    async updateOrder(id, patch) {
      const o = this.data.orders.find((x) => x.id === id);
      if (!o) throw new Error('Commande introuvable');
      Object.assign(o, patch, { updated_at: new Date().toISOString() });
      this.persist();
      return JSON.parse(JSON.stringify(o));
    },
    async upsert(table, row) {
      const list = this.data[table];
      const r = Object.assign({}, row);
      if (!r.id) { r.id = uid(); r.created_at = new Date().toISOString(); list.push(r); }
      else { const i = list.findIndex((x) => x.id === r.id); if (i >= 0) list[i] = Object.assign(list[i], r); else list.push(r); }
      this.persist();
      return JSON.parse(JSON.stringify(list.find((x) => x.id === r.id)));
    },
    async remove(table, id) { this.data[table] = this.data[table].filter((x) => x.id !== id); this.persist(); },
    async saveSettings(s) { this.data.settings = s; this.persist(); return s; },
    async reset() { this.data = buildDemoData(); this.persist(); },
    async importAll(obj) { this.data = obj; this.data.settings = mergeSettings(obj.settings); this.persist(); },
    async signOut() {}
  };

  const SupabaseStore = {
    label: 'En ligne',
    sb: null,
    async client() {
      if (this.sb) return this.sb;
      const mod = await import('https://esm.sh/@supabase/supabase-js@2');
      this.sb = mod.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return this.sb;
    },
    async init() {
      const sb = await this.client();
      const { data } = await sb.auth.getSession();
      if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + (location.hash || '#/jour'));
      return { user: data.session ? data.session.user : null };
    },
    async sendLink(email) {
      const sb = await this.client();
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
    },
    async signInPassword(email, password) {
      const sb = await this.client();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async changePassword(password) {
      const sb = await this.client();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
    },
    async fetchAll(table, order) {
      const sb = await this.client(); const out = []; let from = 0;
      for (;;) {
        const { data, error } = await sb.from(table).select('*').order(order || 'created_at').range(from, from + 999);
        if (error) throw error;
        out.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }
      return out;
    },
    async loadAll() {
      const sb = await this.client();
      const [products, customers, orders, items, milestones, settingsRes] = await Promise.all([
        this.fetchAll('products', 'nom'), this.fetchAll('customers', 'nom'), this.fetchAll('orders', 'date_retrait'),
        this.fetchAll('order_items', 'position'), this.fetchAll('milestones', 'debut_retrait'),
        sb.from('settings').select('*').eq('id', 1)
      ]);
      if (settingsRes.error) throw settingsRes.error;
      if (!settingsRes.data.length) { const e = new Error('Ce compte n’est pas autorisé à utiliser l’appli.'); e.code = 'not_admin'; throw e; }
      return { products, customers, orders, items, milestones, settings: mergeSettings(settingsRes.data[0].data) };
    },
    async saveOrder(order, items) {
      const sb = await this.client();
      const { data, error } = await sb.rpc('save_order', { p_order: order, p_items: items });
      if (error) throw error;
      const saved = Array.isArray(data) ? data[0] : data;
      const res = await sb.from('order_items').select('*').eq('order_id', saved.id).order('position');
      if (res.error) throw res.error;
      return { order: saved, items: res.data };
    },
    async updateOrder(id, patch) {
      const sb = await this.client();
      const { data, error } = await sb.from('orders').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async upsert(table, row) {
      const sb = await this.client();
      const r = Object.assign({}, row); if (!r.id) delete r.id;
      const { data, error } = await sb.from(table).upsert(r).select().single();
      if (error) throw error;
      return data;
    },
    async remove(table, id) {
      const sb = await this.client();
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    async saveSettings(s) {
      const sb = await this.client();
      const { error } = await sb.from('settings').update({ data: s }).eq('id', 1);
      if (error) throw error;
      return s;
    },
    async signOut() { const sb = await this.client(); await sb.auth.signOut(); }
  };

  const isOnline = CFG.MODE === 'supabase' && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY;
  const store = isOnline ? SupabaseStore : DemoStore;

  /* ------------------------------------------------------------------
     État en mémoire
     ------------------------------------------------------------------ */
  const S = { products: [], customers: [], orders: [], items: [], milestones: [], settings: mergeSettings(), user: null };
  const itemsOf = (orderId) => S.items.filter((i) => i.order_id === orderId).sort((a, b) => (a.position || 0) - (b.position || 0));
  const orderById = (id) => S.orders.find((o) => o.id === id);
  const productById = (id) => S.products.find((p) => p.id === id);
  const qtyOf = (orderId) => itemsOf(orderId).reduce((s, i) => s + Number(i.quantite || 0), 0);

  /* ------------------------------------------------------------------
     Règles métier : horaires, créneaux, capacité, temps forts
     ------------------------------------------------------------------ */
  const hoursFor = (d) => S.settings.horaires[weekday(d)] || { ouvert: false };
  const closureFor = (d) => (S.settings.fermetures || []).find((f) => f.debut && d >= f.debut && d <= (f.fin || f.debut));
  const isOpen = (d) => hoursFor(d).ouvert && !closureFor(d);
  const milestoneFor = (d) => S.milestones.find((m) => m.debut_retrait && d >= m.debut_retrait && d <= (m.fin_retrait || m.debut_retrait));
  const milestonesOrdering = (d) => S.milestones.filter((m) => m.debut_commandes && m.fin_commandes && d >= m.debut_commandes && d <= m.fin_commandes);
  const capacityFor = (d) => { const m = milestoneFor(d); return (m && Number(m.capacite_jour)) || Number(S.settings.capacite_jour) || 0; };
  const activeOrdersOn = (d, excludeId) => S.orders.filter((o) => o.date_retrait === d && o.statut !== 'annulee' && o.id !== excludeId);
  const cakesOn = (d, excludeId) => activeOrdersOn(d, excludeId).reduce((s, o) => s + qtyOf(o.id), 0);
  const slotCount = (d, t, excludeId) => activeOrdersOn(d, excludeId).filter((o) => o.creneau === t).length;
  function slotsFor(d) {
    const h = hoursFor(d);
    if (!h.ouvert || !h.debut || !h.fin) return [];
    const step = Math.max(5, Number(S.settings.creneau_minutes) || 30);
    const out = [];
    for (let m = timeToMin(h.debut); m < timeToMin(h.fin); m += step) out.push(minToTime(m));
    return out;
  }

  /* ------------------------------------------------------------------
     Interface : modale, confirmation, toast
     ------------------------------------------------------------------ */
  const modalEl = $('#modal'); const modalBox = $('#modal-box');
  let lastFocus = null;
  function openModal(title, bodyHtml, actionsHtml, onMount) {
    lastFocus = document.activeElement;
    modalBox.innerHTML = `<h2 id="modal-title">${esc(title)}</h2><div class="modal-body">${bodyHtml}</div><div class="modal-actions">${actionsHtml}</div>`;
    modalEl.hidden = false;
    if (onMount) onMount(modalBox);
    const f = modalBox.querySelector('input, select, textarea, button.btn-primary, button.btn-dark, button');
    if (f) f.focus();
  }
  function closeModal() { modalEl.hidden = true; modalBox.innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalEl.hidden) closeModal(); });
  function confirmDialog(title, message, okLabel, danger) {
    return new Promise((resolve) => {
      openModal(title, `<p style="margin:0">${message}</p>`,
        `<button class="btn" data-x="no">Retour</button><button class="btn ${danger ? 'btn-danger' : 'btn-dark'}" data-x="yes">${esc(okLabel)}</button>`,
        (box) => {
          box.querySelector('[data-x="no"]').onclick = () => { closeModal(); resolve(false); };
          box.querySelector('[data-x="yes"]').onclick = () => { closeModal(); resolve(true); };
        });
    });
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  async function guard(fn, errMsg) {
    try { return await fn(); }
    catch (e) { console.error(e); toast((errMsg || 'Action impossible') + (e && e.message ? ' : ' + e.message : '')); return undefined; }
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  const NAV = [
    { route: 'jour', label: 'Journée', icon: 'day' },
    { route: 'commandes', label: 'Commandes', icon: 'list' },
    { route: 'planning', label: 'Planning', icon: 'calendar' },
    { route: 'catalogue', label: 'Catalogue', icon: 'cake' },
    { route: 'reglages', label: 'Réglages', icon: 'gear' }
  ];
  function renderChrome(active) {
    $('#rail-nav').innerHTML =
      `<a class="nav-link nav-new" href="#/nouvelle" ${active === 'nouvelle' ? 'aria-current="page"' : ''}>${icon('plus')}Nouvelle commande</a>` +
      NAV.map((n) => `<a class="nav-link" href="#/${n.route}" ${active === n.route ? 'aria-current="page"' : ''}>${icon(n.icon)}${n.label}</a>`).join('');
    $('#rail-foot').innerHTML = isOnline
      ? `Connectée : <strong>${esc(S.user && S.user.email)}</strong>`
      : `<strong>Mode démo</strong><br>Données d'exemple enregistrées dans ce navigateur.`;
    const tabs = [NAV[0], NAV[1], { route: 'nouvelle', label: 'Nouvelle', icon: 'plus', big: true }, NAV[2], NAV[3]];
    $('#tabbar').innerHTML = tabs.map((n) => n.big
      ? `<a class="tab-new" href="#/nouvelle" aria-label="Nouvelle commande" ${active === 'nouvelle' ? 'aria-current="page"' : ''}>${icon('plus')}</a>`
      : `<a class="tab" href="#/${n.route}" ${active === n.route ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></a>`).join('');
    $('#topbar-settings').innerHTML = icon('gear');
    const titles = { jour: 'Journée', commandes: 'Commandes', nouvelle: 'Nouvelle commande', commande: 'Commande', modifier: 'Modifier', planning: 'Planning', catalogue: 'Catalogue', reglages: 'Réglages' };
    $('#topbar-title').textContent = titles[active] || 'Commandes';
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, query] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(query || '');
    return { parts, params };
  }
  const view = $('#view');
  let leaveGuard = null; // fonction qui renvoie true si on peut quitter la page
  let currentHash = '';
  async function router() {
    if (leaveGuard && location.hash !== currentHash && !leaveGuard()) {
      const target = location.hash;
      history.replaceState(null, '', currentHash); // on reste sur le formulaire le temps de demander
      const ok = await confirmDialog('Quitter sans enregistrer ?', 'La commande en cours n’est pas enregistrée. Les informations saisies seront perdues.', 'Quitter sans enregistrer', true);
      if (ok) { leaveGuard = null; location.hash = target; }
      return;
    }
    leaveGuard = null;
    currentHash = location.hash;
    const { parts, params } = parseHash();
    const r = parts[0] || 'jour';
    document.body.classList.remove('has-mobile-bar');
    try {
      if (r === 'jour') { renderChrome('jour'); viewDay(params.get('d') || today()); }
      else if (r === 'commandes') { renderChrome('commandes'); viewOrders(params); }
      else if (r === 'nouvelle') { renderChrome('nouvelle'); viewOrderForm(null, params); }
      else if (r === 'commande' && parts[1] && parts[2] === 'modifier') { renderChrome('modifier'); viewOrderForm(parts[1], params); }
      else if (r === 'commande' && parts[1]) { renderChrome('commande'); viewOrderDetail(parts[1]); }
      else if (r === 'planning') { renderChrome('planning'); viewPlanning(params.get('s') || mondayOf(today())); }
      else if (r === 'catalogue') { renderChrome('catalogue'); viewCatalogue(params); }
      else if (r === 'reglages') { renderChrome('reglages'); viewSettings(); }
      else { location.hash = '#/jour'; return; }
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="empty"><p>Cet écran n'a pas pu s'afficher : ${esc(e.message)}</p><a class="btn" href="#/jour">Revenir à la journée</a></div>`;
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', router);
  const go = (hash) => { if (location.hash === hash) router(); else location.hash = hash; };

  /* ------------------------------------------------------------------
     Composants partagés
     ------------------------------------------------------------------ */
  const pill = (statut) => `<span class="pill st-${statut}">${esc(STATUTS[statut] ? STATUTS[statut].label : statut)}</span>`;
  const payTag = (o) => o.statut === 'annulee' ? '' : (o.paye ? `<span class="tag tag-paid">Payée</span>` : `<span class="tag tag-due">À encaisser</span>`);
  const itemsSummary = (orderId) => itemsOf(orderId).map((i) => `${i.quantite} × ${i.libelle}`).join(', ');
  function bar(value, max) {
    const ratio = max > 0 ? value / max : 0;
    return `<div class="bar ${ratio > 1 ? 'over' : ''}" role="img" aria-label="${value} sur ${max}"><i style="width:${Math.min(100, Math.round(ratio * 100))}%"></i></div>`;
  }

  // Passage au statut suivant (avec encaissement si la commande est retirée sans avoir été payée)
  async function advance(orderId) {
    const o = orderById(orderId); if (!o) return;
    const next = STATUTS[o.statut] && STATUTS[o.statut].next; if (!next) return;
    if (next === 'retiree' && !o.paye) { openPayment(o, true); return; }
    await setStatus(o, next);
  }
  async function setStatus(o, statut, extra) {
    const saved = await guard(() => store.updateOrder(o.id, Object.assign({ statut }, extra || {})), 'Statut non enregistré');
    if (!saved) return;
    Object.assign(o, saved);
    toast(`${o.client_nom} : ${STATUTS[statut].label.toLowerCase()}`);
    router();
  }
  function openPayment(o, andCollect) {
    openModal(andCollect ? 'Encaisser et marquer retirée' : 'Encaisser la commande',
      `<p style="margin:0" class="muted">${esc(o.client_nom)}, commande ${esc(o.numero)}</p>
       <div class="pay-box" style="position:static"><span class="muted small">Montant à encaisser</span><span class="amount">${eur(o.total_ttc)}</span></div>
       <div class="field"><span>Moyen de paiement</span>
         <div class="chips" id="pay-moyens">${MOYENS.map((m, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
       </div>`,
      `<button class="btn" data-x="cancel">Retour</button>
       ${andCollect ? `<button class="btn" data-x="nopay">Retirée sans encaisser</button>` : ''}
       <button class="btn btn-dark" data-x="ok">${andCollect ? 'Encaisser et marquer retirée' : 'Encaisser'}</button>`,
      (box) => {
        let moyen = MOYENS[0];
        box.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
          moyen = b.dataset.m; box.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        });
        box.querySelector('[data-x="cancel"]').onclick = closeModal;
        const nopay = box.querySelector('[data-x="nopay"]');
        if (nopay) nopay.onclick = () => { closeModal(); setStatus(o, 'retiree'); };
        box.querySelector('[data-x="ok"]').onclick = async () => {
          closeModal();
          const patch = { paye: true, moyen_paiement: moyen, paye_le: new Date().toISOString() };
          if (andCollect) await setStatus(o, 'retiree', patch);
          else {
            const saved = await guard(() => store.updateOrder(o.id, patch), 'Paiement non enregistré');
            if (saved) { Object.assign(o, saved); toast(`Encaissé : ${eur(o.total_ttc)}`); router(); }
          }
        };
      });
  }

  /* ------------------------------------------------------------------
     Écran : Journée
     ------------------------------------------------------------------ */
  function viewDay(d) {
    const orders = S.orders.filter((o) => o.date_retrait === d)
      .sort((a, b) => (a.creneau || '99').localeCompare(b.creneau || '99') || a.client_nom.localeCompare(b.client_nom));
    const active = orders.filter((o) => o.statut !== 'annulee');
    const cakes = active.reduce((s, o) => s + qtyOf(o.id), 0);
    const capa = capacityFor(d);
    const todo = active.filter((o) => o.statut === 'recue' || o.statut === 'preparation').length;
    const ready = active.filter((o) => o.statut === 'prete').length;
    const toCollect = active.filter((o) => !o.paye && o.statut !== 'retiree').reduce((s, o) => s + Number(o.total_ttc || 0), 0);
    const rel = relDay(d);
    const closure = closureFor(d); const h = hoursFor(d); const m = milestoneFor(d);
    const ordering = milestonesOrdering(today());

    let banners = '';
    if (closure) banners += `<div class="banner warn">${icon('alert')}<div>Fermé : ${esc(closure.libelle || 'fermeture exceptionnelle')}.</div></div>`;
    else if (!h.ouvert) banners += `<div class="banner warn">${icon('alert')}<div>Jour de fermeture habituel.</div></div>`;
    if (m) banners += `<div class="banner">${icon('cake')}<div><strong>${esc(m.nom)}</strong> : capacité du jour portée à ${capa} gâteaux.</div></div>`;
    if (d === today()) ordering.forEach((mo) => {
      banners += `<div class="banner">${icon('info')}<div>Commandes <strong>${esc(mo.nom)}</strong> ouvertes jusqu'au ${fmtDay(mo.fin_commandes, { day: 'numeric', month: 'long' })}.</div></div>`;
    });

    // Production du jour
    const prod = {};
    active.forEach((o) => itemsOf(o.id).forEach((i) => { const k = i.libelle + (i.format ? ` (${i.format})` : ''); prod[k] = (prod[k] || 0) + Number(i.quantite); }));
    const prodRows = Object.entries(prod).sort((a, b) => b[1] - a[1]);

    // Frise par créneau
    const groups = new Map();
    orders.forEach((o) => { const k = o.creneau || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
    const timeline = [...groups.entries()].map(([t, list]) => `
      <section class="slot" aria-label="${t ? 'Créneau ' + fmtTime(t) : 'Sans créneau'}">
        <div class="slot-time ${t ? '' : 'none'}">${t ? esc(fmtTime(t)) : 'Sans créneau'}</div>
        <div class="slot-orders">${list.map(ticket).join('')}</div>
      </section>`).join('');

    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="day-title"><small>${rel ? esc(rel) : '&nbsp;'}</small>${esc(fmtDay(d))}</h1>
        </div>
        <div class="page-actions">
          <div class="day-nav">
            <a class="icon-btn" href="#/jour?d=${addDays(d, -1)}" aria-label="Jour précédent">${icon('left')}</a>
            <a class="btn btn-sm ${d === today() ? 'btn-primary' : ''}" href="#/jour?d=${today()}">Aujourd'hui</a>
            <a class="btn btn-sm ${d === addDays(today(), 1) ? 'btn-primary' : ''}" href="#/jour?d=${addDays(today(), 1)}">Demain</a>
            <a class="icon-btn" href="#/jour?d=${addDays(d, 1)}" aria-label="Jour suivant">${icon('right')}</a>
          </div>
          <label class="sr" for="day-pick">Choisir une date</label>
          <input type="date" id="day-pick" value="${d}" style="width:auto;min-height:40px">
        </div>
      </div>
      ${banners}
      <div class="day-stats">
        <div class="stat"><b>${active.length}</b><span>commande${active.length > 1 ? 's' : ''}</span></div>
        <div class="stat"><b>${todo}</b><span>à préparer</span></div>
        <div class="stat"><b>${ready}</b><span>prête${ready > 1 ? 's' : ''} à retirer</span></div>
        <div class="stat"><b class="num">${eur(toCollect)}</b><span>à encaisser</span></div>
        <div class="stat capacity"><b>${cakes}<span class="muted" style="font-size:18px;font-weight:700"> / ${capa}</span></b>${bar(cakes, capa)}<span>gâteaux sur la capacité du jour</span></div>
      </div>
      <div class="day-grid">
        <div class="timeline">
          ${orders.length ? timeline : `<div class="empty"><p>Aucune commande à retirer ce jour-là.</p><a class="btn btn-primary" href="#/nouvelle?d=${d}">${icon('plus')}Nouvelle commande pour ce jour</a></div>`}
        </div>
        <aside class="aside-box" aria-label="Production du jour">
          <h2>À produire</h2>
          ${prodRows.length ? `<ul class="prod-list">${prodRows.map(([k, q]) => `<li><span>${esc(k)}</span><b>${q}</b></li>`).join('')}</ul>` : '<p class="muted small" style="margin:0">Rien à produire pour cette date.</p>'}
        </aside>
      </div>`;

    $('#day-pick').onchange = (e) => { if (e.target.value) go('#/jour?d=' + e.target.value); };
    view.querySelectorAll('[data-advance]').forEach((b) => b.onclick = () => advance(b.dataset.advance));
    view.querySelectorAll('.ticket[data-open]').forEach((el) => el.onclick = (e) => {
      if (e.target.closest('button, a')) return;
      go('#/commande/' + el.dataset.open);
    });
  }
  function ticket(o) {
    const st = STATUTS[o.statut] || {};
    const its = itemsOf(o.id);
    return `
      <article class="ticket is-${o.statut}" data-open="${o.id}">
        <div class="ticket-head">
          <a class="ticket-name" href="#/commande/${o.id}">${esc(o.client_nom)}</a>
          ${o.type === 'pro' ? '<span class="tag tag-pro">Pro</span>' : ''}
          <span class="ticket-num">${esc(o.numero || '')}</span>
          ${pill(o.statut)}
        </div>
        <ul class="ticket-items">${its.map((i) => `<li><b>${i.quantite} ×</b>${esc(i.libelle)}${i.format ? ` <span class="muted">(${esc(i.format)})</span>` : ''}</li>`).join('')}</ul>
        ${o.message_gateau ? `<div class="ticket-note">Sur le gâteau : « ${esc(o.message_gateau)} »</div>` : ''}
        ${o.allergies ? `<div class="ticket-note allergy">Allergies : ${esc(o.allergies)}</div>` : ''}
        <div class="ticket-foot">
          <span class="total">${eur(o.total_ttc)}</span>
          ${payTag(o)}
          ${o.client_tel ? `<span class="muted small">${esc(o.client_tel)}</span>` : ''}
          ${st.next ? `<button type="button" class="btn btn-sm ${o.statut === 'prete' ? 'btn-dark' : 'btn-primary'}" data-advance="${o.id}">${esc(st.action)}</button>` : ''}
        </div>
      </article>`;
  }

  /* ------------------------------------------------------------------
     Écran : Commandes (recherche, filtres, export)
     ------------------------------------------------------------------ */
  const ordersFilter = { q: '', periode: 'avenir', statut: 'toutes' };
  function filteredOrders() {
    const t = today(); const q = ordersFilter.q.trim().toLowerCase();
    return S.orders.filter((o) => {
      if (ordersFilter.periode === 'avenir' && o.date_retrait < t) return false;
      if (ordersFilter.periode === 'passees' && o.date_retrait >= t) return false;
      if (ordersFilter.statut !== 'toutes' && o.statut !== ordersFilter.statut) return false;
      if (q) {
        const hay = [o.client_nom, o.client_tel, o.client_email, o.numero, itemsSummary(o.id)].join(' ').toLowerCase().replace(/\s+/g, ' ');
        const qq = q.replace(/\s+/g, ' ');
        if (!hay.includes(qq) && !String(o.client_tel || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')) return false;
      }
      return true;
    }).sort((a, b) => {
      const dir = ordersFilter.periode === 'passees' ? -1 : 1;
      return dir * (a.date_retrait.localeCompare(b.date_retrait) || (a.creneau || '99').localeCompare(b.creneau || '99'));
    });
  }
  function viewOrders(params) {
    if (params.get('statut')) ordersFilter.statut = params.get('statut');
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Commandes</h1><p id="orders-count"></p></div>
        <div class="page-actions">
          <button class="btn" id="export-csv">${icon('download')}Exporter (Excel)</button>
          <a class="btn btn-primary" href="#/nouvelle">${icon('plus')}Nouvelle commande</a>
        </div>
      </div>
      <div class="toolbar">
        <label class="search"><span class="sr">Rechercher</span>${icon('search')}
          <input type="search" id="q" placeholder="Nom, téléphone, n° de commande, gâteau" value="${esc(ordersFilter.q)}"></label>
        <div class="segmented" role="group" aria-label="Période">
          ${[['avenir', 'À venir'], ['passees', 'Passées'], ['toutes', 'Toutes']].map(([k, l]) => `<button type="button" data-periode="${k}" aria-pressed="${ordersFilter.periode === k}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="chips" style="margin-bottom:18px" role="group" aria-label="Statut">
        ${[['toutes', 'Tous les statuts'], ...Object.entries(STATUTS).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button type="button" class="chip" data-statut="${k}" aria-pressed="${ordersFilter.statut === k}">${esc(l)}</button>`).join('')}
      </div>
      <div id="orders-list"></div>`;
    const renderList = () => {
      const list = filteredOrders();
      $('#orders-count').textContent = `${list.length} commande${list.length > 1 ? 's' : ''}`;
      if (!list.length) {
        $('#orders-list').innerHTML = `<div class="empty"><p>Aucune commande ne correspond à ces filtres.</p><a class="btn btn-primary" href="#/nouvelle">${icon('plus')}Nouvelle commande</a></div>`;
        return;
      }
      let lastDay = null; const rows = [];
      list.forEach((o) => {
        if (o.date_retrait !== lastDay) {
          lastDay = o.date_retrait;
          rows.push(`<tr class="group-row"><td colspan="6">${esc((relDay(o.date_retrait) ? relDay(o.date_retrait) + ', ' : '') + fmtDay(o.date_retrait, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</td></tr>`);
        }
        rows.push(`<tr data-open="${o.id}" tabindex="0">
          <td class="num cell-strong">${esc(fmtTime(o.creneau) || '–')}</td>
          <td><span class="cell-strong">${esc(o.client_nom)}</span>${o.type === 'pro' ? ' <span class="tag tag-pro">Pro</span>' : ''}<div class="muted small">${esc(o.numero || '')}</div></td>
          <td class="hide-sm">${esc(itemsSummary(o.id))}</td>
          <td class="right num cell-strong">${eur(o.total_ttc)}</td>
          <td class="hide-sm">${payTag(o)}</td>
          <td>${pill(o.statut)}</td>
        </tr>`);
      });
      $('#orders-list').innerHTML = `<div class="table-wrap"><table class="list">
        <thead><tr><th>Retrait</th><th>Client</th><th class="hide-sm">Gâteaux</th><th class="right">Total TTC</th><th class="hide-sm">Paiement</th><th>Statut</th></tr></thead>
        <tbody>${rows.join('')}</tbody></table></div>`;
      $$('#orders-list [data-open]').forEach((tr) => {
        tr.onclick = () => go('#/commande/' + tr.dataset.open);
        tr.onkeydown = (e) => { if (e.key === 'Enter') go('#/commande/' + tr.dataset.open); };
      });
    };
    $('#q').oninput = (e) => { ordersFilter.q = e.target.value; renderList(); };
    $$('[data-periode]').forEach((b) => b.onclick = () => { ordersFilter.periode = b.dataset.periode; $$('[data-periode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderList(); });
    $$('[data-statut]').forEach((b) => b.onclick = () => { ordersFilter.statut = b.dataset.statut; $$('[data-statut]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderList(); });
    $('#export-csv').onclick = () => exportCsv(filteredOrders());
    renderList();
  }
  function exportCsv(list) {
    const dec = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
    const cell = (v) => { const s = String(v == null ? '' : v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ['Numéro', 'Date de retrait', 'Créneau', 'Statut', 'Client', 'Téléphone', 'Email', 'Type', 'Canal', 'Gâteaux', 'Nb gâteaux', 'Total HT', 'TVA', 'Total TTC', 'Payée', 'Moyen de paiement', 'Message sur le gâteau', 'Allergies', 'Notes', 'Créée le'];
    const rows = list.map((o) => [o.numero, fmtShort(o.date_retrait), o.creneau, STATUTS[o.statut] ? STATUTS[o.statut].label : o.statut, o.client_nom, o.client_tel, o.client_email,
      o.type === 'pro' ? 'Professionnel' : 'Particulier', CANAUX[o.canal] || o.canal, itemsSummary(o.id), qtyOf(o.id),
      dec(o.total_ht), dec(o.total_tva), dec(o.total_ttc), o.paye ? 'Oui' : 'Non', o.moyen_paiement, o.message_gateau, o.allergies, o.notes, fmtDateTime(o.created_at)]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
    download(`commandes-${today()}.csv`, csv, 'text/csv;charset=utf-8');
    toast(`${list.length} commande${list.length > 1 ? 's' : ''} exportée${list.length > 1 ? 's' : ''}`);
  }

  /* ------------------------------------------------------------------
     Écran : Nouvelle commande / Modifier
     ------------------------------------------------------------------ */
  function newDraft() {
    return { id: null, customer_id: null, client_nom: '', client_tel: '', client_email: '', societe: '', type: 'particulier', canal: 'telephone',
      date_retrait: '', creneau: '', message_gateau: '', allergies: '', notes: '', paye: false, moyen_paiement: '', lines: [], dirty: false };
  }
  function draftFromOrder(o, asCopy) {
    const d = newDraft();
    Object.assign(d, {
      id: asCopy ? null : o.id, customer_id: o.customer_id, client_nom: o.client_nom, client_tel: o.client_tel || '', client_email: o.client_email || '',
      type: o.type || 'particulier', canal: o.canal || 'telephone',
      date_retrait: asCopy ? '' : o.date_retrait, creneau: asCopy ? '' : (o.creneau || ''),
      message_gateau: asCopy ? '' : (o.message_gateau || ''), allergies: o.allergies || '', notes: asCopy ? '' : (o.notes || ''),
      paye: asCopy ? false : !!o.paye, moyen_paiement: asCopy ? '' : (o.moyen_paiement || ''), statut: asCopy ? 'recue' : o.statut, paye_le: asCopy ? null : o.paye_le
    });
    const c = S.customers.find((x) => x.id === o.customer_id); if (c) d.societe = c.societe || '';
    d.lines = itemsOf(o.id).map((i) => {
      const p = i.product_id && productById(i.product_id);
      // Copie : prix du catalogue actuel. Modification : prix enregistré conservé.
      const base = (asCopy && p) ? lineFromProduct(p, d.type) : { unit_ttc: Number(i.prix_unitaire_ttc), unit_ht: Number(i.prix_unitaire_ht), tva: Number(i.tva) };
      return { key: uid(), product_id: i.product_id || null, libelle: i.libelle, format: i.format || '', quantite: Number(i.quantite), custom: !p, ...base };
    });
    return d;
  }

  function viewOrderForm(orderId, params) {
    let draft;
    if (orderId) {
      const o = orderById(orderId);
      if (!o) { view.innerHTML = `<div class="empty"><p>Cette commande n'existe plus.</p><a class="btn" href="#/commandes">Voir les commandes</a></div>`; return; }
      draft = draftFromOrder(o, false);
    } else if (params.get('copie') && orderById(params.get('copie'))) {
      draft = draftFromOrder(orderById(params.get('copie')), true);
    } else {
      draft = newDraft();
      draft.date_retrait = params.get('d') || '';
    }
    const isEdit = !!draft.id;
    let catFilter = 'toutes'; let prodSearch = ''; let showErrors = false;

    view.innerHTML = `
      <div class="page-head">
        <div><h1>${isEdit ? 'Modifier la commande' : 'Nouvelle commande'}</h1>${isEdit ? `<p>${esc(orderById(orderId).numero)}</p>` : '<p>Quatre étapes : client, retrait, gâteaux, détails.</p>'}</div>
        ${isEdit ? `<div class="page-actions"><a class="btn" href="#/commande/${draft.id}">Retour sans enregistrer</a></div>` : ''}
      </div>
      <form class="order-form" id="order-form" novalidate>
        <div>
          <section class="step">
            <div class="step-head"><span class="step-num">1</span><h2>Client</h2></div>
            <div style="display:grid;gap:14px">
              <div class="segmented" role="group" aria-label="Type de client">
                <button type="button" data-type="particulier">Particulier</button>
                <button type="button" data-type="pro">Professionnel</button>
              </div>
              <div class="field" id="f-nom"><span>Nom du client <span class="req">*</span> <span class="hint" id="client-link"></span></span>
                <input type="text" id="client_nom" autocomplete="off" placeholder="Nom ou téléphone d’un client" value="${esc(draft.client_nom)}">
                <ul class="suggest" id="suggest" hidden></ul>
              </div>
              <div class="field" id="f-societe" hidden><span>Société</span><input type="text" id="societe" value="${esc(draft.societe)}"></div>
              <div class="grid-2">
                <label class="field"><span>Téléphone</span><input type="tel" id="client_tel" value="${esc(draft.client_tel)}" inputmode="tel"></label>
                <label class="field"><span>Email <span class="hint">facultatif</span></span><input type="email" id="client_email" value="${esc(draft.client_email)}"></label>
              </div>
              <label class="field"><span>Commande reçue par</span>
                <select id="canal">${Object.entries(CANAUX).map(([k, l]) => `<option value="${k}" ${draft.canal === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
              </label>
            </div>
          </section>

          <section class="step">
            <div class="step-head"><span class="step-num">2</span><h2>Retrait</h2></div>
            <div class="day-chips" id="day-chips" aria-label="Raccourcis de date"></div>
            <div class="grid-2" style="margin-bottom:14px">
              <label class="field" id="f-date"><span>Date de retrait <span class="req">*</span></span><input type="date" id="date_retrait" value="${esc(draft.date_retrait)}"></label>
            </div>
            <div class="label" style="margin-bottom:8px">Créneau</div>
            <div id="slots"></div>
          </section>

          <section class="step">
            <div class="step-head"><span class="step-num">3</span><h2>Gâteaux</h2></div>
            <div class="toolbar" style="margin-bottom:8px">
              <label class="search"><span class="sr">Chercher un gâteau</span>${icon('search')}<input type="search" id="prod-q" placeholder="Chercher un gâteau"></label>
            </div>
            <div class="chips" id="cat-chips"></div>
            <div class="catalog-pick" id="catalog-pick"></div>
            <div id="custom-lines" style="display:grid;gap:8px;margin-top:8px"></div>
            <button type="button" class="btn btn-ghost" id="add-custom" style="margin-top:8px">${icon('plus')}Ajouter un gâteau sur mesure</button>
            <div class="error-text" id="err-lines" hidden>Ajoute au moins un gâteau.</div>
          </section>

          <section class="step">
            <div class="step-head"><span class="step-num">4</span><h2>Détails</h2></div>
            <div style="display:grid;gap:14px">
              <label class="field"><span>Message à écrire sur le gâteau</span><input type="text" id="message_gateau" value="${esc(draft.message_gateau)}" placeholder="Ex. Joyeux anniversaire Léa"></label>
              <label class="field"><span>Allergies ou régime</span><input type="text" id="allergies" value="${esc(draft.allergies)}" placeholder="Ex. sans fruits à coque"></label>
              <label class="field"><span>Notes internes <span class="hint">visibles seulement par toi</span></span><textarea id="notes">${esc(draft.notes)}</textarea></label>
              <label class="check"><input type="checkbox" id="paye" ${draft.paye ? 'checked' : ''}>Déjà payée</label>
              <label class="field" id="f-moyen" ${draft.paye ? '' : 'hidden'}><span>Moyen de paiement</span>
                <select id="moyen_paiement">${MOYENS.map((m) => `<option ${draft.moyen_paiement === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
              </label>
            </div>
          </section>
        </div>
        <aside class="recap" id="recap" aria-live="polite"></aside>
      </form>
      <div class="mobile-bar"><div class="total" id="mb-total"></div><button type="button" class="btn btn-dark" id="mb-save">Enregistrer</button></div>`;

    const form = $('#order-form');
    const markDirty = () => { draft.dirty = true; };
    leaveGuard = () => !draft.dirty;

    // --- Étape 1 : client
    const renderType = () => {
      $$('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === draft.type)));
      $('#f-societe').hidden = draft.type !== 'pro';
    };
    $$('[data-type]').forEach((b) => b.onclick = () => {
      if (draft.type === b.dataset.type) return;
      draft.type = b.dataset.type; markDirty();
      draft.lines.forEach((l) => { if (!l.custom) { const p = productById(l.product_id); if (p) Object.assign(l, lineFromProduct(p, draft.type)); } });
      renderType(); renderProducts(); renderCustom(); renderRecap();
    });
    const renderClientLink = () => {
      $('#client-link').textContent = draft.customer_id ? 'client déjà connu' : (draft.client_nom.trim() ? 'nouveau client, il sera enregistré' : '');
    };
    const showSuggest = () => {
      const q = draft.client_nom.trim().toLowerCase(); const qd = q.replace(/\D/g, '');
      const ul = $('#suggest');
      if (q.length < 2 || draft.customer_id) { ul.hidden = true; return; }
      const found = S.customers.filter((c) => c.nom.toLowerCase().includes(q) || (qd.length >= 3 && String(c.telephone || '').replace(/\D/g, '').includes(qd))).slice(0, 6);
      if (!found.length) { ul.hidden = true; return; }
      ul.innerHTML = found.map((c) => `<li><button type="button" data-cust="${c.id}"><span><strong>${esc(c.nom)}</strong>${c.type === 'pro' ? ' <span class="tag tag-pro">Pro</span>' : ''}</span><span class="muted small">${esc(c.telephone || c.email || '')}</span></button></li>`).join('');
      ul.hidden = false;
      ul.querySelectorAll('[data-cust]').forEach((b) => b.onclick = () => {
        const c = S.customers.find((x) => x.id === b.dataset.cust);
        Object.assign(draft, { customer_id: c.id, client_nom: c.nom, client_tel: c.telephone || '', client_email: c.email || '', societe: c.societe || '' });
        if (c.type !== draft.type) { $(`[data-type="${c.type}"]`).click(); }
        $('#client_nom').value = c.nom; $('#client_tel').value = draft.client_tel; $('#client_email').value = draft.client_email; $('#societe').value = draft.societe;
        ul.hidden = true; markDirty(); renderClientLink(); renderRecap();
      });
    };
    $('#client_nom').oninput = (e) => { draft.client_nom = e.target.value; draft.customer_id = null; markDirty(); showSuggest(); renderClientLink(); renderRecap(); };
    $('#client_nom').onblur = () => setTimeout(() => { const ul = $('#suggest'); if (ul) ul.hidden = true; }, 200);
    $('#client_nom').onfocus = showSuggest;
    ['client_tel', 'client_email', 'societe', 'message_gateau', 'allergies', 'notes'].forEach((k) => {
      $('#' + k).oninput = (e) => { draft[k] = e.target.value; markDirty(); if (k === 'client_tel') showSuggestByTel(); };
    });
    const showSuggestByTel = () => {
      if (draft.customer_id || draft.client_nom.trim()) return;
      const qd = draft.client_tel.replace(/\D/g, '');
      if (qd.length < 6) return;
      const c = S.customers.find((x) => String(x.telephone || '').replace(/\D/g, '') === qd);
      if (c) { draft.client_nom = c.nom; $('#client_nom').value = c.nom; showSuggest(); }
    };
    $('#canal').onchange = (e) => { draft.canal = e.target.value; markDirty(); };
    $('#paye').onchange = (e) => { draft.paye = e.target.checked; $('#f-moyen').hidden = !draft.paye; if (draft.paye && !draft.moyen_paiement) draft.moyen_paiement = MOYENS[0]; markDirty(); renderRecap(); };
    $('#moyen_paiement').onchange = (e) => { draft.moyen_paiement = e.target.value; markDirty(); };

    // --- Étape 2 : date et créneau
    const renderDayChips = () => {
      const start = today(); const chips = [];
      for (let i = 0; i < 14; i++) {
        const d = addDays(start, i); const open = isOpen(d);
        const cakes = cakesOn(d, draft.id); const capa = capacityFor(d);
        const label = i === 0 ? "Auj." : i === 1 ? 'Demain' : cap(parseDate(d).toLocaleDateString('fr-FR', { weekday: 'short' }));
        chips.push(`<button type="button" class="day-chip ${open ? '' : 'closed'} ${open && cakes >= capa ? 'full' : ''}" data-day="${d}" aria-pressed="${draft.date_retrait === d}">
          <strong>${esc(label)} ${parseDate(d).getDate()}</strong><span>${open ? `${cakes} / ${capa}` : 'Fermé'}</span></button>`);
      }
      $('#day-chips').innerHTML = chips.join('');
      $$('#day-chips [data-day]').forEach((b) => b.onclick = () => { setDate(b.dataset.day); });
    };
    const setDate = (d) => {
      draft.date_retrait = d; $('#date_retrait').value = d; markDirty();
      if (draft.creneau && !slotsFor(d).includes(draft.creneau)) draft.creneau = '';
      renderDayChips(); renderSlots(); renderProducts(); renderRecap();
    };
    $('#date_retrait').min = isEdit ? '' : today();
    $('#date_retrait').onchange = (e) => setDate(e.target.value);
    const renderSlots = () => {
      const d = draft.date_retrait; const box = $('#slots');
      if (!d) { box.innerHTML = '<p class="muted small" style="margin:0">Choisis d’abord une date.</p>'; return; }
      const slots = slotsFor(d);
      if (draft.creneau && !slots.includes(draft.creneau)) slots.push(draft.creneau);
      slots.sort();
      const max = Number(S.settings.max_commandes_creneau) || 0;
      if (!slots.length) { box.innerHTML = `<p class="muted small" style="margin:0">Aucun créneau : la boutique est fermée ce jour-là. Tu peux quand même enregistrer la commande sans créneau.</p>`; return; }
      box.innerHTML = `<div class="slot-grid">${slots.map((t) => {
        const n = slotCount(d, t, draft.id);
        return `<button type="button" class="slot-btn ${max && n >= max ? 'full' : ''}" data-slot="${t}" aria-pressed="${draft.creneau === t}"><strong>${fmtTime(t)}</strong><span>${n} / ${max}</span></button>`;
      }).join('')}<button type="button" class="slot-btn" data-slot="" aria-pressed="${!draft.creneau}"><strong>Libre</strong><span>sans heure</span></button></div>`;
      box.querySelectorAll('[data-slot]').forEach((b) => b.onclick = () => { draft.creneau = b.dataset.slot; markDirty(); renderSlots(); renderRecap(); });
    };

    // --- Étape 3 : gâteaux du catalogue
    const lineFor = (pid) => draft.lines.find((l) => l.product_id === pid && !l.custom);
    const setQty = (pid, q) => {
      const p = productById(pid); let l = lineFor(pid);
      if (q <= 0) { draft.lines = draft.lines.filter((x) => x !== l); }
      else if (l) l.quantite = q;
      else draft.lines.push(Object.assign({ key: uid(), product_id: pid, libelle: p.nom, format: p.format || '', quantite: q, custom: false }, lineFromProduct(p, draft.type)));
      markDirty(); renderProducts(); renderRecap();
    };
    const renderCatChips = () => {
      const cats = [...new Set(S.products.filter((p) => p.actif).map((p) => p.categorie || 'Autre'))];
      $('#cat-chips').innerHTML = [['toutes', 'Tous'], ...cats.map((c) => [c, c])]
        .map(([k, l]) => `<button type="button" class="chip" data-cat="${esc(k)}" aria-pressed="${catFilter === k}">${esc(l)}</button>`).join('');
      $$('#cat-chips [data-cat]').forEach((b) => b.onclick = () => { catFilter = b.dataset.cat; renderCatChips(); renderProducts(); });
    };
    const renderProducts = () => {
      const q = prodSearch.trim().toLowerCase();
      const inOrder = new Set(draft.lines.map((l) => l.product_id));
      const list = S.products.filter((p) => (p.actif || inOrder.has(p.id))
        && (catFilter === 'toutes' || (p.categorie || 'Autre') === catFilter)
        && (!q || (p.nom + ' ' + (p.format || '') + ' ' + (p.categorie || '')).toLowerCase().includes(q)))
        .sort((a, b) => (inOrder.has(b.id) - inOrder.has(a.id)) || a.nom.localeCompare(b.nom));
      $('#catalog-pick').innerHTML = list.length ? list.map((p) => {
        const l = lineFor(p.id); const qn = l ? l.quantite : 0;
        const base = l || lineFromProduct(p, draft.type);
        const price = draft.type === 'pro' ? `${eur(base.unit_ht)} HT` : eur(base.unit_ttc);
        const late = draft.date_retrait && diffDays(draft.date_retrait, today()) < Number(p.delai_jours || 0);
        return `<div class="pick-row ${qn ? 'has-qty' : ''}">
          <div><div class="pick-name">${esc(p.nom)}</div><div class="pick-meta">${esc([p.format, p.categorie].filter(Boolean).join(', '))}${p.delai_jours ? `, à commander ${p.delai_jours} j avant` : ''}${late ? ' <strong style="color:var(--alerte)">(délai court)</strong>' : ''}</div></div>
          <div class="pick-price">${price}</div>
          <div class="stepper">
            <button type="button" data-minus="${p.id}" aria-label="Retirer un ${esc(p.nom)}">−</button>
            <output aria-label="Quantité">${qn}</output>
            <button type="button" data-plus="${p.id}" aria-label="Ajouter un ${esc(p.nom)}">+</button>
          </div></div>`;
      }).join('') : '<p class="muted small">Aucun gâteau ne correspond. Ajoute-le au catalogue ou crée un gâteau sur mesure.</p>';
      $$('#catalog-pick [data-plus]').forEach((b) => b.onclick = () => { const l = lineFor(b.dataset.plus); setQty(b.dataset.plus, (l ? l.quantite : 0) + 1); });
      $$('#catalog-pick [data-minus]').forEach((b) => b.onclick = () => { const l = lineFor(b.dataset.minus); setQty(b.dataset.minus, (l ? l.quantite : 0) - 1); });
    };
    $('#prod-q').oninput = (e) => { prodSearch = e.target.value; renderProducts(); };

    // Gâteaux sur mesure (hors catalogue)
    const renderCustom = () => {
      const lines = draft.lines.filter((l) => l.custom);
      $('#custom-lines').innerHTML = lines.map((l) => `
        <div class="custom-line" data-key="${l.key}">
          <label class="field"><span>Gâteau sur mesure</span><input type="text" data-f="libelle" value="${esc(l.libelle)}" placeholder="Ex. Wedding cake 3 étages"></label>
          <label class="field"><span>Prix unitaire ${draft.type === 'pro' ? 'HT' : 'TTC'}</span><input type="number" min="0" step="0.01" inputmode="decimal" data-f="prix" value="${draft.type === 'pro' ? l.unit_ht : l.unit_ttc}"></label>
          <label class="field"><span>TVA</span><select data-f="tva">${TVAS.map((t) => `<option value="${t}" ${Number(l.tva) === t ? 'selected' : ''}>${pct(t)}</option>`).join('')}</select></label>
          <label class="field"><span>Quantité</span><input type="number" min="1" step="1" data-f="quantite" value="${l.quantite}" style="width:80px"></label>
          <button type="button" class="icon-btn" data-del="${l.key}" aria-label="Supprimer ce gâteau sur mesure">${icon('trash')}</button>
        </div>`).join('');
      $$('#custom-lines .custom-line').forEach((row) => {
        const l = draft.lines.find((x) => x.key === row.dataset.key);
        row.querySelectorAll('[data-f]').forEach((inp) => {
          const ev = inp.tagName === 'SELECT' ? 'onchange' : 'oninput';
          inp[ev] = () => {
            const f = inp.dataset.f;
            if (f === 'libelle') l.libelle = inp.value;
            if (f === 'quantite') l.quantite = Math.max(1, Math.round(num(inp.value, 1)));
            if (f === 'tva') { l.tva = num(inp.value, 0.055); if (draft.type === 'pro') l.unit_ttc = round2(l.unit_ht * (1 + l.tva)); else l.unit_ht = round2(l.unit_ttc / (1 + l.tva)); }
            if (f === 'prix') { const v = num(inp.value, 0); if (draft.type === 'pro') { l.unit_ht = v; l.unit_ttc = round2(v * (1 + l.tva)); } else { l.unit_ttc = v; l.unit_ht = round2(v / (1 + l.tva)); } }
            markDirty(); renderRecap();
          };
        });
        row.querySelector('[data-del]').onclick = () => { draft.lines = draft.lines.filter((x) => x !== l); markDirty(); renderCustom(); renderRecap(); };
      });
    };
    $('#add-custom').onclick = () => {
      draft.lines.push({ key: uid(), product_id: null, libelle: '', format: '', quantite: 1, custom: true, unit_ttc: 0, unit_ht: 0, tva: 0.055 });
      markDirty(); renderCustom(); renderRecap();
      const inputs = $$('#custom-lines [data-f="libelle"]'); if (inputs.length) inputs[inputs.length - 1].focus();
    };

    // --- Récapitulatif et alertes
    const computeWarnings = () => {
      const w = []; const d = draft.date_retrait;
      if (d) {
        if (d < today()) w.push('La date de retrait est passée.');
        const closure = closureFor(d);
        if (closure) w.push(`Boutique fermée ce jour-là (${closure.libelle || 'fermeture'}).`);
        else if (!hoursFor(d).ouvert) w.push(`Le ${JOURS[weekday(d)].toLowerCase()} est un jour de fermeture.`);
        const qty = draft.lines.reduce((s, l) => s + Number(l.quantite || 0), 0);
        const total = cakesOn(d, draft.id) + qty; const capa = capacityFor(d);
        if (capa && total > capa) w.push(`Capacité du jour dépassée : ${total} gâteaux pour ${capa} prévus.`);
        const max = Number(S.settings.max_commandes_creneau) || 0;
        if (draft.creneau && max && slotCount(d, draft.creneau, draft.id) >= max) w.push(`Le créneau de ${fmtTime(draft.creneau)} est déjà complet.`);
        draft.lines.forEach((l) => {
          const p = l.product_id && productById(l.product_id);
          if (p && p.delai_jours && diffDays(d, today()) < Number(p.delai_jours) && !isEdit) w.push(`${p.nom} se commande ${p.delai_jours} jours à l'avance.`);
        });
      }
      draft.lines.filter((l) => l.custom && (!l.libelle.trim() || !(l.unit_ttc > 0))).forEach(() => w.push('Un gâteau sur mesure n’a pas de nom ou de prix.'));
      return w;
    };
    const priced = () => draft.lines.map((l) => Object.assign({ product_id: l.product_id, libelle: l.libelle.trim() || 'Gâteau sur mesure', format: l.format || '' }, priceLine(l, l.quantite, draft.type)));
    const renderRecap = () => {
      const lines = priced(); const t = sumLines(lines); const w = computeWarnings();
      const qty = lines.reduce((s, l) => s + l.quantite, 0);
      $('#recap').innerHTML = `
        <h2>Récapitulatif</h2>
        <div class="muted small">${draft.client_nom ? esc(draft.client_nom) : 'Client à renseigner'}${draft.date_retrait ? `<br>${esc(fmtDay(draft.date_retrait))}${draft.creneau ? ' à ' + esc(fmtTime(draft.creneau)) : ''}` : ''}</div>
        <ul class="recap-lines">${lines.length ? lines.map((l) => `<li><span>${l.quantite} × ${esc(l.libelle)}</span><span>${eur(draft.type === 'pro' ? l.total_ht : l.total_ttc)}</span></li>`).join('') : '<li class="muted">Aucun gâteau pour l’instant</li>'}</ul>
        <div class="totals">
          <div><span>Total HT</span><span>${eur(t.total_ht)}</span></div>
          <div><span>TVA</span><span>${eur(t.total_tva)}</span></div>
          <div class="grand"><span>Total TTC</span><span>${eur(t.total_ttc)}</span></div>
          <div class="muted small"><span>${qty} gâteau${qty > 1 ? 'x' : ''}</span><span>${draft.paye ? 'Déjà payée' : 'À encaisser au retrait'}</span></div>
        </div>
        ${w.length ? `<ul class="warnings">${w.map((x) => `<li>${icon('alert')}<span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
        <button type="button" class="btn btn-dark" data-save>${isEdit ? 'Enregistrer les modifications' : 'Enregistrer la commande'}</button>`;
      $('#mb-total').innerHTML = `<small>${qty} gâteau${qty > 1 ? 'x' : ''}</small>${eur(t.total_ttc)}`;
      $('#recap [data-save]').onclick = save;
    };
    $('#mb-save').onclick = () => save();
    form.onsubmit = (e) => { e.preventDefault(); }; // la touche Entrée n'enregistre pas par erreur

    const validate = () => {
      const errs = [];
      $('#f-nom').classList.toggle('invalid', !draft.client_nom.trim()); if (!draft.client_nom.trim()) errs.push('#client_nom');
      $('#f-date').classList.toggle('invalid', !draft.date_retrait); if (!draft.date_retrait) errs.push('#date_retrait');
      $('#err-lines').hidden = draft.lines.length > 0; if (!draft.lines.length) errs.push('#add-custom');
      return errs;
    };
    let saving = false;
    async function save() {
      if (saving) return;
      showErrors = true;
      const errs = validate();
      if (errs.length) { const el = $(errs[0]); el.scrollIntoView({ block: 'center' }); el.focus(); toast('Il manque des informations'); return; }
      const w = computeWarnings();
      if (w.length && !(await confirmDialog('Enregistrer malgré les alertes ?', w.map(esc).join('<br>'), 'Enregistrer quand même'))) return;
      saving = true;
      try {
        // 1. Client : création ou mise à jour de la fiche
        let customerId = draft.customer_id;
        const custData = { nom: draft.client_nom.trim(), telephone: draft.client_tel.trim(), email: draft.client_email.trim(), type: draft.type, societe: draft.type === 'pro' ? draft.societe.trim() : '' };
        if (customerId) {
          const c = S.customers.find((x) => x.id === customerId);
          if (c && (c.telephone !== custData.telephone || c.email !== custData.email || c.type !== custData.type || (c.societe || '') !== custData.societe)) {
            const saved = await store.upsert('customers', Object.assign({ id: c.id }, custData));
            Object.assign(c, saved);
          }
        } else {
          const saved = await store.upsert('customers', custData);
          S.customers.push(saved); customerId = saved.id;
        }
        // 2. Commande + lignes
        const lines = priced();
        const totals = sumLines(lines);
        const order = Object.assign({
          customer_id: customerId, client_nom: custData.nom, client_tel: custData.telephone, client_email: custData.email,
          type: draft.type, canal: draft.canal, date_retrait: draft.date_retrait, creneau: draft.creneau || null,
          message_gateau: draft.message_gateau.trim(), allergies: draft.allergies.trim(), notes: draft.notes.trim(),
          paye: draft.paye, moyen_paiement: draft.paye ? (draft.moyen_paiement || MOYENS[0]) : null,
          paye_le: draft.paye ? (draft.paye_le || new Date().toISOString()) : null
        }, totals);
        if (draft.id) { order.id = draft.id; order.statut = orderById(draft.id).statut; }
        const res = await store.saveOrder(order, lines);
        const i = S.orders.findIndex((o) => o.id === res.order.id);
        if (i >= 0) S.orders[i] = res.order; else S.orders.push(res.order);
        S.items = S.items.filter((it) => it.order_id !== res.order.id).concat(res.items);
        draft.dirty = false; leaveGuard = null;
        toast(isEdit ? 'Modifications enregistrées' : `Commande ${res.order.numero} enregistrée`);
        go('#/commande/' + res.order.id);
      } catch (e) {
        console.error(e); toast('Commande non enregistrée : ' + (e.message || 'erreur'));
      } finally { saving = false; }
    }

    renderType(); renderClientLink(); renderDayChips(); renderSlots(); renderCatChips(); renderProducts(); renderCustom(); renderRecap();
    if (!isEdit && !draft.client_nom) $('#client_nom').focus();
    void showErrors;
  }

  /* ------------------------------------------------------------------
     Écran : Détail d'une commande
     ------------------------------------------------------------------ */
  function viewOrderDetail(id) {
    const o = orderById(id);
    if (!o) { view.innerHTML = `<div class="empty"><p>Cette commande n'existe pas ou a été supprimée.</p><a class="btn" href="#/commandes">Voir les commandes</a></div>`; return; }
    const its = itemsOf(o.id);
    const cancelled = o.statut === 'annulee';
    const idx = FLOW.indexOf(o.statut);
    const rel = relDay(o.date_retrait);
    view.innerHTML = `
      <div class="print-only"><img src="${esc(LOGO_SRC)}" alt=""><strong>${esc(CFG.NOM_BOUTIQUE)}</strong>, bon de commande</div>
      <div class="page-head">
        <div>
          <h1>${esc(o.client_nom)}</h1>
          <p>${esc(o.numero || '')}, ${o.type === 'pro' ? 'client professionnel' : 'particulier'}, reçue par ${esc((CANAUX[o.canal] || o.canal || '').toLowerCase())}</p>
        </div>
        <div class="page-actions no-print">
          ${cancelled ? '' : `<a class="btn" href="#/commande/${o.id}/modifier">${icon('edit')}Modifier</a>`}
          <a class="btn" href="#/nouvelle?copie=${o.id}">${icon('copy')}Recommander</a>
          <button class="btn" id="print">${icon('print')}Imprimer le bon</button>
        </div>
      </div>
      ${cancelled
        ? `<div class="banner warn no-print">${icon('alert')}<div>Cette commande est annulée. <button class="btn btn-sm" id="restore" style="margin-left:8px">Rétablir la commande</button></div></div>`
        : `<div class="stepline" role="group" aria-label="Statut de la commande">${FLOW.map((s, i) => `<button type="button" data-set="${s}" class="${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}" aria-pressed="${i === idx}">${STATUTS[s].label}</button>`).join('')}</div>`}
      <div class="detail-grid">
        <div>
          <section class="block">
            <h2>Retrait</h2>
            <div class="big-line">${rel ? esc(rel) + ', ' : ''}${esc(fmtDay(o.date_retrait))}${o.creneau ? ' à ' + esc(fmtTime(o.creneau)) : ''}</div>
            <a class="no-print small" href="#/jour?d=${o.date_retrait}">Voir la journée</a>
          </section>
          <section class="block">
            <h2>Client</h2>
            <dl class="facts">
              <dt>Nom</dt><dd>${esc(o.client_nom)}</dd>
              ${o.client_tel ? `<dt>Téléphone</dt><dd><a href="tel:${esc(o.client_tel.replace(/\s/g, ''))}">${esc(o.client_tel)}</a></dd>` : ''}
              ${o.client_email ? `<dt>Email</dt><dd><a href="mailto:${esc(o.client_email)}">${esc(o.client_email)}</a></dd>` : ''}
            </dl>
          </section>
          <section class="block">
            <h2>Gâteaux</h2>
            <table class="items-table">
              <thead><tr><th>Gâteau</th><th>Qté</th><th>Prix unit. TTC</th><th>TVA</th><th>Total TTC</th></tr></thead>
              <tbody>${its.map((i) => `<tr><td><strong>${esc(i.libelle)}</strong>${i.format ? ` <span class="muted">(${esc(i.format)})</span>` : ''}</td><td>${i.quantite}</td><td>${eur(i.prix_unitaire_ttc)}</td><td>${pct(i.tva)}</td><td>${eur(i.total_ttc)}</td></tr>`).join('')}</tbody>
              <tfoot>
                <tr><td colspan="4">Total HT</td><td>${eur(o.total_ht)}</td></tr>
                <tr><td colspan="4">TVA</td><td>${eur(o.total_tva)}</td></tr>
                <tr class="grand"><td colspan="4">Total TTC</td><td>${eur(o.total_ttc)}</td></tr>
              </tfoot>
            </table>
          </section>
          ${(o.message_gateau || o.allergies || o.notes) ? `<section class="block" style="display:grid;gap:10px">
            <h2>Détails</h2>
            ${o.message_gateau ? `<div class="note-box"><strong>Sur le gâteau :</strong> « ${esc(o.message_gateau)} »</div>` : ''}
            ${o.allergies ? `<div class="note-box allergy">Allergies : ${esc(o.allergies)}</div>` : ''}
            ${o.notes ? `<div class="note-box" style="background:#F7F5F4"><strong>Note interne :</strong> ${esc(o.notes)}</div>` : ''}
          </section>` : ''}
          <section class="block no-print">
            <h2>Historique</h2>
            <p class="small muted" style="margin:0">Créée le ${esc(fmtDateTime(o.created_at))}${o.updated_at ? `, modifiée le ${esc(fmtDateTime(o.updated_at))}` : ''}.</p>
            ${cancelled ? '' : `<button class="btn btn-danger btn-sm" id="cancel" style="margin-top:14px">Annuler la commande</button>`}
          </section>
        </div>
        <aside class="pay-box">
          ${o.paye
            ? `<span class="tag tag-paid" style="justify-self:start">Payée</span><span class="amount">${eur(o.total_ttc)}</span>
               <span class="small muted">${esc(o.moyen_paiement || '')}${o.paye_le ? ', le ' + esc(fmtDateTime(o.paye_le)) : ''}</span>
               ${cancelled ? '' : '<button class="btn btn-sm btn-ghost no-print" id="unpay">Annuler l’encaissement</button>'}`
            : `<span class="small muted">Reste à encaisser au retrait</span><span class="amount">${eur(cancelled ? 0 : o.total_ttc)}</span>
               ${cancelled ? '' : `<button class="btn btn-primary" id="pay">Encaisser</button>`}`}
          ${!cancelled && STATUTS[o.statut].next ? `<button class="btn btn-dark" id="next">${esc(STATUTS[o.statut].action)}</button>` : ''}
        </aside>
      </div>`;

    $('#print').onclick = () => window.print();
    const nextBtn = $('#next'); if (nextBtn) nextBtn.onclick = () => advance(o.id);
    const payBtn = $('#pay'); if (payBtn) payBtn.onclick = () => openPayment(o, false);
    const unpay = $('#unpay'); if (unpay) unpay.onclick = async () => {
      if (!(await confirmDialog('Annuler l’encaissement ?', 'La commande repassera « À encaisser ».', 'Annuler l’encaissement', true))) return;
      const saved = await guard(() => store.updateOrder(o.id, { paye: false, moyen_paiement: null, paye_le: null }));
      if (saved) { Object.assign(o, saved); toast('Encaissement annulé'); router(); }
    };
    $$('[data-set]').forEach((b) => b.onclick = () => {
      const s = b.dataset.set; if (s === o.statut) return;
      if (s === 'retiree' && !o.paye) { openPayment(o, true); return; }
      setStatus(o, s);
    });
    const cancelBtn = $('#cancel'); if (cancelBtn) cancelBtn.onclick = async () => {
      if (!(await confirmDialog('Annuler cette commande ?', `La commande de ${esc(o.client_nom)} restera dans l’historique avec le statut « Annulée ». Les gâteaux ne compteront plus dans la capacité du jour.`, 'Annuler la commande', true))) return;
      setStatus(o, 'annulee');
    };
    const restore = $('#restore'); if (restore) restore.onclick = () => setStatus(o, 'recue');
  }

  /* ------------------------------------------------------------------
     Écran : Planning de la semaine + production
     ------------------------------------------------------------------ */
  function viewPlanning(start) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const t = today();
    const cards = days.map((d) => {
      const open = isOpen(d); const cakes = cakesOn(d); const capa = capacityFor(d);
      const n = activeOrdersOn(d).length; const m = milestoneFor(d); const closure = closureFor(d);
      return `<a class="wday ${d === t ? 'today' : ''} ${open ? '' : 'closed'}" href="#/jour?d=${d}">
        <div><div class="wday-name">${esc(cap(parseDate(d).toLocaleDateString('fr-FR', { weekday: 'long' })))}</div>
        <div class="wday-num">${parseDate(d).getDate()}</div></div>
        <div>${open || n ? `<div class="wday-load"><strong>${n}</strong> commande${n > 1 ? 's' : ''}<br><strong>${cakes}</strong> / ${capa} gâteaux</div>${bar(cakes, capa)}` : `<div class="wday-load muted">${closure ? esc(closure.libelle || 'Fermé') : 'Fermé'}</div>`}
        ${m ? `<span class="tag">${esc(m.nom)}</span>` : ''}</div>
      </a>`;
    }).join('');

    // Tableau de production : gâteaux × jours
    const prod = new Map();
    days.forEach((d, di) => activeOrdersOn(d).forEach((o) => itemsOf(o.id).forEach((i) => {
      const k = i.libelle + (i.format ? ` (${i.format})` : '');
      if (!prod.has(k)) prod.set(k, Array(7).fill(0));
      prod.get(k)[di] += Number(i.quantite);
    })));
    const rows = [...prod.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const colTotals = days.map((_, di) => rows.reduce((s, [, arr]) => s + arr[di], 0));
    const wEnd = days[6];
    const sameMonth = parseDate(start).getMonth() === parseDate(wEnd).getMonth();
    const title = sameMonth
      ? `Du ${parseDate(start).getDate()} au ${fmtDay(wEnd, { day: 'numeric', month: 'long', year: 'numeric' })}`
      : `Du ${fmtDay(start, { day: 'numeric', month: 'long' })} au ${fmtDay(wEnd, { day: 'numeric', month: 'long', year: 'numeric' })}`;

    view.innerHTML = `
      <div class="page-head">
        <div><h1>Planning</h1><p>${esc(title)}</p></div>
        <div class="page-actions day-nav">
          <a class="icon-btn" href="#/planning?s=${addDays(start, -7)}" aria-label="Semaine précédente">${icon('left')}</a>
          <a class="btn btn-sm ${start === mondayOf(t) ? 'btn-primary' : ''}" href="#/planning?s=${mondayOf(t)}">Cette semaine</a>
          <a class="icon-btn" href="#/planning?s=${addDays(start, 7)}" aria-label="Semaine suivante">${icon('right')}</a>
          <label class="sr" for="week-pick">Aller à la semaine du</label>
          <input type="date" id="week-pick" value="${start}" style="width:auto;min-height:40px">
        </div>
      </div>
      <div class="week">${cards}</div>
      <h2 class="section-title">Production de la semaine</h2>
      ${rows.length ? `<div class="table-wrap"><table class="list prod-table">
        <thead><tr><th>Gâteau</th>${days.map((d) => `<th>${esc(cap(parseDate(d).toLocaleDateString('fr-FR', { weekday: 'short' })))} ${parseDate(d).getDate()}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>${rows.map(([k, arr]) => `<tr><td class="cell-strong">${esc(k)}</td>${arr.map((q) => `<td class="num ${q ? 'cell-strong' : 'zero'}">${q || '–'}</td>`).join('')}<td class="num cell-strong">${arr.reduce((a, b) => a + b, 0)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td>${colTotals.map((q) => `<td class="num">${q}</td>`).join('')}<td class="num">${colTotals.reduce((a, b) => a + b, 0)}</td></tr></tfoot>
      </table></div>` : `<div class="empty"><p>Aucun gâteau à produire cette semaine.</p></div>`}`;
    $('#week-pick').onchange = (e) => { if (e.target.value) go('#/planning?s=' + mondayOf(e.target.value)); };
  }

  /* ------------------------------------------------------------------
     Écran : Catalogue
     ------------------------------------------------------------------ */
  let showHidden = false;
  function viewCatalogue() {
    const groups = new Map();
    S.products.filter((p) => showHidden || p.actif).sort((a, b) => a.nom.localeCompare(b.nom)).forEach((p) => {
      const k = p.categorie || 'Autre'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p);
    });
    const order = [...CATEGORIES, ...[...groups.keys()].filter((k) => !CATEGORIES.includes(k))];
    const hiddenCount = S.products.filter((p) => !p.actif).length;
    view.innerHTML = `
      <div class="page-head">
        <div><h1>Catalogue</h1><p>${S.products.filter((p) => p.actif).length} gâteaux proposés${hiddenCount ? `, ${hiddenCount} masqué${hiddenCount > 1 ? 's' : ''}` : ''}</p></div>
        <div class="page-actions">
          ${hiddenCount ? `<button class="btn" id="toggle-hidden">${showHidden ? 'Cacher les gâteaux masqués' : 'Afficher les gâteaux masqués'}</button>` : ''}
          <button class="btn btn-primary" id="add-prod">${icon('plus')}Ajouter un gâteau</button>
        </div>
      </div>
      ${groups.size ? order.filter((k) => groups.has(k)).map((k) => `
        <section class="cat-group"><h2>${esc(k)}</h2>
          ${groups.get(k).map((p) => `
            <div class="prod-row ${p.actif ? '' : 'inactive'}">
              <div><strong>${esc(p.nom)}</strong>${p.format ? ` <span class="muted">(${esc(p.format)})</span>` : ''}
                <div class="small muted">${esc([p.saison && p.saison !== "Toute l'année" ? p.saison : '', p.allergenes ? 'Allergènes : ' + p.allergenes : ''].filter(Boolean).join('. '))}</div></div>
              <span class="small muted prod-delay">${p.delai_jours ? `${p.delai_jours} j avant` : ''}</span>
              <div class="prod-prices">${p.prix_ttc != null ? eur(p.prix_ttc) + ' TTC' : '–'}<small>${p.prix_ht_pro != null && p.prix_ht_pro !== '' ? `Pro : ${eur(p.prix_ht_pro)} HT` : `TVA ${pct(p.tva)}`}</small></div>
              <button class="btn btn-sm" data-edit="${p.id}">Modifier</button>
            </div>`).join('')}
        </section>`).join('') : `<div class="empty"><p>Le catalogue est vide. Ajoute ton premier gâteau.</p></div>`}`;
    $('#add-prod').onclick = () => editProduct(null);
    const th = $('#toggle-hidden'); if (th) th.onclick = () => { showHidden = !showHidden; viewCatalogue(); };
    $$('[data-edit]').forEach((b) => b.onclick = () => editProduct(b.dataset.edit));
  }
  function editProduct(id) {
    const p = id ? productById(id) : { nom: '', format: '', categorie: CATEGORIES[0], saison: SAISONS[0], prix_ttc: '', prix_ht_pro: '', tva: 0.055, delai_jours: 2, allergenes: '', description: '', actif: true };
    const used = id && S.items.some((i) => i.product_id === id);
    openModal(id ? 'Modifier le gâteau' : 'Ajouter un gâteau', `
      <label class="field"><span>Nom <span class="req">*</span></span><input type="text" id="p-nom" value="${esc(p.nom)}"></label>
      <div class="grid-2">
        <label class="field"><span>Format</span><input type="text" id="p-format" value="${esc(p.format || '')}" placeholder="Ex. 6 parts"></label>
        <label class="field"><span>Catégorie</span><select id="p-cat">${CATEGORIES.map((c) => `<option ${p.categorie === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <div class="grid-3">
        <label class="field"><span>Prix particulier TTC</span><input type="number" min="0" step="0.01" inputmode="decimal" id="p-ttc" value="${p.prix_ttc == null ? '' : p.prix_ttc}"></label>
        <label class="field"><span>Prix pro HT <span class="hint">facultatif</span></span><input type="number" min="0" step="0.01" inputmode="decimal" id="p-pro" value="${p.prix_ht_pro == null ? '' : p.prix_ht_pro}"></label>
        <label class="field"><span>TVA</span><select id="p-tva">${TVAS.map((t) => `<option value="${t}" ${Number(p.tva) === t ? 'selected' : ''}>${pct(t)}</option>`).join('')}</select></label>
      </div>
      <p class="small muted" style="margin:-4px 0 0" id="p-ht"></p>
      <div class="grid-2">
        <label class="field"><span>Délai minimum (jours)</span><input type="number" min="0" step="1" id="p-delai" value="${p.delai_jours == null ? 0 : p.delai_jours}"></label>
        <label class="field"><span>Saison</span><select id="p-saison">${SAISONS.map((s) => `<option ${p.saison === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Allergènes</span><input type="text" id="p-all" value="${esc(p.allergenes || '')}" placeholder="Ex. gluten, œufs, lait, fruits à coque"></label>
      <label class="field"><span>Description</span><textarea id="p-desc">${esc(p.description || '')}</textarea></label>
      <label class="check"><input type="checkbox" id="p-actif" ${p.actif ? 'checked' : ''}>Proposé à la commande</label>`,
      `${id && !used ? `<button class="btn btn-danger" data-x="del" style="margin-right:auto">Supprimer</button>` : ''}
       <button class="btn" data-x="cancel">Retour</button><button class="btn btn-dark" data-x="ok">Enregistrer</button>`,
      (box) => {
        const upd = () => {
          const ttc = num($('#p-ttc', box).value, NaN); const tva = num($('#p-tva', box).value, 0.055);
          $('#p-ht', box).textContent = Number.isFinite(ttc) ? `Soit ${eur(round2(ttc / (1 + tva)))} HT pour un particulier.` : '';
        };
        $('#p-ttc', box).oninput = upd; $('#p-tva', box).onchange = upd; upd();
        box.querySelector('[data-x="cancel"]').onclick = closeModal;
        const del = box.querySelector('[data-x="del"]');
        if (del) del.onclick = async () => {
          closeModal();
          if (!(await confirmDialog('Supprimer ce gâteau ?', `${esc(p.nom)} sera retiré du catalogue.`, 'Supprimer', true))) return;
          await guard(async () => { await store.remove('products', id); S.products = S.products.filter((x) => x.id !== id); toast('Gâteau supprimé'); router(); });
        };
        box.querySelector('[data-x="ok"]').onclick = async () => {
          const nom = $('#p-nom', box).value.trim();
          if (!nom) { $('#p-nom', box).closest('.field').classList.add('invalid'); $('#p-nom', box).focus(); return; }
          const ttcRaw = $('#p-ttc', box).value; const proRaw = $('#p-pro', box).value;
          if (ttcRaw === '' && proRaw === '') { toast('Indique au moins un prix'); $('#p-ttc', box).focus(); return; }
          const row = {
            nom, format: $('#p-format', box).value.trim(), categorie: $('#p-cat', box).value, saison: $('#p-saison', box).value,
            prix_ttc: ttcRaw === '' ? null : round2(num(ttcRaw)), prix_ht_pro: proRaw === '' ? null : round2(num(proRaw)),
            tva: num($('#p-tva', box).value, 0.055), delai_jours: Math.max(0, Math.round(num($('#p-delai', box).value, 0))),
            allergenes: $('#p-all', box).value.trim(), description: $('#p-desc', box).value.trim(), actif: $('#p-actif', box).checked
          };
          if (id) row.id = id;
          const saved = await guard(() => store.upsert('products', row), 'Gâteau non enregistré');
          if (!saved) return;
          const i = S.products.findIndex((x) => x.id === saved.id);
          if (i >= 0) S.products[i] = saved; else S.products.push(saved);
          closeModal(); toast(id ? 'Gâteau modifié' : 'Gâteau ajouté'); router();
        };
      });
  }

  /* ------------------------------------------------------------------
     Écran : Réglages (horaires, capacité, fermetures, temps forts, données)
     ------------------------------------------------------------------ */
  function viewSettings() {
    const s = JSON.parse(JSON.stringify(S.settings));
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const ms = S.milestones.slice().sort((a, b) => String(a.debut_retrait || '').localeCompare(String(b.debut_retrait || '')));
    view.innerHTML = `
      <div class="page-head"><div><h1>Réglages</h1><p>Horaires, capacité et temps forts utilisés pour proposer les créneaux.</p></div></div>

      <section class="settings-section">
        <h2 class="section-title">Horaires de retrait</h2>
        <p>Les créneaux proposés dans une commande sont calculés à partir de ces horaires.</p>
        <div class="hours">${dayOrder.map((i) => `
          <div class="hour-row ${s.horaires[i].ouvert ? '' : 'off'}" data-day="${i}">
            <strong>${JOURS[i]}</strong>
            <label class="check"><input type="checkbox" data-h="ouvert" ${s.horaires[i].ouvert ? 'checked' : ''}>Ouvert</label>
            <label class="field"><span class="sr">Début ${JOURS[i]}</span><input type="time" data-h="debut" value="${esc(s.horaires[i].debut)}"></label>
            <label class="field"><span class="sr">Fin ${JOURS[i]}</span><input type="time" data-h="fin" value="${esc(s.horaires[i].fin)}"></label>
          </div>`).join('')}</div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">Créneaux et capacité</h2>
        <div class="grid-3">
          <label class="field"><span>Durée d'un créneau</span><select id="s-step">${[15, 30, 60].map((m) => `<option value="${m}" ${s.creneau_minutes === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
          <label class="field"><span>Commandes max par créneau</span><input type="number" min="1" id="s-maxslot" value="${s.max_commandes_creneau}"></label>
          <label class="field"><span>Gâteaux max par jour</span><input type="number" min="1" id="s-capa" value="${s.capacite_jour}"><span class="hint">Hors temps forts</span></label>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">Fermetures exceptionnelles</h2>
        <p>Congés, jours fériés : ces dates s'affichent comme fermées.</p>
        <ul class="mini-list" id="closures">${(s.fermetures || []).length ? s.fermetures.slice().sort((a, b) => a.debut.localeCompare(b.debut)).map((f) => `
          <li><span><strong>${esc(f.libelle || 'Fermeture')}</strong><br><span class="small muted">${f.fin && f.fin !== f.debut ? `Du ${esc(fmtShort(f.debut))} au ${esc(fmtShort(f.fin))}` : `Le ${esc(fmtShort(f.debut))}`}</span></span>
          <button class="icon-btn" data-delclosure="${esc(f.id)}" aria-label="Supprimer cette fermeture">${icon('trash')}</button></li>`).join('') : '<li class="muted">Aucune fermeture prévue.</li>'}</ul>
        <div class="grid-3" style="align-items:end">
          <label class="field"><span>Du</span><input type="date" id="c-debut"></label>
          <label class="field"><span>Au <span class="hint">facultatif</span></span><input type="date" id="c-fin"></label>
          <label class="field"><span>Motif</span><input type="text" id="c-lib" placeholder="Ex. Congés d'été"></label>
        </div>
        <button class="btn" id="add-closure" style="margin-top:12px">${icon('plus')}Ajouter la fermeture</button>
      </section>

      <div class="settings-section" style="border-top:0;padding-top:0"><button class="btn btn-dark" id="save-settings">Enregistrer les réglages</button></div>

      <section class="settings-section">
        <h2 class="section-title">Temps forts de l'année</h2>
        <p>Noël, galette, Pâques… Pendant les dates de retrait, la capacité du jour est remplacée par celle du temps fort.</p>
        <ul class="mini-list">${ms.length ? ms.map((m) => `
          <li><span><strong>${esc(m.nom)}</strong><br><span class="small muted">Commandes ${m.debut_commandes ? 'du ' + esc(fmtShort(m.debut_commandes)) : ''}${m.fin_commandes ? ' au ' + esc(fmtShort(m.fin_commandes)) : ''}. Retrait ${m.debut_retrait ? 'du ' + esc(fmtShort(m.debut_retrait)) : ''}${m.fin_retrait ? ' au ' + esc(fmtShort(m.fin_retrait)) : ''}${m.capacite_jour ? `. ${m.capacite_jour} gâteaux par jour` : ''}.</span></span>
          <button class="btn btn-sm" data-ms="${m.id}">Modifier</button></li>`).join('') : '<li class="muted">Aucun temps fort.</li>'}</ul>
        <button class="btn" id="add-ms">${icon('plus')}Ajouter un temps fort</button>
      </section>

      ${isOnline ? `
      <section class="settings-section">
        <h2 class="section-title">Mot de passe</h2>
        <p>Choisis un mot de passe d'au moins 10 caractères. Le navigateur de la tablette pourra le retenir.</p>
        <form id="pass-form" class="grid-2" style="align-items:end" novalidate>
          <input type="email" autocomplete="username" value="${esc(S.user && S.user.email)}" hidden>
          <label class="field"><span>Nouveau mot de passe</span><input type="password" id="new-pass" autocomplete="new-password" minlength="10"></label>
          <label class="field"><span>Confirmer</span><input type="password" id="new-pass2" autocomplete="new-password" minlength="10"></label>
          <div><button class="btn btn-dark" type="submit">Changer le mot de passe</button></div>
        </form>
      </section>` : ''}

      <section class="settings-section">
        <h2 class="section-title">Données</h2>
        <p>${isOnline ? `Données enregistrées en ligne. Connectée avec <strong>${esc(S.user && S.user.email)}</strong>.` : 'Mode démo : les données sont enregistrées uniquement dans ce navigateur. Elles disparaissent si l’historique du navigateur est vidé.'}</p>
        <div class="page-actions">
          <button class="btn" id="backup">${icon('download')}Télécharger une sauvegarde</button>
          ${isOnline ? `<button class="btn" id="logout">${icon('logout')}Se déconnecter</button>` : `
            <label class="btn" for="restore-file">Restaurer une sauvegarde</label><input type="file" id="restore-file" accept="application/json" hidden>
            <button class="btn btn-danger" id="reset-demo">Remettre les données d'exemple</button>`}
        </div>
      </section>`;

    $$('.hour-row').forEach((row) => {
      const i = Number(row.dataset.day);
      row.querySelectorAll('[data-h]').forEach((inp) => inp.onchange = () => {
        const k = inp.dataset.h; s.horaires[i][k] = k === 'ouvert' ? inp.checked : inp.value;
        row.classList.toggle('off', !s.horaires[i].ouvert);
      });
    });
    $('#s-step').onchange = (e) => { s.creneau_minutes = Number(e.target.value); };
    $('#s-maxslot').oninput = (e) => { s.max_commandes_creneau = Math.max(1, Math.round(num(e.target.value, 1))); };
    $('#s-capa').oninput = (e) => { s.capacite_jour = Math.max(1, Math.round(num(e.target.value, 1))); };
    const persist = async (msg) => {
      for (const i of Object.keys(s.horaires)) {
        const h = s.horaires[i];
        if (h.ouvert && timeToMin(h.fin) <= timeToMin(h.debut)) { toast(`${JOURS[i]} : l’heure de fin doit être après l’heure de début`); return false; }
      }
      const saved = await guard(() => store.saveSettings(s), 'Réglages non enregistrés');
      if (saved === undefined) return false;
      S.settings = mergeSettings(s); toast(msg || 'Réglages enregistrés'); return true;
    };
    $('#save-settings').onclick = () => persist();
    $('#add-closure').onclick = async () => {
      const debut = $('#c-debut').value; const fin = $('#c-fin').value || debut;
      if (!debut) { toast('Choisis la date de début'); $('#c-debut').focus(); return; }
      if (fin < debut) { toast('La date de fin est avant la date de début'); return; }
      s.fermetures = (s.fermetures || []).concat({ id: uid(), debut, fin, libelle: $('#c-lib').value.trim() });
      if (await persist('Fermeture ajoutée')) viewSettings();
    };
    $$('[data-delclosure]').forEach((b) => b.onclick = async () => {
      s.fermetures = s.fermetures.filter((f) => f.id !== b.dataset.delclosure);
      if (await persist('Fermeture supprimée')) viewSettings();
    });
    $('#add-ms').onclick = () => editMilestone(null);
    $$('[data-ms]').forEach((b) => b.onclick = () => editMilestone(b.dataset.ms));
    $('#backup').onclick = () => {
      const dump = { exported_at: new Date().toISOString(), products: S.products, customers: S.customers, orders: S.orders, items: S.items, milestones: S.milestones, settings: S.settings };
      download(`sauvegarde-commandes-${today()}.json`, JSON.stringify(dump, null, 2), 'application/json');
    };
    if (isOnline) {
      $('#logout').onclick = async () => { await store.signOut(); location.hash = ''; location.reload(); };
      $('#pass-form').onsubmit = async (e) => {
        e.preventDefault();
        const p1 = $('#new-pass').value; const p2 = $('#new-pass2').value;
        if (p1.length < 10) { toast('Le mot de passe doit faire au moins 10 caractères'); $('#new-pass').focus(); return; }
        if (p1 !== p2) { toast('Les deux mots de passe ne correspondent pas'); $('#new-pass2').focus(); return; }
        try { await store.changePassword(p1); $('#new-pass').value = ''; $('#new-pass2').value = ''; toast('Mot de passe changé'); }
        catch (err) { toast(authError(err)); }
      };
    } else {
      $('#reset-demo').onclick = async () => {
        if (!(await confirmDialog('Remettre les données d’exemple ?', 'Toutes les commandes et réglages saisis dans la démo seront remplacés.', 'Remettre les données', true))) return;
        await store.reset(); await loadData(); toast('Données d’exemple remises'); go('#/jour');
      };
      $('#restore-file').onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const obj = JSON.parse(await f.text());
          if (!Array.isArray(obj.orders) || !Array.isArray(obj.products)) throw new Error('fichier non reconnu');
          if (!(await confirmDialog('Restaurer cette sauvegarde ?', 'Les données actuelles de la démo seront remplacées.', 'Restaurer', true))) return;
          await store.importAll({ products: obj.products, customers: obj.customers || [], orders: obj.orders, items: obj.items || [], milestones: obj.milestones || [], settings: obj.settings, seq: obj.orders.length });
          await loadData(); toast('Sauvegarde restaurée'); go('#/jour');
        } catch (err) { toast('Restauration impossible : ' + err.message); }
      };
    }
  }
  function editMilestone(id) {
    const m = id ? S.milestones.find((x) => x.id === id) : { nom: '', debut_commandes: '', fin_commandes: '', debut_retrait: '', fin_retrait: '', capacite_jour: '', notes: '' };
    openModal(id ? 'Modifier le temps fort' : 'Ajouter un temps fort', `
      <label class="field"><span>Nom <span class="req">*</span></span><input type="text" id="m-nom" value="${esc(m.nom)}" placeholder="Ex. Pâques"></label>
      <div class="grid-2">
        <label class="field"><span>Ouverture des commandes</span><input type="date" id="m-dc" value="${esc(m.debut_commandes || '')}"></label>
        <label class="field"><span>Date limite de commande</span><input type="date" id="m-fc" value="${esc(m.fin_commandes || '')}"></label>
        <label class="field"><span>Premier jour de retrait <span class="req">*</span></span><input type="date" id="m-dr" value="${esc(m.debut_retrait || '')}"></label>
        <label class="field"><span>Dernier jour de retrait</span><input type="date" id="m-fr" value="${esc(m.fin_retrait || '')}"></label>
      </div>
      <label class="field"><span>Gâteaux max par jour pendant le retrait</span><input type="number" min="1" id="m-cap" value="${esc(m.capacite_jour || '')}"></label>
      <label class="field"><span>Notes</span><textarea id="m-notes">${esc(m.notes || '')}</textarea></label>`,
      `${id ? `<button class="btn btn-danger" data-x="del" style="margin-right:auto">Supprimer</button>` : ''}
       <button class="btn" data-x="cancel">Retour</button><button class="btn btn-dark" data-x="ok">Enregistrer</button>`,
      (box) => {
        box.querySelector('[data-x="cancel"]').onclick = closeModal;
        const del = box.querySelector('[data-x="del"]');
        if (del) del.onclick = async () => {
          closeModal();
          if (!(await confirmDialog('Supprimer ce temps fort ?', `${esc(m.nom)} ne sera plus pris en compte dans la capacité.`, 'Supprimer', true))) return;
          await guard(async () => { await store.remove('milestones', id); S.milestones = S.milestones.filter((x) => x.id !== id); toast('Temps fort supprimé'); router(); });
        };
        box.querySelector('[data-x="ok"]').onclick = async () => {
          const nom = $('#m-nom', box).value.trim(); const dr = $('#m-dr', box).value;
          if (!nom || !dr) { toast('Indique le nom et le premier jour de retrait'); return; }
          const fr = $('#m-fr', box).value || dr; const dc = $('#m-dc', box).value || null; const fc = $('#m-fc', box).value || null;
          if (fr < dr || (dc && fc && fc < dc)) { toast('Une date de fin est avant sa date de début'); return; }
          const row = { nom, debut_commandes: dc, fin_commandes: fc, debut_retrait: dr, fin_retrait: fr,
            capacite_jour: $('#m-cap', box).value ? Math.round(num($('#m-cap', box).value)) : null, notes: $('#m-notes', box).value.trim() };
          if (id) row.id = id;
          const saved = await guard(() => store.upsert('milestones', row), 'Temps fort non enregistré');
          if (!saved) return;
          const i = S.milestones.findIndex((x) => x.id === saved.id);
          if (i >= 0) S.milestones[i] = saved; else S.milestones.push(saved);
          closeModal(); toast('Temps fort enregistré'); router();
        };
      });
  }

  /* ------------------------------------------------------------------
     Connexion (mode en ligne) et démarrage
     ------------------------------------------------------------------ */
  // Traduction des messages d'erreur courants de Supabase Auth
  function authError(err) {
    const m = String((err && err.message) || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (m.includes('rate limit') || m.includes('only request this')) return 'Trop de demandes. Patiente quelques minutes (les emails sont limités à 2 par heure) ou connecte-toi avec ton mot de passe.';
    if (m.includes('email not confirmed')) return 'Ce compte n’est pas encore confirmé dans Supabase.';
    if (m.includes('signups not allowed') || m.includes('user not found')) return 'Cette adresse n’a pas de compte.';
    if (m.includes('should be different')) return 'Le nouveau mot de passe doit être différent de l’ancien.';
    if (m.includes('password')) return 'Mot de passe refusé : ' + err.message;
    return (err && err.message) || 'Erreur inconnue.';
  }

  function showLogin(message, mode) {
    $('#boot').hidden = true; $('#app').hidden = true;
    const box = $('#login'); box.hidden = false;
    const withPassword = mode !== 'lien';
    box.innerHTML = `
      <form class="login-card" id="login-form" novalidate>
        <img src="${esc(LOGO_SRC)}" alt="L'Atelier des Rêves">
        <h1>Commandes</h1>
        <p>${message ? esc(message) : (withPassword ? 'Connecte-toi avec ton email et ton mot de passe.' : 'Indique ton adresse email : tu recevras un lien pour te connecter.')}</p>
        <div class="segmented" role="group" aria-label="Mode de connexion" style="justify-self:center">
          <button type="button" data-mode="mdp" aria-pressed="${withPassword}">Mot de passe</button>
          <button type="button" data-mode="lien" aria-pressed="${!withPassword}">Lien par email</button>
        </div>
        <label class="field" style="text-align:left"><span>Email</span><input type="email" id="login-email" name="email" autocomplete="username" required></label>
        ${withPassword ? `
        <label class="field" style="text-align:left"><span>Mot de passe</span>
          <span style="position:relative;display:block">
            <input type="password" id="login-pass" name="password" autocomplete="current-password" required style="padding-right:100px">
            <button type="button" class="btn btn-sm btn-ghost pass-toggle" id="toggle-pass" aria-label="Afficher le mot de passe">Afficher</button>
          </span>
        </label>
        <button class="btn btn-dark" type="submit">Se connecter</button>` : `
        <button class="btn btn-dark" type="submit">Recevoir le lien de connexion</button>
        <p class="small muted" style="margin:0">Ouvre le lien dans ce même navigateur, sur cet appareil.</p>`}
        <p class="small" id="login-msg" role="status" style="min-height:1.4em"></p>
      </form>`;
    $$('[data-mode]', box).forEach((b) => b.onclick = () => {
      const email = $('#login-email').value;
      showLogin('', b.dataset.mode);
      $('#login-email').value = email;
    });
    const toggle = $('#toggle-pass');
    if (toggle) toggle.onclick = () => {
      const inp = $('#login-pass'); const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password'; toggle.textContent = show ? 'Masquer' : 'Afficher';
    };
    let busy = false;
    $('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      const email = $('#login-email').value.trim().toLowerCase();
      const msg = $('#login-msg');
      if (!email) { msg.textContent = 'Indique ton adresse email.'; $('#login-email').focus(); return; }
      busy = true;
      try {
        if (withPassword) {
          const pass = $('#login-pass').value;
          if (!pass) { msg.textContent = 'Indique ton mot de passe.'; $('#login-pass').focus(); return; }
          msg.textContent = 'Connexion en cours…';
          await store.signInPassword(email, pass);
          location.reload();
        } else {
          msg.textContent = 'Envoi en cours…';
          await store.sendLink(email);
          msg.textContent = 'Lien envoyé. Ouvre l’email sur cet appareil, dans ce navigateur.';
        }
      } catch (err) {
        msg.textContent = authError(err);
      } finally { busy = false; }
    };
    $('#login-email').focus();
  }

  async function loadData() {
    const d = await store.loadAll();
    Object.assign(S, { products: d.products || [], customers: d.customers || [], orders: d.orders || [], items: d.items || [], milestones: d.milestones || [], settings: mergeSettings(d.settings) });
    S.orders.forEach((o) => { ['total_ht', 'total_tva', 'total_ttc'].forEach((k) => { o[k] = Number(o[k]) || 0; }); });
    S.items.forEach((i) => { ['prix_unitaire_ht', 'prix_unitaire_ttc', 'tva', 'total_ht', 'total_ttc', 'quantite'].forEach((k) => { i[k] = Number(i[k]) || 0; }); });
    S.products.forEach((p) => { p.tva = Number(p.tva); if (p.prix_ttc != null) p.prix_ttc = Number(p.prix_ttc); if (p.prix_ht_pro != null) p.prix_ht_pro = Number(p.prix_ht_pro); });
  }

  async function start() {
    try {
      const { user } = await store.init();
      if (!user) { showLogin(); return; }
      S.user = user;
      await loadData();
    } catch (e) {
      console.error(e);
      if (e && e.code === 'not_admin') { if (store.signOut) await store.signOut(); showLogin('Ce compte n’est pas autorisé. Vérifie l’adresse ou demande à l’ajouter.'); return; }
      $('#boot').hidden = true;
      document.body.insertAdjacentHTML('beforeend', `<div class="login"><div class="login-card"><img src="${esc(LOGO_SRC)}" alt=""><h1>Connexion impossible</h1><p>${esc(e.message || 'Erreur inconnue')}</p><button class="btn btn-dark" onclick="location.reload()">Réessayer</button></div></div>`);
      return;
    }
    $('#boot').hidden = true; $('#login').hidden = true; $('#app').hidden = false;
    if (!location.hash) history.replaceState(null, '', '#/jour');
    router();
  }
  start();
})();