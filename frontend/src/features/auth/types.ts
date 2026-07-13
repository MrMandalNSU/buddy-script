export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  createdAt?: string;
};

export type Session = { user: User; accessExpiresAt?: string };
export type LoginInput = { email: string; password: string; remember: boolean };
export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};
export type AuthState = { status: "loading" } | { status: "authenticated"; user: User } | { status: "anonymous" };
