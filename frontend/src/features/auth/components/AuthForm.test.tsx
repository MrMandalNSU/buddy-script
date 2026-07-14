import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

const authMocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("../AuthProvider", () => ({
  useAuth: () => ({ status: "anonymous", login: authMocks.login, register: authMocks.register }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    return createElement("img", imageProps);
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthForm password controls", () => {
  it("places registration name fields in the same equal-width row", () => {
    render(<AuthForm kind="register" />);

    const row = screen.getByLabelText("First name").closest(".name-fields");
    expect(row).toContainElement(screen.getByLabelText("First name"));
    expect(row).toContainElement(screen.getByLabelText("Last name"));
  });

  it("updates all three labeled password requirements while typing", () => {
    render(<AuthForm kind="register" />);

    const requirements = screen.getByRole("list", { name: "Password requirements" });
    const requirementItems = within(requirements).getAllByRole("listitem");
    expect(requirementItems).toHaveLength(3);
    expect(requirementItems.map((item) => item.dataset.requirement)).toEqual(["uppercase", "specialCharacter", "minLength"]);
    expect(requirements).toHaveClass("password-requirements");
    expect(requirement("minLength")).not.toHaveClass("is-met");
    expect(requirement("uppercase")).not.toHaveClass("is-met");
    expect(requirement("specialCharacter")).not.toHaveClass("is-met");

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longpassword" } });
    expect(requirement("minLength")).toHaveClass("is-met");
    expect(requirement("uppercase")).not.toHaveClass("is-met");
    expect(requirement("specialCharacter")).not.toHaveClass("is-met");

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password!" } });
    expect(requirement("minLength")).toHaveClass("is-met");
    expect(requirement("uppercase")).toHaveClass("is-met");
    expect(requirement("specialCharacter")).toHaveClass("is-met");
  });

  it("toggles registration password fields independently", () => {
    render(<AuthForm kind="register" />);

    const password = screen.getByLabelText("Password");
    const repeatPassword = screen.getByLabelText("Repeat Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(repeatPassword).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Show repeat password" }));
    expect(repeatPassword).toHaveAttribute("type", "text");
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows the repeat-password check only for a non-empty exact match", () => {
    render(<AuthForm kind="register" />);

    const password = screen.getByLabelText("Password");
    const repeatPassword = screen.getByLabelText("Repeat Password");
    fireEvent.change(password, { target: { value: "Password!" } });
    fireEvent.change(repeatPassword, { target: { value: "Password?" } });
    expect(screen.queryByText("Passwords match.")).not.toBeInTheDocument();

    fireEvent.change(repeatPassword, { target: { value: "Password!" } });
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
    expect(repeatPassword).toHaveAttribute("aria-describedby", "confirmPassword-match");

    fireEvent.change(password, { target: { value: "Password?" } });
    expect(screen.queryByText("Passwords match.")).not.toBeInTheDocument();
  });

  it("offers password visibility on login without applying registration requirements", () => {
    render(<AuthForm kind="login" />);

    expect(screen.queryByRole("list", { name: "Password requirements" })).not.toBeInTheDocument();
    const remember = screen.getByRole("checkbox", { name: "Remember me" });
    expect(remember).toBeEnabled();
    expect(remember).toBeChecked();
    fireEvent.click(remember);
    expect(remember).not.toBeChecked();
    const password = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("keeps corrected registration actions and required consent", () => {
    render(<AuthForm kind="register" />);

    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "I agree to terms & conditions" })).not.toBeChecked();
  });
});

function requirement(name: string): HTMLElement {
  const item = document.querySelector(`[data-requirement="${name}"]`);
  if (!(item instanceof HTMLElement)) throw new Error(`Missing ${name} password requirement`);
  return item;
}
