-- Aetheris Pointage — socle multi-entreprise sécurisé
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create schema if not exists private;
revoke all on schema private from public, anon;

create type public.app_role as enum (
  'admin',
  'direction',
  'bureau',
  'conducteur',
  'chef_equipe',
  'ouvrier'
);

create type public.chantier_status as enum (
  'a_planifier',
  'planifie',
  'en_cours',
  'suspendu',
  'termine',
  'archive'
);

create type public.affectation_status as enum (
  'planifiee',
  'confirmee',
  'absente',
  'annulee'
);

create type public.pointage_action as enum (
  'debut_activite',
  'faconnage',
  'pause',
  'fin_activite',
  'consigne',
  'reunion',
  'enlevement_materiaux',
  'carburant',
  'panne_vehicule',
  'enlevement_fournisseur',
  'grutage',
  'approvisionnement'
);

create type public.document_type as enum (
  'devis',
  'plan',
  'photo',
  'bon_livraison',
  'consigne',
  'rapport',
  'autre'
);

create type public.logistique_type as enum (
  'grutage',
  'livraison',
  'approvisionnement',
  'enlevement'
);

create type public.logistique_status as enum (
  'brouillon',
  'planifiee',
  'confirmee',
  'en_route',
  'livree',
  'annulee'
);

create type public.alerte_type as enum (
  'pointage_manquant',
  'fin_activite_manquante',
  'retard',
  'logistique',
  'document'
);

create table public.entreprises (
  id uuid primary key default extensions.gen_random_uuid(),
  nom text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Paris',
  heure_alerte_pointage time not null default '17:30',
  logo_url text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profils (
  id uuid primary key references auth.users(id) on delete cascade,
  entreprise_id uuid references public.entreprises(id) on delete restrict,
  role public.app_role not null default 'ouvrier',
  nom_complet text not null default '',
  initiales text not null default '',
  telephone text,
  actif boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compagnons (
  id uuid primary key default extensions.gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  profil_id uuid unique references public.profils(id) on delete set null,
  nom_complet text not null,
  initiales text not null,
  telephone text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entreprise_id, nom_complet)
);

create table public.chantiers (
  id uuid primary key default extensions.gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  reference text not null,
  nom text not null,
  client_nom text,
  adresse text not null,
  code_postal text,
  ville text not null,
  conducteur_id uuid references public.profils(id) on delete set null,
  statut public.chantier_status not null default 'a_planifier',
  date_debut date,
  date_fin_prevue date,
  consignes text,
  meteo_url text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entreprise_id, reference)
);

create table public.vehicules (
  id uuid primary key default extensions.gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  libelle text not null,
  immatriculation text,
  type_vehicule text,
  capacite text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entreprise_id, immatriculation)
);

