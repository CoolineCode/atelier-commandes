-- =====================================================================
--  Migration du 23/11/2026 (2) : acompte, lieu de retrait, suivi des emails
--  Uniquement des AJOUTS, compatibles avec la version actuelle de l'appli :
--  - commandes : acompte (montant, moyen, date), lieu de retrait,
--    dates d'envoi de la confirmation et du rappel ;
--  - table email_log : trace de chaque email envoyé (ou en erreur) ;
--  - save_order : accepte les nouveaux champs ; s'ils ne sont pas envoyés
--    (ancienne version de l'appli), les valeurs existantes sont conservées.
--  Aucune donnée existante n'est modifiée.
-- =====================================================================

-- 1. Nouvelles colonnes des commandes
alter table public.orders
  add column if not exists acompte_montant numeric(10,2) not null default 0,
  add column if not exists acompte_moyen text,
  add column if not exists acompte_le timestamptz,
  add column if not exists lieu_retrait text not null default 'boutique',
  add column if not exists confirmation_envoyee_le timestamptz,
  add column if not exists rappel_envoye_le timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_acompte_positif') then
    alter table public.orders add constraint orders_acompte_positif check (acompte_montant >= 0);
  end if;
end $$;

-- 2. Journal des emails
create table if not exists public.email_log (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders(id) on delete set null,
  type            text not null check (type in ('confirmation', 'rappel', 'test')),
  destinataire    text not null,
  statut          text not null check (statut in ('envoye', 'erreur')),
  fournisseur_id  text,
  erreur          text,
  created_at      timestamptz not null default now()
);
create index if not exists email_log_order_idx on public.email_log (order_id);
alter table public.email_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_log' and policyname = 'admin_all') then
    create policy admin_all on public.email_log for all to authenticated
      using (private.is_admin()) with check (private.is_admin());
  end if;
end $$;
revoke all on public.email_log from anon;
grant select, insert on public.email_log to authenticated;

-- 3. Enregistrement d'une commande avec les nouveaux champs
create or replace function public.save_order(p_order jsonb, p_items jsonb)
returns public.orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id    uuid := nullif(p_order ->> 'id', '')::uuid;
  v_row   public.orders;
  v_item  jsonb;
  v_pos   integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Accès refusé';
  end if;

  if v_id is null then
    insert into public.orders (
      customer_id, client_nom, client_tel, client_email, type, canal,
      date_retrait, creneau, statut, message_gateau, allergies, notes,
      total_ht, total_tva, total_ttc, paye, moyen_paiement, paye_le,
      acompte_montant, acompte_moyen, acompte_le, lieu_retrait)
    values (
      nullif(p_order ->> 'customer_id', '')::uuid,
      p_order ->> 'client_nom', p_order ->> 'client_tel', p_order ->> 'client_email',
      coalesce(p_order ->> 'type', 'particulier'), coalesce(p_order ->> 'canal', 'telephone'),
      (p_order ->> 'date_retrait')::date, p_order ->> 'creneau',
      coalesce(p_order ->> 'statut', 'recue'),
      p_order ->> 'message_gateau', p_order ->> 'allergies', p_order ->> 'notes',
      coalesce((p_order ->> 'total_ht')::numeric, 0),
      coalesce((p_order ->> 'total_tva')::numeric, 0),
      coalesce((p_order ->> 'total_ttc')::numeric, 0),
      coalesce((p_order ->> 'paye')::boolean, false),
      p_order ->> 'moyen_paiement',
      nullif(p_order ->> 'paye_le', '')::timestamptz,
      greatest(coalesce((p_order ->> 'acompte_montant')::numeric, 0), 0),
      p_order ->> 'acompte_moyen',
      nullif(p_order ->> 'acompte_le', '')::timestamptz,
      coalesce(nullif(p_order ->> 'lieu_retrait', ''), 'boutique'))
    returning * into v_row;
  else
    update public.orders set
      customer_id    = nullif(p_order ->> 'customer_id', '')::uuid,
      client_nom     = p_order ->> 'client_nom',
      client_tel     = p_order ->> 'client_tel',
      client_email   = p_order ->> 'client_email',
      type           = coalesce(p_order ->> 'type', 'particulier'),
      canal          = coalesce(p_order ->> 'canal', 'telephone'),
      date_retrait   = (p_order ->> 'date_retrait')::date,
      creneau        = p_order ->> 'creneau',
      statut         = coalesce(p_order ->> 'statut', statut),
      message_gateau = p_order ->> 'message_gateau',
      allergies      = p_order ->> 'allergies',
      notes          = p_order ->> 'notes',
      total_ht       = coalesce((p_order ->> 'total_ht')::numeric, 0),
      total_tva      = coalesce((p_order ->> 'total_tva')::numeric, 0),
      total_ttc      = coalesce((p_order ->> 'total_ttc')::numeric, 0),
      paye           = coalesce((p_order ->> 'paye')::boolean, paye),
      moyen_paiement = p_order ->> 'moyen_paiement',
      paye_le        = nullif(p_order ->> 'paye_le', '')::timestamptz,
      -- Champs ajoutés le 23/11/2026 : modifiés seulement s'ils sont envoyés
      acompte_montant = case when p_order ? 'acompte_montant'
                             then greatest(coalesce((p_order ->> 'acompte_montant')::numeric, 0), 0)
                             else acompte_montant end,
      acompte_moyen   = case when p_order ? 'acompte_moyen' then p_order ->> 'acompte_moyen' else acompte_moyen end,
      acompte_le      = case when p_order ? 'acompte_le' then nullif(p_order ->> 'acompte_le', '')::timestamptz else acompte_le end,
      lieu_retrait    = case when p_order ? 'lieu_retrait'
                             then coalesce(nullif(p_order ->> 'lieu_retrait', ''), 'boutique')
                             else lieu_retrait end
    where id = v_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Commande introuvable';
    end if;
    delete from public.order_items where order_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.order_items (
      order_id, product_id, libelle, format, quantite,
      prix_unitaire_ht, prix_unitaire_ttc, tva, total_ht, total_ttc, position)
    values (
      v_row.id,
      nullif(v_item ->> 'product_id', '')::uuid,
      v_item ->> 'libelle', v_item ->> 'format',
      (v_item ->> 'quantite')::integer,
      (v_item ->> 'prix_unitaire_ht')::numeric,
      (v_item ->> 'prix_unitaire_ttc')::numeric,
      (v_item ->> 'tva')::numeric,
      (v_item ->> 'total_ht')::numeric,
      (v_item ->> 'total_ttc')::numeric,
      v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_row;
end;
$$;
revoke execute on function public.save_order(jsonb, jsonb) from anon, public;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;
