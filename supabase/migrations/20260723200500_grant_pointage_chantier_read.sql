-- Les politiques RLS de chantiers filtrent déjà les lignes par rôle et par
-- affectation. Le rôle authenticated doit aussi posséder le droit SQL SELECT
-- pour que ces politiques puissent s'appliquer aux modules terrain/conducteur.
grant select on table public.chantiers to authenticated;
