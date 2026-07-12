import argon2 from "argon2";

const options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

// A valid hash used when an account does not exist to reduce timing-based enumeration.
const dummyHash = "$argon2id$v=19$m=19456,t=2,p=1$L95FQjv48sjFnZje69uhQQ$GjkL69aX7LaNjpofQuP2FWQFQ20EVRUdR7zUp5DQG54";

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export async function verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
  try {
    const valid = await argon2.verify(passwordHash ?? dummyHash, password);
    return passwordHash === undefined ? false : valid;
  } catch {
    return false;
  }
}
