-- Données locales de démonstration. Ce fichier n'est pas injecté en production par `db push`.
insert into public.entreprises (id, nom, slug)
values ('10000000-0000-0000-0000-000000000001', 'Aetheris', 'aetheris')
on conflict (id) do nothing;

insert into public.compagnons (id, entreprise_id, nom_complet, initiales)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Fabien Susin', 'FS'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Kevin Garnier', 'KG'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Jocelin Saur', 'JS'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Michael Daluin', 'MD')
on conflict (id) do nothing;

insert into public.chantiers (
  id, entreprise_id, reference, nom, client_nom, adresse, code_postal, ville,
  statut, date_debut, consignes, meteo_url
)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '112430',
  'Réfection toiture zinc joint debout',
  'Famille Meyer',
  '12 rue des Vignes',
  '68910',
  'Labaroche',
  'en_cours',
  current_date,
  'Protéger la terrasse avant dépose.',
  'https://meteofrance.com/previsions-meteo-france/labaroche/68910'
)
on conflict (id) do nothing;

insert into public.vehicules (
  id, entreprise_id, libelle, immatriculation, type_vehicule, capacite
)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Renault Trafic',
  'FM-637-SA',
  'Fourgon',
  '3 places'
)
on conflict (id) do nothing;

insert into public.affectations (
  entreprise_id, chantier_id, compagnon_id, vehicule_id, jour, statut
)
select
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  c.id,
  '40000000-0000-0000-0000-000000000001',
  current_date,
  'confirmee'
from public.compagnons c
where c.id in (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004'
)
on conflict (compagnon_id, jour) do nothing;
