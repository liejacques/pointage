import { localDate } from './services/aetherisApi'

const today = localDate()
const now = new Date()
const at = (hour, minute) => {
  const value = new Date(now)
  value.setHours(hour, minute, 0, 0)
  return value.toISOString()
}

export const demoProfile = {
  id: '50000000-0000-0000-0000-000000000001',
  entreprise_id: '10000000-0000-0000-0000-000000000001',
  role: 'conducteur',
  nom_complet: 'Nicolas Forny',
  initiales: 'NF',
  actif: true,
  entreprises: { nom: 'Aetheris' },
}

export const demoConductorData = {
  sites: [
    { id: '30000000-0000-0000-0000-000000000001', reference: '112430', nom: 'Réfection toiture zinc joint debout', ville: 'Labaroche', adresse: '12 rue des Vignes', code_postal: '68910', statut: 'en_cours' },
    { id: '30000000-0000-0000-0000-000000000002', reference: '112518', nom: 'Gouttières et descentes zinc', ville: 'Colmar', adresse: '8 avenue d’Alsace', code_postal: '68000', statut: 'planifie' },
    { id: '30000000-0000-0000-0000-000000000003', reference: '112387', nom: 'Réfection couverture tuiles', ville: 'Kaysersberg', adresse: '1 rue des Sorbiers', code_postal: '68240', statut: 'en_cours' },
  ],
  people: [
    { id: '20000000-0000-0000-0000-000000000001', nom_complet: 'Fabien Susin', initiales: 'FS', actif: true },
    { id: '20000000-0000-0000-0000-000000000002', nom_complet: 'Kevin Garnier', initiales: 'KG', actif: true },
    { id: '20000000-0000-0000-0000-000000000003', nom_complet: 'Jocelin Saur', initiales: 'JS', actif: true },
    { id: '20000000-0000-0000-0000-000000000004', nom_complet: 'Michael Daluin', initiales: 'MD', actif: true },
  ],
  vehicles: [
    { id: '40000000-0000-0000-0000-000000000001', libelle: 'Renault Trafic', immatriculation: 'FM-637-SA', type_vehicule: 'Fourgon', capacite: '3 places' },
    { id: '40000000-0000-0000-0000-000000000002', libelle: 'Renault Master', immatriculation: 'GH-904-KL', type_vehicule: 'Fourgon atelier', capacite: '3,5 t' },
  ],
  assignments: [
    { id: 'a1', jour: today, chantier_id: '30000000-0000-0000-0000-000000000001', compagnon_id: '20000000-0000-0000-0000-000000000001', inclus_pointage: true, compagnons: { id: '20000000-0000-0000-0000-000000000001', nom_complet: 'Fabien Susin', initiales: 'FS' }, chantiers: { id: '30000000-0000-0000-0000-000000000001', reference: '112430', nom: 'Réfection toiture zinc joint debout', ville: 'Labaroche' }, vehicules: { id: '40000000-0000-0000-0000-000000000001', libelle: 'Renault Trafic', immatriculation: 'FM-637-SA' } },
    { id: 'a2', jour: today, chantier_id: '30000000-0000-0000-0000-000000000001', compagnon_id: '20000000-0000-0000-0000-000000000002', inclus_pointage: true, compagnons: { id: '20000000-0000-0000-0000-000000000002', nom_complet: 'Kevin Garnier', initiales: 'KG' }, chantiers: { id: '30000000-0000-0000-0000-000000000001', reference: '112430', nom: 'Réfection toiture zinc joint debout', ville: 'Labaroche' }, vehicules: { id: '40000000-0000-0000-0000-000000000001', libelle: 'Renault Trafic', immatriculation: 'FM-637-SA' } },
    { id: 'a3', jour: today, chantier_id: '30000000-0000-0000-0000-000000000003', compagnon_id: '20000000-0000-0000-0000-000000000003', inclus_pointage: true, compagnons: { id: '20000000-0000-0000-0000-000000000003', nom_complet: 'Jocelin Saur', initiales: 'JS' }, chantiers: { id: '30000000-0000-0000-0000-000000000003', reference: '112387', nom: 'Réfection couverture tuiles', ville: 'Kaysersberg' }, vehicules: { id: '40000000-0000-0000-0000-000000000002', libelle: 'Renault Master', immatriculation: 'GH-904-KL' } },
    { id: 'a4', jour: today, chantier_id: '30000000-0000-0000-0000-000000000003', compagnon_id: '20000000-0000-0000-0000-000000000004', inclus_pointage: true, compagnons: { id: '20000000-0000-0000-0000-000000000004', nom_complet: 'Michael Daluin', initiales: 'MD' }, chantiers: { id: '30000000-0000-0000-0000-000000000003', reference: '112387', nom: 'Réfection couverture tuiles', ville: 'Kaysersberg' }, vehicules: { id: '40000000-0000-0000-0000-000000000002', libelle: 'Renault Master', immatriculation: 'GH-904-KL' } },
  ],
  punches: [
    { id: 'p4', jour_travail: today, compagnon_id: '20000000-0000-0000-0000-000000000003', chantier_id: '30000000-0000-0000-0000-000000000003', action: 'pause', pointe_a: at(12, 2), compagnons: { nom_complet: 'Jocelin Saur', initiales: 'JS' }, chantiers: { reference: '112387', nom: 'Réfection couverture tuiles' } },
    { id: 'p3', jour_travail: today, compagnon_id: '20000000-0000-0000-0000-000000000002', chantier_id: '30000000-0000-0000-0000-000000000001', action: 'faconnage', pointe_a: at(9, 18), compagnons: { nom_complet: 'Kevin Garnier', initiales: 'KG' }, chantiers: { reference: '112430', nom: 'Réfection toiture zinc joint debout' } },
    { id: 'p2', jour_travail: today, compagnon_id: '20000000-0000-0000-0000-000000000003', chantier_id: '30000000-0000-0000-0000-000000000003', action: 'debut_activite', pointe_a: at(7, 31), compagnons: { nom_complet: 'Jocelin Saur', initiales: 'JS' }, chantiers: { reference: '112387', nom: 'Réfection couverture tuiles' } },
    { id: 'p1', jour_travail: today, compagnon_id: '20000000-0000-0000-0000-000000000001', chantier_id: '30000000-0000-0000-0000-000000000001', action: 'debut_activite', pointe_a: at(7, 27), compagnons: { nom_complet: 'Fabien Susin', initiales: 'FS' }, chantiers: { reference: '112430', nom: 'Réfection toiture zinc joint debout' } },
  ],
  reports: [
    { affectation_id: 'a1', jour: today, chantier_reference: '112430', chantier_nom: 'Réfection toiture zinc joint debout', compagnon_nom: 'Fabien Susin', premier_pointage: at(7, 27), dernier_pointage: null, minutes_travaillees: 365, nombre_pointages: 1, journee_terminee: false },
    { affectation_id: 'a2', jour: today, chantier_reference: '112430', chantier_nom: 'Réfection toiture zinc joint debout', compagnon_nom: 'Kevin Garnier', premier_pointage: at(7, 30), dernier_pointage: null, minutes_travaillees: 362, nombre_pointages: 2, journee_terminee: false },
    { affectation_id: 'a3', jour: today, chantier_reference: '112387', chantier_nom: 'Réfection couverture tuiles', compagnon_nom: 'Jocelin Saur', premier_pointage: at(7, 31), dernier_pointage: null, minutes_travaillees: 271, nombre_pointages: 2, journee_terminee: false },
    { affectation_id: 'a4', jour: today, chantier_reference: '112387', chantier_nom: 'Réfection couverture tuiles', compagnon_nom: 'Michael Daluin', premier_pointage: null, dernier_pointage: null, minutes_travaillees: 0, nombre_pointages: 0, journee_terminee: false },
  ],
  alerts: [
    { id: 'al1', type_alerte: 'pointage_manquant', severite: 2, message: 'Michael Daluin n’a aucun début d’activité', jour: today, compagnons: { nom_complet: 'Michael Daluin' }, chantiers: { reference: '112387', nom: 'Réfection couverture tuiles' } },
  ],
  documents: [
    { id: 'd1', chantier_id: '30000000-0000-0000-0000-000000000001', type_document: 'devis', nom_fichier: 'devis-2025-0847.pdf', storage_path: 'demo', created_at: at(8, 0), chantiers: { reference: '112430', nom: 'Réfection toiture zinc joint debout' } },
  ],
  logistics: [
    { id: 'l1', chantier_id: '30000000-0000-0000-0000-000000000001', type_operation: 'grutage', statut: 'confirmee', debut_prevu: at(14, 15), fournisseur: 'Alsace Levage', chauffeur_nom: 'Julien Schmitt', chauffeur_telephone: '06 12 34 56 78', camion_externe: 'Porteur-grue 26 t', capacite: 'Grue 32 t/m · portée 18 m', chargement: ['12 rouleaux de zinc', '6 palettes de volige', 'Garde-corps de rive'], chantiers: { reference: '112430', nom: 'Réfection toiture zinc joint debout' }, vehicules: null },
  ],
}

