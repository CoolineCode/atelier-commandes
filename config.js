// =====================================================================
//  Configuration de l'appli
//  MODE "demo"     : données d'exemple stockées dans ce navigateur uniquement.
//  MODE "supabase" : données réelles, partagées entre tous les appareils.
//  La clé "anon" est publique par conception : la sécurité repose sur les
//  règles RLS du fichier supabase/schema.sql. Ne mets JAMAIS ici la clé
//  "service_role".
// =====================================================================
window.APP_CONFIG = {
  MODE: 'demo',
  SUPABASE_URL: '',        // ex. 'https://abcdefgh.supabase.co'
  SUPABASE_ANON_KEY: '',   // Supabase > Project Settings > API > anon public
  NOM_BOUTIQUE: "L'Atelier des Rêves"
};
