import { describe, expect, it } from "vitest";
import {
  assertNoActiveTripForBoat,
  assertCanClose,
  nextTripStatus,
  boatStatusForTripStatus,
  TripValidationError,
} from "./tripValidation";

describe("assertNoActiveTripForBoat", () => {
  it("throws when the boat already has a preparing trip", () => {
    expect(() =>
      assertNoActiveTripForBoat([{ id: "t1", status: "preparing" }]),
    ).toThrow(TripValidationError);
  });

  it("throws when the boat already has an at_sea trip", () => {
    expect(() =>
      assertNoActiveTripForBoat([{ id: "t1", status: "at_sea" }]),
    ).toThrow(TripValidationError);
  });

  it("throws when the boat already has a returned (not yet closed) trip", () => {
    expect(() =>
      assertNoActiveTripForBoat([{ id: "t1", status: "returned" }]),
    ).toThrow(TripValidationError);
  });

  it("does not throw when all existing trips are closed", () => {
    expect(() =>
      assertNoActiveTripForBoat([{ id: "t1", status: "closed" }]),
    ).not.toThrow();
  });

  it("does not throw when the only active trip is the one being edited", () => {
    expect(() =>
      assertNoActiveTripForBoat([{ id: "t1", status: "at_sea" }], "t1"),
    ).not.toThrow();
  });

  it("does not throw for a boat with no trips at all", () => {
    expect(() => assertNoActiveTripForBoat([])).not.toThrow();
  });
});

describe("assertCanClose", () => {
  it("throws when actualReturnDate is null", () => {
    expect(() => assertCanClose({ actualReturnDate: null })).toThrow(
      TripValidationError,
    );
  });

  it("does not throw when actualReturnDate is set", () => {
    expect(() =>
      assertCanClose({ actualReturnDate: "2026-08-05" }),
    ).not.toThrow();
  });
});

describe("nextTripStatus", () => {
  it("progresses through the full lifecycle", () => {
    expect(nextTripStatus("preparing")).toBe("at_sea");
    expect(nextTripStatus("at_sea")).toBe("returned");
    expect(nextTripStatus("returned")).toBe("closed");
  });

  it("returns null once closed", () => {
    expect(nextTripStatus("closed")).toBeNull();
  });
});

describe("boatStatusForTripStatus", () => {
  it("maps preparing and at_sea to in_trip", () => {
    expect(boatStatusForTripStatus("preparing")).toBe("in_trip");
    expect(boatStatusForTripStatus("at_sea")).toBe("in_trip");
  });

  it("maps returned to active", () => {
    expect(boatStatusForTripStatus("returned")).toBe("active");
  });

  it("returns null for closed (no boat status change)", () => {
    expect(boatStatusForTripStatus("closed")).toBeNull();
  });
});
