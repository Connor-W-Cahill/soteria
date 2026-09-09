import { describe, expect, it } from "vitest";

import { homePathFor, NAV_ITEMS, navItemsFor } from "./AppShell";

describe("navItemsFor", () => {
  it("hides account-only tabs when signed out but keeps the public ones", () => {
    const labels = navItemsFor("anonymous").map((i) => i.label);

    expect(labels).toContain("Password Tools");
    expect(labels).toContain("Learn");
    expect(labels).not.toContain("Dashboard");
    expect(labels).not.toContain("Questionnaire");
    expect(labels).not.toContain("Software");
    expect(labels).not.toContain("Recommendations");
  });

  it("shows every tab when authenticated", () => {
    expect(navItemsFor("authenticated")).toEqual(NAV_ITEMS);
  });

  it("only ever exposes Password Tools and Learn anonymously", () => {
    // Guards against a new tab being added without an accountOnly decision.
    expect(navItemsFor("anonymous").every((i) => i.accountOnly === false)).toBe(
      true,
    );
    expect(navItemsFor("anonymous")).toHaveLength(2);
  });
});

describe("homePathFor", () => {
  it("sends anonymous visitors to the tools, not to a hidden dashboard", () => {
    expect(homePathFor("anonymous")).toBe("/password-tools");
    expect(
      navItemsFor("anonymous").some((i) => i.to === homePathFor("anonymous")),
    ).toBe(true);
  });

  it("sends signed-in visitors to the dashboard", () => {
    expect(homePathFor("authenticated")).toBe("/dashboard");
  });
});
