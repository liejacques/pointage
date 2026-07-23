create type public.module_code as enum (
  'terrain',
  'conducteur',
  'rh'
);

alter table public.profils
  add column identifiant_court text,
  add column cree_par uuid references public.profils(id) on delete set null;

alter table public.profils
  add constraint profils_identifiant_court_format
  check (
    identifiant_court is null
    or identifiant_court ~ '^[a-z0-9][a-z0-9._-]{1,30}$'
  );

create unique index profils_identifiant_court_unique
  on public.profils (lower(identifiant_court))
  where identifiant_court is not null;

create table public.profil_modules (
  profil_id uuid not null references public.profils(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  module public.module_code not null,
  cree_par uuid references public.profils(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profil_id, module)
);

create index profil_modules_entreprise_idx
  on public.profil_modules (entreprise_id, module);

create or replace function private.verifier_entreprise_profil_module()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entreprise uuid;
begin
  select p.entreprise_id
  into v_entreprise
  from public.profils p
  where p.id = new.profil_id;

  if v_entreprise is null or v_entreprise <> new.entreprise_id then
    raise exception 'Le module et le profil doivent appartenir à la même entreprise';
  end if;

  return new;
end;
$$;

create trigger profil_modules_entreprise_check
before insert or update on public.profil_modules
for each row execute function private.verifier_entreprise_profil_module();

create or replace function private.has_module(p_module public.module_code)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profil_modules pm
    join public.profils p on p.id = pm.profil_id
    where pm.profil_id = auth.uid()
      and pm.module = p_module
      and p.actif = true
      and p.entreprise_id = pm.entreprise_id
  )
$$;

revoke all on function private.has_module(public.module_code) from public, anon;
grant execute on function private.has_module(public.module_code) to authenticated;

alter table public.profil_modules enable row level security;

create policy profil_modules_select
on public.profil_modules
for select
to authenticated
using (
  profil_id = auth.uid()
  or (
    entreprise_id = private.current_entreprise_id()
    and (
      private.has_module('rh')
      or private.current_app_role() in ('admin', 'direction')
    )
  )
);

drop policy profils_select on public.profils;
create policy profils_select
on public.profils
for select
to authenticated
using (
  id = auth.uid()
  or (
    entreprise_id = private.current_entreprise_id()
    and (
      private.current_app_role() in ('admin', 'direction', 'bureau', 'conducteur')
      or private.has_module('rh')
    )
  )
);

insert into public.profil_modules (profil_id, entreprise_id, module, cree_par)
select
  p.id,
  p.entreprise_id,
  case
    when p.role in ('admin', 'direction', 'bureau', 'conducteur') then 'conducteur'::public.module_code
    when p.role = 'rh' then 'rh'::public.module_code
    else 'terrain'::public.module_code
  end,
  p.cree_par
from public.profils p
where p.entreprise_id is not null
on conflict (profil_id, module) do nothing;

create or replace function public.get_user_context_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.id is null or p.actif = false then null
    else jsonb_build_object(
      'id', p.id,
      'entreprise_id', p.entreprise_id,
      'role', p.role,
      'nom_complet', p.nom_complet,
      'initiales', p.initiales,
      'telephone', p.telephone,
      'identifiant_court', p.identifiant_court,
      'actif', p.actif,
      'entreprise', jsonb_build_object(
        'nom', e.nom,
        'logo_url', e.logo_url
      ),
      'modules', coalesce(
        (
          select jsonb_agg(pm.module order by pm.module)
          from public.profil_modules pm
          where pm.profil_id = p.id
        ),
        '[]'::jsonb
      )
    )
  end
  from (select auth.uid() as user_id) current_user_id
  left join public.profils p on p.id = current_user_id.user_id
  left join public.entreprises e on e.id = p.entreprise_id
$$;

revoke all on function public.get_user_context_v1() from public, anon;
grant execute on function public.get_user_context_v1() to authenticated;

grant select on public.profil_modules to authenticated;

