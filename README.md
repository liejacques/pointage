# Aetheris pointage

Cockpit React/Vite de pointage chantier Aetheris. L’interface s’adapte au téléphone, à la tablette et à l’ordinateur sans perdre la lisibilité terrain.

Fonctions disponibles :

- choix immédiat entre toute l’équipe et une personne précise avant le pointage ;
- équipe du jour affichée en premier sur téléphone, sans métier ni spécialité ;
- gestion de l’équipe dans un panneau dédié : véhicule, présence, retrait, recherche et ajout de personnel ;
- création rapide d’une nouvelle personne avec initiales calculées automatiquement ;
- actions de pointage accessibles sans défilement sur un écran mobile courant ;
- accès direct à Google Maps depuis l’adresse du chantier ;
- accès direct aux prévisions Météo-France du lieu ;
- ouverture directe du devis PDF ;
- fiche de grutage avec chauffeur, téléphone, camion, capacité et chargement prévu ;
- changement manuel de chantier.

## Lancer le projet

```powershell
cd "$env:USERPROFILE\Desktop\Aetheris pointage"
npm install
npm run dev
```

Puis ouvrir l'adresse affichée par Vite, généralement `http://localhost:5173`.

## Vérifier la production

```powershell
npm run build
```

Le projet est compatible avec un déploiement Vercel standard pour une application Vite.

Les données de cette maquette sont fictives. Les liens Google Maps et Météo-France ainsi que les liens téléphoniques ouvrent les services correspondants. Le devis fourni est un document de démonstration à remplacer par le document réel.
