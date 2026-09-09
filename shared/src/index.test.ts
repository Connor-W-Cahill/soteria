import { describe, expect, it } from "vitest";

import { APPLICATION_NAME } from "./index";

describe("shared package", () => {
  it("exports the application name", () => {
    expect(APPLICATION_NAME).toBe("Soteria");
  });
});
