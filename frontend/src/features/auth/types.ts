export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string;
  headline: string;
};

export type Session = { user: User; expiresAt: string };
export type LoginInput = { email: string; password: string; remember: boolean };
export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};