create table public.affectations (
  id uuid primary key default extensions.gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  compagnon_id uuid not null references public.compagnons(id) on delete cascade,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  jour date not null,
  heure_debut_prevue time not null default '07:30',
  heure_fin_prevue time not null default '17:00',
  inclus_pointage boolean not null default true,
  statut public.affectation_status not null default 'planifiee',
  note text,
  cree_par uuid references public.profils(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (compagnon_id, jour)
);

create table public.pointages (
  id uuid primary key default extensions.gen_random_uuid(),
  client_uuid uuid not null unique,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  compagnon_id uuid not null references public.compagnons(id) on delete cascade,
  affectation_id uuid references public.affectations(id) on delete set null,
  action public.pointage_action not null,
  pointe_a timestamptz not null,
  jour_travail date not null,
  note text,
  source text not null default 'web',
  cree_par uuid not null references public.profils(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.documents_chantier (
  id uuid primary key default extensions.gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  type_document public.document_type not null default 'autre',
  nom_fichier text not null,
  storage_path text not null unique,
  mime_type text,
  taille_octets bigint check (taille_octets is null or taille_octets >= 0),
  visible_terrain boolean not null default true,
  ajoute_par uuid not null references public.profils(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.operations_logistiques (
  id uuid primary key default extensions.gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  type_operation public.logistique_type not null,
  statut public.logistique_status not null default 'brouillon',
  debut_prevu timestamptz not null,
  fin_prevue timestamptz,
  fournisseur text,
  chauffeur_nom text,
  chauffeur_telephone text,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  camion_externe text,
  capacite text,
  chargement jsonb not null default '[]'::jsonb,
  note text,
  cree_par uuid not null references public.profils(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(chargement) = 'array')
);

create table public.alertes (
  id uuid primary key default extensions.gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete cascade,
  affectation_id uuid references public.affectations(id) on delete cascade,
  compagnon_id uuid references public.compagnons(id) on delete cascade,
  type_alerte public.alerte_type not null,
  jour date not null,
  severite smallint not null default 1 check (severite between 1 and 3),
  message text not null,
  resolue boolean not null default false,
  resolue_par uuid references public.profils(id) on delete set null,
  resolue_a timestamptz,
  created_at timestamptz not null default now()
);

create unique index alertes_pointage_unique
  on public.alertes (affectation_id, type_alerte, jour)
  where affectation_id is not null;

create index profils_entreprise_idx on public.profils (entreprise_id);
create index compagnons_entreprise_idx on public.compagnons (entreprise_id, actif);
create index chantiers_conducteur_idx on public.chantiers (entreprise_id, conducteur_id, statut);
create index affectations_jour_idx on public.affectations (entreprise_id, jour, chantier_id);
create index affectations_compagnon_idx on public.affectations (compagnon_id, jour);
create index pointages_direct_idx on public.pointages (entreprise_id, jour_travail, pointe_a desc);
create index pointages_compagnon_idx on public.pointages (compagnon_id, jour_travail, pointe_a);
create index documents_chantier_idx on public.documents_chantier (chantier_id, created_at desc);
create index logistique_planning_idx on public.operations_logistiques (entreprise_id, debut_prevu, chantier_id);
create index alertes_ouvertes_idx on public.alertes (entreprise_id, resolue, jour desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entreprises_updated_at before update on public.entreprises
for each row execute function private.set_updated_at();
create trigger profils_updated_at before update on public.profils
for each row execute function private.set_updated_at();
create trigger compagnons_updated_at before update on public.compagnons
for each row execute function private.set_updated_at();
create trigger chantiers_updated_at before update on public.chantiers
for each row execute function private.set_updated_at();
create trigger vehicules_updated_at before update on public.vehicules
for each row execute function private.set_updated_at();
create trigger affectations_updated_at before update on public.affectations
for each row execute function private.set_updated_at();
create trigger operations_logistiques_updated_at before update on public.operations_logistiques
for each row execute function private.set_updated_at();

create or replace function private.creer_profil_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (id, nom_complet, initiales, actif)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom_complet', split_part(new.email, '@', 1), ''),
    upper(left(coalesce(new.raw_user_meta_data ->> 'nom_complet', split_part(new.email, '@', 1), ''), 2)),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_created
after insert on auth.users
for each row execute function private.creer_profil_auth();

create or replace function private.current_entreprise_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select entreprise_id
  from public.profils
  where id = auth.uid() and actif = true
$$;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profils
  where id = auth.uid() and actif = true
$$;

create or replace function private.current_business_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (
    now() at time zone coalesce(
      (
        select e.timezone
        from public.entreprises e
        where e.id = private.current_entreprise_id()
      ),
      'Europe/Paris'
    )
  )::date
$$;

create or replace function private.is_management()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('admin', 'direction', 'bureau', 'conducteur'), false)
$$;

create or replace function private.can_access_chantier(p_chantier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chantiers c
    where c.id = p_chantier_id
      and c.entreprise_id = private.current_entreprise_id()
      and (
        private.current_app_role() in ('admin', 'direction', 'bureau')
        or (private.current_app_role() = 'conducteur' and c.conducteur_id = auth.uid())
        or exists (
          select 1
          from public.affectations a
          join public.compagnons co on co.id = a.compagnon_id
          where a.chantier_id = c.id
            and co.profil_id = auth.uid()
            and a.jour between (private.current_business_date() - 1) and (private.current_business_date() + 7)
            and a.statut <> 'annulee'
        )
      )
  )
$$;

create or replace function private.can_access_document_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entreprise uuid;
  v_chantier uuid;
begin
  v_entreprise := split_part(p_name, '/', 1)::uuid;
  v_chantier := split_part(p_name, '/', 2)::uuid;
  return v_entreprise = private.current_entreprise_id()
    and private.can_access_chantier(v_chantier);
exception when others then
  return false;
end;
$$;

revoke all on function private.current_entreprise_id() from public;
revoke all on function private.current_app_role() from public;
revoke all on function private.current_business_date() from public;
revoke all on function private.is_management() from public;
revoke all on function private.can_access_chantier(uuid) from public;
revoke all on function private.can_access_document_path(text) from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;
grant execute on function private.current_entreprise_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.current_business_date() to authenticated;
grant execute on function private.is_management() to authenticated;
grant execute on function private.can_access_chantier(uuid) to authenticated;
grant execute on function private.can_access_document_path(text) to authenticated;

alter table public.entreprises enable row level security;
alter table public.profils enable row level security;
alter table public.compagnons enable row level security;
alter table public.chantiers enable row level security;
alter table public.vehicules enable row level security;
alter table public.affectations enable row level security;
alter table public.pointages enable row level security;
alter table public.documents_chantier enable row level security;
alter table public.operations_logistiques enable row level security;
alter table public.alertes enable row level security;

create policy entreprises_select on public.entreprises
for select to authenticated
using (id = private.current_entreprise_id());

create policy entreprises_update on public.entreprises
for update to authenticated
using (id = private.current_entreprise_id() and private.current_app_role() in ('admin', 'direction'))
with check (id = private.current_entreprise_id());

create policy profils_select on public.profils
for select to authenticated
using (
  id = auth.uid()
  or (
    entreprise_id = private.current_entreprise_id()
    and private.current_app_role() in ('admin', 'direction', 'bureau', 'conducteur')
  )
);

create policy profils_manage on public.profils
for all to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and private.current_app_role() in ('admin', 'direction')
)
with check (
  entreprise_id = private.current_entreprise_id()
  and private.current_app_role() in ('admin', 'direction')
);

create policy compagnons_select on public.compagnons
for select to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and (
    private.is_management()
    or private.current_app_role() = 'chef_equipe'
    or profil_id = auth.uid()
    or exists (
      select 1
      from public.affectations a
      where a.compagnon_id = compagnons.id
        and private.can_access_chantier(a.chantier_id)
        and a.jour between (private.current_business_date() - 1) and (private.current_business_date() + 7)
    )
  )
);

create policy compagnons_manage on public.compagnons
for all to authenticated
using (entreprise_id = private.current_entreprise_id() and private.is_management())
with check (entreprise_id = private.current_entreprise_id() and private.is_management());

create policy chantiers_select on public.chantiers
for select to authenticated
using (private.can_access_chantier(id));

create policy chantiers_manage on public.chantiers
for all to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and (
    private.current_app_role() in ('admin', 'direction', 'bureau')
    or (private.current_app_role() = 'conducteur' and conducteur_id = auth.uid())
  )
)
with check (
  entreprise_id = private.current_entreprise_id()
  and (
    private.current_app_role() in ('admin', 'direction', 'bureau')
    or (private.current_app_role() = 'conducteur' and conducteur_id = auth.uid())
  )
);

create policy vehicules_select on public.vehicules
for select to authenticated
using (entreprise_id = private.current_entreprise_id());

create policy vehicules_manage on public.vehicules
for all to authenticated
using (entreprise_id = private.current_entreprise_id() and private.is_management())
with check (entreprise_id = private.current_entreprise_id() and private.is_management());

create policy affectations_select on public.affectations
for select to authenticated
using (entreprise_id = private.current_entreprise_id() and private.can_access_chantier(chantier_id));

create policy affectations_management on public.affectations
for all to authenticated
using (entreprise_id = private.current_entreprise_id() and private.is_management() and private.can_access_chantier(chantier_id))
with check (entreprise_id = private.current_entreprise_id() and private.is_management() and private.can_access_chantier(chantier_id));

create policy affectations_chef_insert on public.affectations
for insert to authenticated
with check (
  entreprise_id = private.current_entreprise_id()
  and private.current_app_role() = 'chef_equipe'
  and jour = private.current_business_date()
  and private.can_access_chantier(chantier_id)
);

create policy affectations_chef_update on public.affectations
for update to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and private.current_app_role() = 'chef_equipe'
  and jour = private.current_business_date()
  and private.can_access_chantier(chantier_id)
)
with check (
  entreprise_id = private.current_entreprise_id()
  and private.current_app_role() = 'chef_equipe'
  and jour = private.current_business_date()
  and private.can_access_chantier(chantier_id)
);

create policy affectations_chef_delete on public.affectations
for delete to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and private.current_app_role() = 'chef_equipe'
  and jour = private.current_business_date()
  and private.can_access_chantier(chantier_id)
);

