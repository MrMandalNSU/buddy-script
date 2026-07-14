import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/shared/api/client";
import { authService } from "./service";

vi.mock("@/shared/api/client", () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: vi.fn(),
}));

const requestMock = vi.mocked(apiRequest);
const response = {
  user: { id: "user-1", firstName: "Ava", lastName: "Stone", email: "ava@example.com", avatarUrl: null },
  session: { accessExpiresAt: "2026-07-14T12:00:00.000Z" },
};

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue(response);
});

describe("auth service", () => {
  it.each([true, false])("sends remember=%s with login requests", async (remember) => {
    await authService.login({ email: " ava@example.com ", password: "Password!", remember });

    expect(requestMock).toHaveBeenCalledWith("/api/v1/auth/login", expect.objectContaining({
      method: "POST",
      body: { email: "ava@example.com", password: "Password!", remember },
    }));
  });
});
