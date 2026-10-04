import { it, expect } from "vitest";
import { dateKey, dateLabel } from "../components/DateTime";
it("filters closing dates in account timezone rather than browser timezone", () => {
  expect(dateKey("2026-09-22T01:00:00Z", "America/New_York")).toBe(
    "2026-09-21",
  );
  expect(dateKey("2026-09-22T01:00:00Z", "Asia/Dubai")).toBe("2026-09-22");
});

it("renders Uzbek month names consistently without platform locale fallback", () => {
  expect(dateLabel("2026-09-22T01:00:00Z", "America/New_York", "uz")).toBe(
    "21 sen 2026",
  );
  expect(dateLabel("2026-09-22T01:00:00Z", "Asia/Dubai", "en")).toBe(
    "22 Sep 2026",
  );
});