create policy pointages_select on public.pointages
for select to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and (
    private.can_access_chantier(chantier_id)
    or exists (
      select 1 from public.compagnons c
      where c.id = pointages.compagnon_id and c.profil_id = auth.uid()
    )
  )
);

create policy documents_select on public.documents_chantier
for select to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and private.can_access_chantier(chantier_id)
);

create policy documents_manage on public.documents_chantier
for all to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and private.is_management()
  and private.can_access_chantier(chantier_id)
)
with check (
  entreprise_id = private.current_entreprise_id()
  and private.is_management()
  and private.can_access_chantier(chantier_id)
);

create policy logistique_select on public.operations_logistiques
for select to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and private.can_access_chantier(chantier_id)
);

create policy logistique_manage on public.operations_logistiques
for all to authenticated
using (
  entreprise_id = private.current_entreprise_id()
  and private.is_management()
  and private.can_access_chantier(chantier_id)
)
with check (
  entreprise_id = private.current_entreprise_id()
  and private.is_management()
  and private.can_access_chantier(chantier_id)
);

create policy alertes_select on public.alertes
for select to authenticated
using (entreprise_id = private.current_entreprise_id() and private.is_management());

create policy alertes_update on public.alertes
for update to authenticated
using (entreprise_id = private.current_entreprise_id() and private.is_management())
with check (entreprise_id = private.current_entreprise_id() and private.is_management());

