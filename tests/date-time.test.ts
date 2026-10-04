import { it, expect } from "vitest";
import { dateKey } from "../components/DateTime";
it("filters closing dates in account timezone rather than browser timezone", () => {
  expect(dateKey("2026-09-22T01:00:00Z", "America/New_York")).toBe(
    "2026-09-21",
  );
  expect(dateKey("2026-09-22T01:00:00Z", "Asia/Dubai")).toBe("2026-09-22");
});
