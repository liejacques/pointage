-- Le trigger partagé entre pointage_evenements et pointage_journees comparait
-- directement deux enums différents. Les comparaisons passent par text afin
-- que la fermeture d'un événement ne tente jamais de convertir "validee" en
-- statut_evenement.
create or replace function public.guard_validated_pointage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'pointage_evenements'
     and tg_op in ('UPDATE', 'DELETE')
     and old.statut::text = 'valide'
     and not public.app_can_manage_pointage(old.compagnon_id) then
    raise exception 'LOCKED: événement déjà validé' using errcode = '55000';
  end if;

  if tg_table_name = 'pointage_evenements'
     and tg_op = 'UPDATE'
     and new.statut::text = 'valide'
     and old.statut::text is distinct from new.statut::text
     and not public.app_can_manage_pointage(new.compagnon_id) then
    raise exception 'FORBIDDEN: validation réservée au responsable'
      using errcode = '42501';
  end if;

  if tg_table_name = 'pointage_journees'
     and tg_op in ('UPDATE', 'DELETE')
     and old.statut::text = 'validee'
     and not public.app_can_manage_pointage(old.compagnon_id) then
    raise exception 'LOCKED: journée déjà validée' using errcode = '55000';
  end if;

  if tg_table_name = 'pointage_journees'
     and tg_op = 'UPDATE'
     and new.statut::text = 'validee'
     and old.statut::text is distinct from new.statut::text
     and not public.app_can_manage_pointage(new.compagnon_id) then
    raise exception 'FORBIDDEN: validation réservée au responsable'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;
