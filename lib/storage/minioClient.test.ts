import { describe, expect, it } from "vitest";
import { expensePhotoObjectPath } from "./minioClient";

describe("expensePhotoObjectPath", () => {
  it("construit le chemin company_id/expense_id.jpg", () => {
    expect(expensePhotoObjectPath("c1", "e1")).toBe("c1/e1.jpg");
  });
});
