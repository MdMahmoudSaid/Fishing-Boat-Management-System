// Hash du code de connexion à 4 chiffres (accepté comme risque assumé pour
// cet outil interne mono-admin — voir docs/superpowers/specs/...). bcrypt
// reste la bonne pratique même pour un secret court : ralentit le
// brute-force côté serveur en cas de fuite de la base.
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashLoginCode(code: string): Promise<string> {
  return bcrypt.hash(code, SALT_ROUNDS);
}

export async function verifyLoginCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
