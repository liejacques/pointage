# Aetheris pointage

Application React/Vite de pointage chantier et de conduite de travaux Aetheris. L’interface s’adapte au téléphone, à la tablette et à l’ordinateur sans perdre la lisibilité terrain.

Fonctions disponibles :

- choix immédiat entre toute l’équipe et une personne précise avant le pointage ;
- équipe actuelle affichée comme vue standard, sans métier ni spécialité ;
- cases cochées ou vides pour inclure chaque personne dans le pointage ;
- actions « Changer véhicule » et « Ajouter dans l’équipe » réunies dans l’en-tête ;
- annuaire complet avec recherche pour ajouter du personnel ;
- liste d’équipe sans zone de défilement interne sur téléphone ;
- historique du jour avec les actions envoyées, le nombre de pointages et les heures calculées ;
- accès direct à Google Maps depuis l’adresse du chantier ;
- accès direct aux prévisions Météo-France du lieu ;
- ouverture directe du devis PDF ;
- fiche de grutage avec chauffeur, téléphone, camion, capacité et chargement prévu ;
- changement manuel de chantier.
- connexion Supabase sans mot de passe par lien magique ;
- ouverture automatique du module correspondant au rôle ;
- planning conducteur avec affectation des équipes et des véhicules ;
- pointages et alertes visibles en direct ;
- rapports journaliers avec heures et nombre de pointages ;
- rangement privé des devis et PDF par chantier ;
- grutages, livraisons et approvisionnements avec chauffeur, camion, capacité et chargement ;
- gestion des chantiers et du parc de véhicules.
- accès rapide par identifiant et mot de passe courts ;
- module RH limité à la création des utilisateurs et au choix de leurs modules ;
- choix d’espace Terrain, Conducteur ou RH selon les autorisations du profil.

## Lancer le projet

```powershell
cd "$env:USERPROFILE\Desktop\Aetheris pointage"
npm install
npm run dev
```

Puis ouvrir l'adresse affichée par Vite, généralement `http://localhost:5173`.

Sans configuration Supabase, l’écran de connexion propose un mode démonstration conducteur et terrain. Aucune donnée de démonstration n’est écrite en base.

## Configurer Supabase

Le module se branche sur le projet Supabase du SaaS Aetheris existant. Les migrations `001` à `014` présentes ici sont des marqueurs de dépendance : leur schéma complet reste géré par le dépôt principal Aetheris. Les migrations datées ajoutent uniquement les capacités nécessaires au pointage, à la conduite de travaux et au module RH.

Le module réutilise notamment `entreprises`, `profils`, `compagnons`, `chantiers`, `planning_entries`, `pointage_evenements`, `documents` et le bucket privé `documents`. Il ajoute les droits par module, les véhicules, les détails d’affectation, la logistique et les alertes sans recréer les tables socle.

Une session authentifiée n’affiche jamais les chantiers, grutages ou devis fictifs du mode démonstration. Sans affectation du jour, le terrain indique clairement que le planning doit être complété et bloque le pointage.

```powershell
npx supabase login
npx supabase link --project-ref VOTRE_REFERENCE
npx supabase db push
npx supabase functions deploy create-short-user
```

Créer ensuite les variables locales à partir de `.env.example` :

```dotenv
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_votre_cle_publique
```

Pour la production Vercel, ajouter les deux mêmes variables dans les paramètres du projet. La clé attendue par le navigateur est uniquement la clé publique/publishable, jamais la clé `service_role`.

Dans Supabase Auth :

- désactiver les inscriptions publiques ;
- créer ou inviter les utilisateurs ;
- ajouter l’URL Vercel dans `Site URL` et les URL de redirection autorisées ;
- rattacher chaque utilisateur à une entreprise et un rôle avec `supabase/bootstrap-user.sql.example`.

Les utilisateurs peuvent recevoir un lien magique par e-mail ou utiliser l’identifiant court créé par les RH. Les modules enregistrés dans `profil_modules` déterminent les espaces proposés après la connexion.

La création d’un utilisateur court est exécutée par la fonction Edge `create-short-user`. Elle vérifie que l’appelant possède le module RH, crée le compte Supabase Auth côté serveur puis affecte les modules. La clé d’administration reste uniquement dans l’environnement Supabase.

### Premier compte RH

Le premier compte RH se crée une seule fois avec le script de démarrage. Les valeurs sensibles sont fournies uniquement comme variables d’environnement locales et ne doivent jamais être committées :

```powershell
$env:SUPABASE_URL="https://votre-projet.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="votre-cle-serveur"
$env:RH_IDENTIFIER="votre-identifiant"
$env:RH_PASSWORD="votre-mot-de-passe"
npm run bootstrap:rh
```

Sans `COMPANY_ID`, le script rattache le compte RH à l’entreprise du premier administrateur actif. Supprimer ensuite les variables du terminal. Le mot de passe n’est jamais écrit dans la base en clair : Supabase Auth conserve un hash bcrypt.

## Données et sécurité

- une personne ne peut être affectée qu’à un chantier par jour ;
- le conducteur ne voit que ses chantiers ;
- le chef d’équipe peut gérer l’équipe de son chantier du jour ;
- l’ouvrier ne peut pointer que pour lui-même ;
- le profil RH ne reçoit aucun accès chantier par défaut ;
- un utilisateur ne voit que les modules qui lui ont été attribués ;
- les PDF sont privés et ouverts avec une URL signée de courte durée ;
- aucun prix n’est stocké ni affiché dans ce module ;
- les pointages sans réseau sont conservés dans le navigateur puis resynchronisés.

## Vérifier la production

```powershell
npm run build
```

Une vérification réelle et temporaire de tout le backend est également disponible. Elle crée un utilisateur de test, un chantier, un véhicule, une affectation, un pointage, un mouvement logistique et un PDF privé, contrôle leur lecture puis supprime toutes les données de test :

```powershell
npm run smoke:backend
```

Le projet est compatible avec un déploiement Vercel standard pour une application Vite.

Les données visibles en mode démonstration sont fictives. Les liens Google Maps et Météo-France ainsi que les liens téléphoniques ouvrent les services correspondants. Le devis fourni est un document de démonstration à remplacer par le document réel.
