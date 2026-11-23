-- =====================================================================
--  Planification des rappels « 2 jours avant le retrait »
--  NE PAS EXÉCUTER avant :
--   1. l'envoi d'emails configuré (secrets BREVO_API_KEY et EMAIL_FROM,
--      ou « Email d'expédition » rempli dans les Réglages de l'appli) ;
--   2. la création d'un secret CRON_SECRET (une longue valeur aléatoire)
--      dans Supabase > Edge Functions > Secrets ;
--   3. la validation d'un exemple de rappel.
--  Ensuite, l'activation se fait depuis l'appli (Réglages > Emails >
--  « Envoyer les rappels automatiquement »).
-- =====================================================================

-- 1. Extensions nécessaires (Supabase > Database > Extensions, ou ici)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Le même secret que CRON_SECRET, rangé dans le coffre (Vault) de la base.
--    Remplacer COLLER_ICI_LA_MEME_VALEUR_QUE_CRON_SECRET, exécuter une fois,
--    puis effacer la valeur de l'éditeur.
-- select vault.create_secret('COLLER_ICI_LA_MEME_VALEUR_QUE_CRON_SECRET', 'cron_secret');

-- 3. Appel de la fonction chaque heure, à h 35 ; c'est la fonction qui
--    décide d'envoyer, à partir de l'heure réglée (11 h 30 par défaut,
--    heure de Paris). Premier envoi possible : 11 h 35.
select cron.schedule(
  'rappels-commandes',
  '35 * * * *',
  $$
  select net.http_post(
    url := 'https://nbxfjxfbefzaonrbhitj.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Pour vérifier :   select * from cron.job;
-- Historique :      select * from cron.job_run_details order by start_time desc limit 20;
-- Pour arrêter :    select cron.unschedule('rappels-commandes');
