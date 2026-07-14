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
    ["login", "/assets/login.png", "1269", "1240"],
    ["register", "/assets/registration.png", "1928", "1422"],
  ] as const)("renders the reference %s composition", (kind, artwork, width, height) => {
    const { container } = render(<AuthShell kind={kind}><p>Form content</p></AuthShell>);

    expect(container.querySelector("main")).toHaveClass("auth-shell", `auth-shell--${kind}`);
    expect(container.querySelector(".auth-layout")).toContainElement(container.querySelector(".auth-card"));
    const image = container.querySelector(`.auth-artwork img[src="${artwork}"]`);
    expect(image).toHaveAttribute("width", width);
    expect(image).toHaveAttribute("height", height);
    expect(container.querySelectorAll(".auth-shape")).toHaveLength(3);
  });
});
