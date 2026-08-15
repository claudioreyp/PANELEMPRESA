import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money, Status } from "./ui";

describe("admin shared UI", () => {
  it("renders safe operational values", () => {
    render(<div><Money value={1250.5} /><Status value="suspended" /></div>);
    expect(screen.getByText(/S\/\s*1[,.]250[,.]50/)).toBeInTheDocument();
    expect(screen.getByText("suspended")).toHaveClass("status-suspended");
  });
});
