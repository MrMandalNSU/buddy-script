import { z } from "zod";

const email = z.email().max(320).transform((value) => value.trim());
const password = z.string().min(8, "Password must contain at least 8 characters").max(128);

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email,
  password,
}).strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
