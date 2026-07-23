-- Aetheris Pointage — extension ciblée du backend Aetheris existant.
-- Cette migration ne recrée aucune table socle.

alter table if exists public.entreprises
  add column if not exists timezone text not null default 'Europe/Paris',
  add column if not exists heure_alerte_pointage time not null default '17:30';

alter table if exists public.profils
  add column if not exists identifiant_court text,
  add column if not exists telephone text;

alter table if exists public.compagnons
  add column if not exists actif boolean not null default true;

alter table if exists public.chantiers
  add column if not exists meteo_url text,
  add column if not exists consignes_terrain text;

alter table if exists public.documents
  add column if not exists categorie_metier text not null default 'autre',
  add column if not exists visible_terrain boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profils_identifiant_court_format'
      and conrelid = 'public.profils'::regclass
  ) then
    alter table public.profils
      add constraint profils_identifiant_court_format
      check (
        identifiant_court is null
        or identifiant_court ~ '^[a-z0-9][a-z0-9._-]{1,30}$'
      );
  end if;
end
$$;

create unique index if not exists profils_identifiant_court_unique
  on public.profils (lower(identifiant_court))
  where identifiant_court is not null;

create table if not exists public.profil_modules (
  profil_id uuid not null references public.profils(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  module text not null check (module in ('terrain', 'conducteur', 'rh')),
  cree_par uuid references public.profils(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profil_id, module)
);

create table if not exists public.vehicules (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  libelle text not null,
  immatriculation text,
  type_vehicule text,
  capacite text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_affectation_details (
  planning_entry_id uuid not null references public.planning_entries(id) on delete cascade,
  compagnon_id uuid not null references public.compagnons(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  inclus_pointage boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (planning_entry_id, compagnon_id)
);

create table if not exists public.operations_logistiques (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  type_operation text not null
    check (type_operation in ('livraison', 'grutage', 'approvisionnement', 'enlevement')),
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'planifiee', 'confirmee', 'en_cours', 'terminee', 'annulee')),
  debut_prevu timestamptz not null,
  fin_prevue timestamptz,
  fournisseur text,
  chauffeur_nom text,
  chauffeur_telephone text,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  camion_externe text,
  capacite text,
  chargement jsonb not null default '[]'::jsonb
    check (jsonb_typeof(chargement) = 'array'),
  note text,
  cree_par uuid references public.profils(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alertes_pointage (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete cascade,
  planning_entry_id uuid references public.planning_entries(id) on delete cascade,
  compagnon_id uuid references public.compagnons(id) on delete cascade,
  type_alerte text not null
    check (type_alerte in ('pointage_manquant', 'fin_activite_manquante')),
  jour date not null,
  severite smallint not null default 2 check (severite between 1 and 3),
  message text not null,
  resolue boolean not null default false,
  resolue_par uuid references public.profils(id) on delete set null,
  resolue_a timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profil_modules_entreprise_idx
  on public.profil_modules (entreprise_id, module);
create unique index if not exists vehicules_immatriculation_unique
  on public.vehicules (entreprise_id, lower(immatriculation))
  where immatriculation is not null and trim(immatriculation) <> '';
create index if not exists planning_affectation_details_entreprise_idx
  on public.planning_affectation_details (entreprise_id, compagnon_id);
create index if not exists operations_logistiques_planning_idx
  on public.operations_logistiques (entreprise_id, debut_prevu, chantier_id);
create unique index if not exists alertes_pointage_unique
  on public.alertes_pointage (planning_entry_id, compagnon_id, type_alerte, jour)
  where planning_entry_id is not null and compagnon_id is not null;

drop trigger if exists trg_vehicules_updated on public.vehicules;
create trigger trg_vehicules_updated
  before update on public.vehicules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_planning_affectation_details_updated
  on public.planning_affectation_details;
create trigger trg_planning_affectation_details_updated
  before update on public.planning_affectation_details
  for each row execute function public.set_updated_at();

drop trigger if exists trg_operations_logistiques_updated
  on public.operations_logistiques;
create trigger trg_operations_logistiques_updated
  before update on public.operations_logistiques
  for each row execute function public.set_updated_at();

create or replace function public.pointage_has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profil_modules pm
    join public.profils p
      on p.id = pm.profil_id
     and p.entreprise_id = pm.entreprise_id
    where pm.profil_id = auth.uid()
      and pm.module = p_module
      and p.actif
  )
$$;

create or replace function public.pointage_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.app_role() in ('admin', 'direction', 'bureau', 'conducteur')
    or public.pointage_has_module('conducteur'),
    false
  )
$$;

create or replace function public.get_pointage_user_context_v1()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'entreprise_id', p.entreprise_id,
    'role', p.role,
    'nom_complet', trim(concat_ws(' ', p.prenom, p.nom)),
    'initiales', upper(
      left(coalesce(nullif(p.prenom, ''), nullif(p.nom, ''), 'U'), 1)
      || left(coalesce(nullif(p.nom, ''), ''), 1)
    ),
    'telephone', p.telephone,
    'identifiant_court', p.identifiant_court,
    'actif', p.actif,
    'entreprise', jsonb_build_object(
      'nom', e.raison_sociale
    ),
    'modules', coalesce(
      (
        select jsonb_agg(pm.module order by pm.module)
        from public.profil_modules pm
        where pm.profil_id = p.id
      ),
      case
        when p.role in ('admin', 'direction', 'bureau', 'conducteur')
          then '["conducteur"]'::jsonb
        when p.role = 'rh'
          then '["rh"]'::jsonb
        else '["terrain"]'::jsonb
      end
    )
  )
  from public.profils p
  left join public.entreprises e on e.id = p.entreprise_id
  where p.id = auth.uid()
    and p.actif
    and p.entreprise_id is not null
$$;

create or replace function public.enregistrer_affectation_pointage_v1(
  p_chantier_id uuid,
  p_compagnon_id uuid,
  p_vehicule_id uuid,
  p_jour date,
  p_heure_debut time default '07:30',
  p_heure_fin time default '17:00'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entreprise uuid := public.app_entreprise_id();
  v_timezone text;
  v_planning_id uuid;
  v_existing record;
  v_chef_compagnon uuid := public.app_compagnon_id();
begin
  if v_entreprise is null then
    raise exception 'Profil actif requis';
  end if;

  if not exists (
    select 1 from public.chantiers c
    where c.id = p_chantier_id and c.entreprise_id = v_entreprise
  ) or not exists (
    select 1 from public.compagnons c
    where c.id = p_compagnon_id and c.entreprise_id = v_entreprise and c.actif
  ) then
    raise exception 'Chantier ou personne introuvable';
  end if;

  if not (
    public.pointage_can_manage()
    or (
      public.pointage_has_module('terrain')
      and v_chef_compagnon is not null
      and exists (
        select 1
        from public.planning_entries pe
        where pe.entreprise_id = v_entreprise
          and pe.chantier_id = p_chantier_id
          and v_chef_compagnon = any(pe.compagnon_ids)
          and (pe.date_debut at time zone coalesce(
            (select timezone from public.entreprises where id = v_entreprise),
            'Europe/Paris'
          ))::date = p_jour
      )
    )
  ) then
    raise exception 'Vous ne pouvez pas modifier cette équipe';
  end if;

  select coalesce(e.timezone, 'Europe/Paris')
    into v_timezone
  from public.entreprises e
  where e.id = v_entreprise;

  for v_existing in
    select pe.id
    from public.planning_entries pe
    where pe.entreprise_id = v_entreprise
      and p_compagnon_id = any(pe.compagnon_ids)
      and (pe.date_debut at time zone v_timezone)::date = p_jour
  loop
    update public.planning_entries
      set compagnon_ids = array_remove(compagnon_ids, p_compagnon_id),
          updated_by = auth.uid()
      where id = v_existing.id;
    delete from public.planning_affectation_details
      where planning_entry_id = v_existing.id
        and compagnon_id = p_compagnon_id;
    delete from public.planning_entries
      where id = v_existing.id and cardinality(compagnon_ids) = 0;
  end loop;

  select pe.id into v_planning_id
  from public.planning_entries pe
  where pe.entreprise_id = v_entreprise
    and pe.chantier_id = p_chantier_id
    and (pe.date_debut at time zone v_timezone)::date = p_jour
  order by pe.date_debut
  limit 1
  for update;

  if v_planning_id is null then
    insert into public.planning_entries (
      entreprise_id,
      chantier_id,
      date_debut,
      date_fin,
      compagnon_ids,
      created_by,
      updated_by
    ) values (
      v_entreprise,
      p_chantier_id,
      (p_jour + p_heure_debut) at time zone v_timezone,
      (p_jour + p_heure_fin) at time zone v_timezone,
      array[p_compagnon_id],
      auth.uid(),
      auth.uid()
    )
    returning id into v_planning_id;
  else
    update public.planning_entries
      set compagnon_ids = case
        when p_compagnon_id = any(compagnon_ids) then compagnon_ids
        else array_append(compagnon_ids, p_compagnon_id)
      end,
      date_debut = (p_jour + p_heure_debut) at time zone v_timezone,
      date_fin = (p_jour + p_heure_fin) at time zone v_timezone,
      updated_by = auth.uid()
    where id = v_planning_id;
  end if;

  insert into public.planning_affectation_details (
    planning_entry_id,
    compagnon_id,
    entreprise_id,
    vehicule_id
  ) values (
    v_planning_id,
    p_compagnon_id,
    v_entreprise,
    p_vehicule_id
  )
  on conflict (planning_entry_id, compagnon_id)
  do update set vehicule_id = excluded.vehicule_id;

  update public.chantiers c
    set equipe = (
      select coalesce(array_agg(distinct compagnon_id), '{}'::uuid[])
      from (
        select unnest(pe.compagnon_ids) as compagnon_id
        from public.planning_entries pe
        where pe.chantier_id = c.id
          and (pe.date_debut at time zone v_timezone)::date = p_jour
      ) equipe_du_jour
    )
  where c.id = p_chantier_id;

  return v_planning_id::text || ':' || p_compagnon_id::text;
end
$$;

create or replace function public.modifier_affectation_pointage_v1(
  p_planning_entry_id uuid,
  p_compagnon_id uuid,
  p_inclus_pointage boolean default null,
  p_vehicule_id uuid default null,
  p_change_vehicule boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entreprise uuid := public.app_entreprise_id();
begin
  if not exists (
    select 1
    from public.planning_entries pe
    where pe.id = p_planning_entry_id
      and pe.entreprise_id = v_entreprise
      and (
        public.pointage_can_manage()
        or (
          public.pointage_has_module('terrain')
          and public.app_compagnon_id() = any(pe.compagnon_ids)
        )
      )
  ) then
    raise exception 'Affectation inaccessible';
  end if;

  insert into public.planning_affectation_details (
    planning_entry_id,
    compagnon_id,
    entreprise_id,
    vehicule_id,
    inclus_pointage
  ) values (
    p_planning_entry_id,
    p_compagnon_id,
    v_entreprise,
    case when p_change_vehicule then p_vehicule_id else null end,
    coalesce(p_inclus_pointage, true)
  )
  on conflict (planning_entry_id, compagnon_id)
  do update set
    inclus_pointage = coalesce(p_inclus_pointage, planning_affectation_details.inclus_pointage),
    vehicule_id = case
      when p_change_vehicule then p_vehicule_id
      else planning_affectation_details.vehicule_id
    end;
end
$$;

create or replace function public.supprimer_affectation_pointage_v1(
  p_planning_entry_id uuid,
  p_compagnon_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entreprise uuid := public.app_entreprise_id();
begin
  if not exists (
    select 1
    from public.planning_entries pe
    where pe.id = p_planning_entry_id
      and pe.entreprise_id = v_entreprise
      and (
        public.pointage_can_manage()
        or (
          public.pointage_has_module('terrain')
          and public.app_compagnon_id() = any(pe.compagnon_ids)
        )
      )
  ) then
    raise exception 'Affectation inaccessible';
  end if;

  update public.planning_entries
    set compagnon_ids = array_remove(compagnon_ids, p_compagnon_id),
        updated_by = auth.uid()
    where id = p_planning_entry_id;

  delete from public.planning_affectation_details
    where planning_entry_id = p_planning_entry_id
      and compagnon_id = p_compagnon_id;

  delete from public.planning_entries
    where id = p_planning_entry_id
      and cardinality(compagnon_ids) = 0;
end
$$;

create or replace function public.creer_chantier_pointage_v1(
  p_reference text,
  p_nom text,
  p_adresse text,
  p_code_postal text,
  p_ville text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.pointage_can_manage() then
    raise exception 'Module conducteur requis';
  end if;

  insert into public.chantiers (
    entreprise_id,
    no,
    client,
    city,
    label,
    statut,
    conducteur_profil_id,
    adresse_chantier
  ) values (
    public.app_entreprise_id(),
    nullif(trim(p_reference), ''),
    trim(p_nom),
    trim(p_ville),
    trim(p_nom),
    'a_preparer',
    case when public.app_role() = 'conducteur' then auth.uid() else null end,
    trim(concat_ws(' ', nullif(trim(p_adresse), ''), nullif(trim(p_code_postal), ''), nullif(trim(p_ville), '')))
  )
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.creer_vehicule_pointage_v1(
  p_libelle text,
  p_immatriculation text,
  p_type text,
  p_capacite text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.pointage_can_manage() then
    raise exception 'Module conducteur requis';
  end if;

  insert into public.vehicules (
    entreprise_id, libelle, immatriculation, type_vehicule, capacite
  ) values (
    public.app_entreprise_id(),
    trim(p_libelle),
    nullif(upper(trim(p_immatriculation)), ''),
    nullif(trim(p_type), ''),
    nullif(trim(p_capacite), '')
  )
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.creer_operation_logistique_pointage_v1(
  p_chantier_id uuid,
  p_type_operation text,
  p_debut_prevu timestamptz,
  p_fournisseur text,
  p_chauffeur_nom text,
  p_chauffeur_telephone text,
  p_vehicule_id uuid,
  p_camion_externe text,
  p_capacite text,
  p_chargement jsonb,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.pointage_can_manage()
    or not public.app_can_manage_chantier(p_chantier_id) then
    raise exception 'Chantier inaccessible';
  end if;

  insert into public.operations_logistiques (
    entreprise_id,
    chantier_id,
    type_operation,
    statut,
    debut_prevu,
    fournisseur,
    chauffeur_nom,
    chauffeur_telephone,
    vehicule_id,
    camion_externe,
    capacite,
    chargement,
    note,
    cree_par
  ) values (
    public.app_entreprise_id(),
    p_chantier_id,
    p_type_operation,
    'planifiee',
    p_debut_prevu,
    nullif(trim(p_fournisseur), ''),
    nullif(trim(p_chauffeur_nom), ''),
    nullif(trim(p_chauffeur_telephone), ''),
    p_vehicule_id,
    nullif(trim(p_camion_externe), ''),
    nullif(trim(p_capacite), ''),
    coalesce(p_chargement, '[]'::jsonb),
    nullif(trim(p_note), ''),
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.enregistrer_document_pointage_v1(
  p_chantier_id uuid,
  p_categorie text,
  p_nom text,
  p_chemin text,
  p_mime_type text,
  p_taille bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.pointage_can_manage()
    or not public.app_can_manage_chantier(p_chantier_id) then
    raise exception 'Chantier inaccessible';
  end if;

  insert into public.documents (
    entreprise_id,
    chantier_id,
    nom,
    type,
    chemin_fichier,
    bucket,
    taille,
    uploaded_by,
    statut_analyse,
    mime_type,
    categorie_metier,
    visible_terrain
  ) values (
    public.app_entreprise_id(),
    p_chantier_id,
    trim(p_nom),
    case when p_mime_type like 'image/%' then 'photo' else 'pdf' end,
    p_chemin,
    'documents',
    p_taille,
    auth.uid(),
    'en_attente',
    p_mime_type,
    p_categorie,
    true
  )
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.refresh_alertes_pointage_v1(p_jour date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entreprise uuid := public.app_entreprise_id();
  v_timezone text;
  v_heure_alerte time;
  v_count integer := 0;
begin
  if not public.pointage_can_manage() then
    raise exception 'Module conducteur requis';
  end if;

  select timezone, heure_alerte_pointage
    into v_timezone, v_heure_alerte
  from public.entreprises
  where id = v_entreprise;

  if p_jour = (now() at time zone v_timezone)::date
    and (now() at time zone v_timezone)::time < v_heure_alerte then
    return 0;
  end if;

  insert into public.alertes_pointage (
    entreprise_id,
    chantier_id,
    planning_entry_id,
    compagnon_id,
    type_alerte,
    jour,
    severite,
    message
  )
  select
    pe.entreprise_id,
    pe.chantier_id,
    pe.id,
    equipe.compagnon_id,
    case
      when not exists (
        select 1
        from public.pointage_evenements evt
        where evt.compagnon_id = equipe.compagnon_id
          and (evt.debut at time zone v_timezone)::date = p_jour
      ) then 'pointage_manquant'
      else 'fin_activite_manquante'
    end,
    p_jour,
    2,
    case
      when not exists (
        select 1
        from public.pointage_evenements evt
        where evt.compagnon_id = equipe.compagnon_id
          and (evt.debut at time zone v_timezone)::date = p_jour
      ) then trim(concat_ws(' ', c.prenom, c.nom)) || ' n''a aucun pointage'
      else trim(concat_ws(' ', c.prenom, c.nom)) || ' n''a pas terminé sa journée'
    end
  from public.planning_entries pe
  cross join lateral unnest(pe.compagnon_ids) equipe(compagnon_id)
  join public.compagnons c on c.id = equipe.compagnon_id
  left join public.planning_affectation_details pad
    on pad.planning_entry_id = pe.id
   and pad.compagnon_id = equipe.compagnon_id
  where pe.entreprise_id = v_entreprise
    and (pe.date_debut at time zone v_timezone)::date = p_jour
    and coalesce(pad.inclus_pointage, true)
    and (
      not exists (
        select 1
        from public.pointage_evenements evt
        where evt.compagnon_id = equipe.compagnon_id
          and (evt.debut at time zone v_timezone)::date = p_jour
      )
      or exists (
        select 1
        from public.pointage_evenements evt
        where evt.compagnon_id = equipe.compagnon_id
          and (evt.debut at time zone v_timezone)::date = p_jour
          and evt.fin is null
      )
    )
  on conflict (planning_entry_id, compagnon_id, type_alerte, jour)
    where planning_entry_id is not null and compagnon_id is not null
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function public.resoudre_alerte_pointage_v1(p_alerte_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.pointage_can_manage() then
    raise exception 'Module conducteur requis';
  end if;

  update public.alertes_pointage
    set resolue = true,
        resolue_par = auth.uid(),
        resolue_a = now()
  where id = p_alerte_id
    and entreprise_id = public.app_entreprise_id();
end
$$;

insert into public.profil_modules (profil_id, entreprise_id, module)
select
  p.id,
  p.entreprise_id,
  case
    when p.role in ('admin', 'direction', 'bureau', 'conducteur') then 'conducteur'
    when p.role = 'rh' then 'rh'
    else 'terrain'
  end
from public.profils p
where p.entreprise_id is not null
on conflict (profil_id, module) do nothing;

alter table public.profil_modules enable row level security;
alter table public.vehicules enable row level security;
alter table public.planning_affectation_details enable row level security;
alter table public.operations_logistiques enable row level security;
alter table public.alertes_pointage enable row level security;

drop policy if exists profil_modules_pointage_select on public.profil_modules;
create policy profil_modules_pointage_select
on public.profil_modules
for select
to authenticated
using (
  profil_id = auth.uid()
  or (
    entreprise_id = public.app_entreprise_id()
    and (
      public.pointage_has_module('rh')
      or public.app_role() in ('admin', 'direction')
    )
  )
);

drop policy if exists profils_select_rh_pointage on public.profils;
create policy profils_select_rh_pointage
on public.profils
for select
to authenticated
using (
  entreprise_id = public.app_entreprise_id()
  and public.pointage_has_module('rh')
);

drop policy if exists compagnons_select_modules_pointage on public.compagnons;
create policy compagnons_select_modules_pointage
on public.compagnons
for select
to authenticated
using (
  entreprise_id = public.app_entreprise_id()
  and (
    public.pointage_has_module('terrain')
    or public.pointage_has_module('conducteur')
    or public.pointage_has_module('rh')
  )
);

drop policy if exists vehicules_pointage_select on public.vehicules;
create policy vehicules_pointage_select
on public.vehicules
for select
to authenticated
using (
  entreprise_id = public.app_entreprise_id()
  and (
    public.pointage_has_module('terrain')
    or public.pointage_has_module('conducteur')
  )
);

drop policy if exists planning_affectation_details_select
  on public.planning_affectation_details;
create policy planning_affectation_details_select
on public.planning_affectation_details
for select
to authenticated
using (
  entreprise_id = public.app_entreprise_id()
  and (
    public.pointage_has_module('terrain')
    or public.pointage_has_module('conducteur')
  )
);

drop policy if exists operations_logistiques_select
  on public.operations_logistiques;
create policy operations_logistiques_select
on public.operations_logistiques
for select
to authenticated
using (
  entreprise_id = public.app_entreprise_id()
  and (
    public.pointage_has_module('terrain')
    or public.pointage_has_module('conducteur')
  )
  and public.app_can_access_chantier(chantier_id)
);

drop policy if exists alertes_pointage_select on public.alertes_pointage;
create policy alertes_pointage_select
on public.alertes_pointage
for select
to authenticated
using (
  entreprise_id = public.app_entreprise_id()
  and public.pointage_can_manage()
);

grant select on public.profil_modules to authenticated;
grant select on public.vehicules to authenticated;
grant select on public.planning_affectation_details to authenticated;
grant select on public.operations_logistiques to authenticated;
grant select on public.alertes_pointage to authenticated;

revoke all on function public.pointage_has_module(text) from public;
revoke all on function public.pointage_can_manage() from public;
revoke all on function public.get_pointage_user_context_v1() from public;
revoke all on function public.enregistrer_affectation_pointage_v1(uuid, uuid, uuid, date, time, time) from public;
revoke all on function public.modifier_affectation_pointage_v1(uuid, uuid, boolean, uuid, boolean) from public;
revoke all on function public.supprimer_affectation_pointage_v1(uuid, uuid) from public;
revoke all on function public.creer_chantier_pointage_v1(text, text, text, text, text) from public;
revoke all on function public.creer_vehicule_pointage_v1(text, text, text, text) from public;
revoke all on function public.creer_operation_logistique_pointage_v1(uuid, text, timestamptz, text, text, text, uuid, text, text, jsonb, text) from public;
revoke all on function public.enregistrer_document_pointage_v1(uuid, text, text, text, text, bigint) from public;
revoke all on function public.refresh_alertes_pointage_v1(date) from public;
revoke all on function public.resoudre_alerte_pointage_v1(uuid) from public;

grant execute on function public.pointage_has_module(text) to authenticated;
grant execute on function public.pointage_can_manage() to authenticated;
grant execute on function public.get_pointage_user_context_v1() to authenticated;
grant execute on function public.enregistrer_affectation_pointage_v1(uuid, uuid, uuid, date, time, time) to authenticated;
grant execute on function public.modifier_affectation_pointage_v1(uuid, uuid, boolean, uuid, boolean) to authenticated;
grant execute on function public.supprimer_affectation_pointage_v1(uuid, uuid) to authenticated;
grant execute on function public.creer_chantier_pointage_v1(text, text, text, text, text) to authenticated;
grant execute on function public.creer_vehicule_pointage_v1(text, text, text, text) to authenticated;
grant execute on function public.creer_operation_logistique_pointage_v1(uuid, text, timestamptz, text, text, text, uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.enregistrer_document_pointage_v1(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.refresh_alertes_pointage_v1(date) to authenticated;
grant execute on function public.resoudre_alerte_pointage_v1(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
