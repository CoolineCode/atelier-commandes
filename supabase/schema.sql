-- =====================================================================
--  L'Atelier des Rêves — Appli de prise de commande
--  Schéma Supabase (PostgreSQL)
--  À coller dans Supabase > SQL Editor > New query, puis "Run".
--  Le script peut être relancé : il ne supprime aucune donnée.
-- =====================================================================

-- ---------- 1. Administratrices autorisées ---------------------------
-- Seules les adresses de cette table peuvent lire et écrire les données.
create table if not exists public.app_admins (
  email text primary key
);
alter table public.app_admins enable row level security;
-- Aucune policy : la table n'est lisible que depuis le tableau de bord Supabase.

-- Ajoute ici l'adresse email de connexion (à modifier) :
-- insert into public.app_admins (email) values ('ophelie@exemple.fr') on conflict do nothing;

-- Fonction de contrôle placée dans un schéma « private », non exposé par l'API
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

-- ---------- 2. Catalogue --------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  format        text,                       -- ex. "6 parts"
  categorie     text,                       -- ex. "Entremets"
  saison        text default 'Toute l''année',
  prix_ttc      numeric(10,2),              -- prix particulier TTC
  prix_ht_pro   numeric(10,2),              -- prix professionnel HT (optionnel)
  tva           numeric(5,4) not null default 0.055,
  delai_jours   integer not null default 2, -- délai minimum de commande
  allergenes    text,
  description   text,
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- 3. Clients ----------------------------------------------
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  telephone   text,
  email       text,
  type        text not null default 'particulier' check (type in ('particulier','pro')),
  societe     text,
  siret       text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists customers_nom_idx on public.customers (lower(nom));

-- ---------- 4. Commandes --------------------------------------------
create sequence if not exists public.order_number_seq;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  numero          text unique not null
                  default ('CMD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0')),
  customer_id     uuid references public.customers(id) on delete set null,
  client_nom      text not null,             -- copie au moment de la commande
  client_tel      text,
  client_email    text,
  type            text not null default 'particulier' check (type in ('particulier','pro')),
  canal           text not null default 'telephone',
  date_retrait    date not null,
  creneau         text,                      -- ex. "10:30"
  statut          text not null default 'recue'
                  check (statut in ('recue','preparation','prete','retiree','annulee')),
  message_gateau  text,
  allergies       text,
  notes           text,
  total_ht        numeric(10,2) not null default 0,
  total_tva       numeric(10,2) not null default 0,
  total_ttc       numeric(10,2) not null default 0,
  paye            boolean not null default false,
  moyen_paiement  text,
  paye_le         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_date_idx on public.orders (date_retrait);
create index if not exists orders_statut_idx on public.orders (statut);

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  product_id          uuid references public.products(id) on delete set null,
  libelle             text not null,         -- copie du nom du gâteau
  format              text,
  quantite            integer not null check (quantite > 0),
  prix_unitaire_ht    numeric(10,2) not null,
  prix_unitaire_ttc   numeric(10,2) not null,
  tva                 numeric(5,4) not null,
  total_ht            numeric(10,2) not null,
  total_ttc           numeric(10,2) not null,
  position            integer not null default 0
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------- 5. Temps forts (jalons) ---------------------------------
create table if not exists public.milestones (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null,
  debut_commandes  date,
  fin_commandes    date,
  debut_retrait    date,
  fin_retrait      date,
  capacite_jour    integer,                  -- remplace la capacité normale pendant le jalon
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---------- 6. Réglages (une seule ligne) ---------------------------
create table if not exists public.settings (
  id    integer primary key default 1 check (id = 1),
  data  jsonb not null default '{}'::jsonb
);
insert into public.settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ---------- 7. Mise à jour automatique de updated_at -----------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------- 8. Enregistrement atomique d'une commande ----------------
-- Crée ou met à jour la commande ET remplace ses lignes en une seule fois.
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

-- ---------- 9. Sécurité : Row Level Security ------------------------
do $$
declare t text;
begin
  foreach t in array array['products','customers','orders','order_items','milestones','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;

-- Droits de base pour l'utilisateur connecté (les règles RLS ci-dessus
-- filtrent ensuite : seules les adresses de app_admins voient les données).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.products, public.customers, public.orders,
      public.order_items, public.milestones, public.settings to authenticated;

-- Les visiteurs non connectés (rôle anon) n'ont accès à rien.
revoke all on public.products, public.customers, public.orders, public.order_items,
              public.milestones, public.settings, public.app_admins from anon;
revoke execute on function public.save_order(jsonb, jsonb) from anon, public;
grant execute on function public.save_order(jsonb, jsonb) to authenticated;
grant usage, select on sequence public.order_number_seq to authenticated;

-- Nettoyage pour une base créée avant le 23/11/2026 : ancienne fonction publique
drop function if exists public.is_admin();