create or replace function public.enregistrer_pointage(
  p_client_uuid uuid,
  p_compagnon_id uuid,
  p_chantier_id uuid,
  p_action public.pointage_action,
  p_pointe_a timestamptz default now(),
  p_note text default null,
  p_source text default 'web'
)
returns public.pointages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entreprise uuid;
  v_role public.app_role;
  v_timezone text;
  v_jour date;
  v_affectation public.affectations;
  v_result public.pointages;
begin
  v_entreprise := private.current_entreprise_id();
  v_role := private.current_app_role();

  if v_entreprise is null or v_role is null then
    raise exception 'Profil inactif ou entreprise absente';
  end if;

  select e.timezone into v_timezone
  from public.entreprises e
  where e.id = v_entreprise;

  v_jour := (p_pointe_a at time zone coalesce(v_timezone, 'Europe/Paris'))::date;

  if not exists (
    select 1 from public.chantiers c
    where c.id = p_chantier_id and c.entreprise_id = v_entreprise
  ) then
    raise exception 'Chantier inaccessible';
  end if;

  if not exists (
    select 1 from public.compagnons c
    where c.id = p_compagnon_id and c.entreprise_id = v_entreprise and c.actif
  ) then
    raise exception 'Compagnon inaccessible';
  end if;

  select a.* into v_affectation
  from public.affectations a
  where a.chantier_id = p_chantier_id
    and a.compagnon_id = p_compagnon_id
    and a.jour = v_jour
    and a.statut <> 'annulee'
  limit 1;

  if v_role in ('admin', 'direction', 'bureau', 'conducteur') then
    if not private.can_access_chantier(p_chantier_id) then
      raise exception 'Accès refusé à ce chantier';
    end if;
  elsif v_role = 'chef_equipe' then
    if not private.can_access_chantier(p_chantier_id) or v_affectation.id is null then
      raise exception 'Le compagnon ne fait pas partie de l’équipe du jour';
    end if;
  elsif v_role = 'ouvrier' then
    if not exists (
      select 1 from public.compagnons c
      where c.id = p_compagnon_id and c.profil_id = auth.uid()
    ) then
      raise exception 'Un ouvrier ne peut pointer que pour lui-même';
    end if;
  else
    raise exception 'Rôle non autorisé';
  end if;

  insert into public.pointages (
    client_uuid,
    entreprise_id,
    chantier_id,
    compagnon_id,
    affectation_id,
    action,
    pointe_a,
    jour_travail,
    note,
    source,
    cree_par
  )
  values (
    p_client_uuid,
    v_entreprise,
    p_chantier_id,
    p_compagnon_id,
    v_affectation.id,
    p_action,
    p_pointe_a,
    v_jour,
    nullif(trim(p_note), ''),
    coalesce(nullif(trim(p_source), ''), 'web'),
    auth.uid()
  )
  on conflict (client_uuid) do update
  set client_uuid = excluded.client_uuid
  returning * into v_result;

  if p_action in ('debut_activite', 'fin_activite') and v_affectation.id is not null then
    update public.alertes
    set resolue = true, resolue_par = auth.uid(), resolue_a = now()
    where affectation_id = v_affectation.id
      and type_alerte in ('pointage_manquant', 'fin_activite_manquante')
      and resolue = false;
  end if;

  return v_result;
end;
$$;

revoke all on function public.enregistrer_pointage(uuid, uuid, uuid, public.pointage_action, timestamptz, text, text) from public;
grant execute on function public.enregistrer_pointage(uuid, uuid, uuid, public.pointage_action, timestamptz, text, text) to authenticated;

