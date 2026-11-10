import { describe, expect, it } from "vitest";
import { createTaskSchema, loginSchema, registerSchema, updateTaskSchema } from "./schemas.js";

describe("registration validation", () => {
  it("normalizes email addresses", () => {
    const result = registerSchema.parse({
      name: "Donald Mwashegha",
      email: "DONALD@example.com",
      password: "a-strong-password"
    });
    expect(result.email).toBe("donald@example.com");
  });

  it("rejects weak passwords", () => {
    expect(registerSchema.safeParse({
      name: "Donald",
      email: "donald@example.com",
      password: "short"
    }).success).toBe(false);
  });
});

describe("task validation", () => {
  it("applies a default priority", () => {
    expect(createTaskSchema.parse({ title: "Prepare the monthly report" }).priority).toBe("MEDIUM");
  });

  it("rejects empty task updates", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid login emails", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "password" }).success).toBe(false);
  });
});
