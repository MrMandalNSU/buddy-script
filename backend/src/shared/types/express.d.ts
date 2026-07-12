declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        sessionId: string;
        csrfToken: string;
      };
      refreshAuth?: {
        userId: string;
        sessionId: string;
        familyId: string;
        csrfToken: string;
        rawToken: string;
      };
    }
  }
}

export {};