create or replace function public.minutes_travaillees(p_compagnon_id uuid, p_jour date)
returns integer
language sql
stable
set search_path = ''
as $$
  with evenements as (
    select
      p.action,
      p.pointe_a,
      lead(p.pointe_a) over (order by p.pointe_a) as prochain
    from public.pointages p
    where p.compagnon_id = p_compagnon_id
      and p.jour_travail = p_jour
      and p.action in ('debut_activite', 'pause', 'fin_activite')
  )
  select coalesce(
    round(sum(
      case
        when action = 'debut_activite'
          then extract(epoch from (coalesce(prochain, now()) - pointe_a)) / 60
        else 0
      end
    ))::integer,
    0
  )
  from evenements
$$;

revoke all on function public.minutes_travaillees(uuid, date) from public;
grant execute on function public.minutes_travaillees(uuid, date) to authenticated;

create view public.rapports_heures_journaliers
with (security_invoker = true)
as
select
  a.id as affectation_id,
  a.entreprise_id,
  a.jour,
  a.chantier_id,
  ch.reference as chantier_reference,
  ch.nom as chantier_nom,
  a.compagnon_id,
  co.nom_complet as compagnon_nom,
  min(p.pointe_a) filter (where p.action = 'debut_activite') as premier_pointage,
  max(p.pointe_a) filter (where p.action = 'fin_activite') as dernier_pointage,
  public.minutes_travaillees(a.compagnon_id, a.jour) as minutes_travaillees,
  count(p.id)::integer as nombre_pointages,
  bool_or(p.action = 'fin_activite') as journee_terminee
from public.affectations a
join public.chantiers ch on ch.id = a.chantier_id
join public.compagnons co on co.id = a.compagnon_id
left join public.pointages p
  on p.affectation_id = a.id and p.jour_travail = a.jour
where a.statut <> 'annulee'
group by a.id, ch.reference, ch.nom, co.nom_complet;

grant select on public.rapports_heures_journaliers to authenticated;

create or replace function private.generer_alertes_pointage_manquant()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  insert into public.alertes (
    entreprise_id,
    chantier_id,
    affectation_id,
    compagnon_id,
    type_alerte,
    jour,
    severite,
    message
  )
  select
    a.entreprise_id,
    a.chantier_id,
    a.id,
    a.compagnon_id,
    case
      when not exists (
        select 1 from public.pointages p
        where p.affectation_id = a.id and p.action = 'debut_activite'
      ) then 'pointage_manquant'::public.alerte_type
      else 'fin_activite_manquante'::public.alerte_type
    end,
    a.jour,
    2,
    case
      when not exists (
        select 1 from public.pointages p
        where p.affectation_id = a.id and p.action = 'debut_activite'
      ) then co.nom_complet || ' n''a aucun début d''activité'
      else co.nom_complet || ' n''a pas pointé sa fin d''activité'
    end
  from public.affectations a
  join public.entreprises e on e.id = a.entreprise_id
  join public.compagnons co on co.id = a.compagnon_id
  where a.statut in ('planifiee', 'confirmee')
    and a.inclus_pointage
    and a.jour = (now() at time zone e.timezone)::date
    and (now() at time zone e.timezone)::time >= e.heure_alerte_pointage
    and (
      not exists (
        select 1 from public.pointages p
        where p.affectation_id = a.id and p.action = 'debut_activite'
      )
      or not exists (
        select 1 from public.pointages p
        where p.affectation_id = a.id and p.action = 'fin_activite'
      )
    )
  on conflict (affectation_id, type_alerte, jour)
    where affectation_id is not null
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.generer_alertes_pointage_manquant() from public, anon, authenticated;
grant execute on function private.generer_alertes_pointage_manquant() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'aetheris-alertes-pointage';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'aetheris-alertes-pointage',
    '*/15 * * * *',
    'select private.generer_alertes_pointage_manquant();'
  );
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chantier-documents',
  'chantier-documents',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy chantier_documents_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'chantier-documents'
  and private.can_access_document_path(name)
);

create policy chantier_documents_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chantier-documents'
  and private.is_management()
  and private.can_access_document_path(name)
);

create policy chantier_documents_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'chantier-documents'
  and private.is_management()
  and private.can_access_document_path(name)
)
with check (
  bucket_id = 'chantier-documents'
  and private.is_management()
  and private.can_access_document_path(name)
);

create policy chantier_documents_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'chantier-documents'
  and private.is_management()
  and private.can_access_document_path(name)
);

alter publication supabase_realtime add table public.affectations;
alter publication supabase_realtime add table public.pointages;
alter publication supabase_realtime add table public.alertes;
alter publication supabase_realtime add table public.operations_logistiques;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
