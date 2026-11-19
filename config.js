// =====================================================================
//  Configuration de l'appli
//  MODE "demo"     : données d'exemple stockées dans ce navigateur uniquement.
//  MODE "supabase" : données réelles, partagées entre tous les appareils.
//  La clé ci-dessous est la clé PUBLIQUE (sb_publishable_...) : elle peut
//  être visible, la sécurité repose sur les règles RLS de supabase/schema.sql.
//  Ne mets JAMAIS ici une clé sb_secret_... ou service_role.
// =====================================================================
window.APP_CONFIG = {
  MODE: 'supabase',
  SUPABASE_URL: 'https://nbxfjxfbefzaonrbhitj.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_P5Ky6NQ7SZhREJZw5TeBMw_zL497N_o',
  NOM_BOUTIQUE: "L'Atelier des Rêves"
};