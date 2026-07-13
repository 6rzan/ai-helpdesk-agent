import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;

export interface HashedPassword {
  passwordHash: string;
  passwordSalt: string;
}

export async function hashPassword(plainPassword: string): Promise<HashedPassword> {
  const passwordSalt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(plainPassword, passwordSalt, KEY_LENGTH)) as Buffer;
  return { passwordHash: derivedKey.toString("hex"), passwordSalt };
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
  passwordSalt: string,
): Promise<boolean> {
  const derivedKey = (await scryptAsync(plainPassword, passwordSalt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(passwordHash, "hex");
  if (storedKey.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(storedKey, derivedKey);
}
