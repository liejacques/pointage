-- Migration volontairement isolée : PostgreSQL exige que la nouvelle valeur
-- d'enum soit validée avant son utilisation dans la migration suivante.
alter type public.role_profil add value if not exists 'rh';
