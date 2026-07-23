# Aetheris pointage

Cockpit React/Vite de pointage chantier Aetheris. L’interface s’adapte au téléphone, à la tablette et à l’ordinateur sans perdre la lisibilité terrain.

Fonctions disponibles :

- actions de pointage avec annulation de la dernière saisie pendant 60 secondes ;
- historique groupé par date avec cumul du jour ;
- gestion des présences et ajout ou retrait d’un compagnon ;
- prochain mouvement d’équipe mis en avant ;
- accès direct à Google Maps depuis l’adresse du chantier ;
- accès direct aux prévisions Météo-France du lieu ;
- ouverture du devis PDF en un clic ;
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

Les données de cette maquette sont fictives. Les liens Google Maps et Météo-France ainsi que les liens téléphoniques ouvrent désormais les services correspondants. Le devis fourni est un document de démonstration à remplacer par le PDF signé réel.
