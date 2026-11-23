-- =====================================================================
--  Migration du 23/11/2026 : durcissement de la sécurité
--  Suite au contrôle de sécurité de Supabase (Security Advisor) :
--  1. is_admin() déplacée dans un schéma « private » non exposé à l'API
--     (elle n'est plus appelable via /rest/v1/rpc/is_admin) ;
--  2. aucun droit d'exécution pour les visiteurs non connectés (anon) ;
--  3. search_path fixé sur les fonctions.
--  Les règles d'accès restent identiques : seules les adresses de
--  public.app_admins lisent et écrivent les données.
--  Aucune donnée n'est lue ni modifiée.
-- =====================================================================

-- 1. Schéma privé, non exposé par l'API Supabase
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- 2. Les règles de sécurité utilisent la nouvelle fonction
do $$
declare t text;
begin
  foreach t in array array['products','customers','orders','order_items','milestones','settings'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;

-- 3. save_order : même logique, contrôle via private.is_admin()
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
      total_ht, total_tva, total_ttc, paye, moyen_paiement, paye_le)
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
      nullif(p_order ->> 'paye_le', '')::timestamptz)
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
      paye_le        = nullif(p_order ->> 'paye_le', '')::timestamptz
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

-- 4. L'ancienne fonction publique n'est plus utilisée
drop function if exists public.is_admin();

-- 5. search_path fixé sur la fonction de date de mise à jour
alter function public.touch_updated_at() set search_path = '';
