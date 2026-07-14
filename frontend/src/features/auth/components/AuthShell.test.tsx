import { cleanup, render } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthShell } from "./AuthShell";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    return createElement("img", imageProps);
  },
}));

afterEach(cleanup);

describe("AuthShell", () => {
  it.each([
    ["login", "/assets/login.png"],
    ["register", "/assets/registration.png"],
  ] as const)("renders the reference %s composition", (kind, artwork) => {
    const { container } = render(<AuthShell kind={kind}><p>Form content</p></AuthShell>);

    expect(container.querySelector("main")).toHaveClass("auth-shell", `auth-shell--${kind}`);
    expect(container.querySelector(".auth-layout")).toContainElement(container.querySelector(".auth-card"));
    expect(container.querySelector(`.auth-artwork img[src="${artwork}"]`)).toBeInTheDocument();
    expect(container.querySelectorAll(".auth-shape")).toHaveLength(3);
  });
});
