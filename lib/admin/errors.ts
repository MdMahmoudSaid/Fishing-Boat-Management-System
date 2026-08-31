// Erreurs typées levées par lib/admin/createCompany.ts et consommées par les
// routes /api/admin/* pour choisir le bon status HTTP (400 vs 409) sans que
// la route ait à connaître le détail des contraintes DB.
export class ValidationError extends Error {}

export class DuplicatePhoneError extends Error {
  constructor() {
    super("Ce numéro de téléphone est déjà utilisé par un autre compte.");
  }
}
