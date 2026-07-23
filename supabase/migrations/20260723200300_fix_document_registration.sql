-- Le CASE du RPC doit être converti explicitement vers l'enum type_document.
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
    (case when p_mime_type like 'image/%' then 'photo' else 'pdf' end)::public.type_document,
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

revoke all on function public.enregistrer_document_pointage_v1(uuid, text, text, text, text, bigint)
  from public;
grant execute on function public.enregistrer_document_pointage_v1(uuid, text, text, text, text, bigint)
  to authenticated;

select pg_notify('pgrst', 'reload schema');
