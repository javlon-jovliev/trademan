import { describe, expect, it } from "vitest";
import { sessionExpiry, sessionIsValid } from "../server/session-policy";
const login = new Date("2026-10-07T00:00:00Z");
const at = (minutes: number) => new Date(+login + minutes * 60000);
describe("session deadlines", () => {
  it("starts with a 30 minute idle deadline and expires at the boundary", () => {
    const session = {
      createdAt: login,
      expiresAt: sessionExpiry(login, login),
    };
    expect(session.expiresAt).toEqual(at(30));
    expect(sessionIsValid(session, at(29))).toBe(true);
    expect(sessionIsValid(session, at(30))).toBe(false);
  });
  it("extends on interaction but caps the deadline at five hours", () => {
    expect(sessionExpiry(login, at(20))).toEqual(at(50));
    expect(sessionExpiry(login, at(290))).toEqual(at(300));
    expect(
      sessionIsValid({ createdAt: login, expiresAt: at(400) }, at(300)),
    ).toBe(false);
  });
});
