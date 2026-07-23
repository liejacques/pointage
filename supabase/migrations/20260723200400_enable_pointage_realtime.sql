-- Les politiques RLS restent la source d'autorisation. Cette publication permet
-- uniquement aux clients déjà autorisés de recevoir les changements en direct.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pointage_evenements',
    'planning_entries',
    'alertes_pointage',
    'operations_logistiques',
    'documents'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      )
    then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;
