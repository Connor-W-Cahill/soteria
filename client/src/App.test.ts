import { describe, expect, it } from "vitest";

describe("client test runner", () => {
  it("runs with the client workspace", () => {
    expect("Soteria").toBeTruthy();
  });
});
