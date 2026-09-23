import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActionItems } from "./action-items";

const TASKS = JSON.stringify([
  { title: "Fix Login Timeout on Proctor App", tag: "JIRA-402", tagStyle: "ticket", priority: "high", dueDate: "today" },
  { title: "Q1 Security Compliance Review", tag: "Governance", tagStyle: "category", priority: "Pending Approval", dueDate: "today+7" },
]);

const renderWidget = (props: Record<string, unknown> = {}) =>
  render(<ActionItems contentLanguage="en_US" tasksjson={TASKS} {...props} />);

describe("ActionItems", () => {
  it("renders every task from the JSON with its tag, priority and due date", () => {
    renderWidget();

    expect(screen.getByText("Fix Login Timeout on Proctor App")).toBeInTheDocument();
    expect(screen.getByText("Q1 Security Compliance Review")).toBeInTheDocument();
    expect(screen.getByText("JIRA-402")).toBeInTheDocument();
    expect(screen.getByText("Governance")).toBeInTheDocument();
    expect(screen.getByText("High Priority")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("passes an unrecognised priority through as status text", () => {
    renderWidget();
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });

  it("uses the configured title and shows the pending count", () => {
    renderWidget({ widgettitle: "Team Action Items" });

    expect(screen.getByText("Team Action Items")).toBeInTheDocument();
    expect(screen.getByText("2 Pending")).toBeInTheDocument();
  });

  it("checks off a task, strikes it through and updates the count", async () => {
    const user = userEvent.setup();
    renderWidget();

    const checkbox = screen.getByRole("checkbox", { name: "Fix Login Timeout on Proctor App" });
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1 Pending")).toBeInTheDocument();
  });

  it("unchecks a task again and restores the count", async () => {
    const user = userEvent.setup();
    renderWidget();

    const checkbox = screen.getByRole("checkbox", { name: "Fix Login Timeout on Proctor App" });
    await user.click(checkbox);
    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("2 Pending")).toBeInTheDocument();
  });

  it("celebrates once every task is done", async () => {
    const user = userEvent.setup();
    renderWidget();

    for (const checkbox of screen.getAllByRole("checkbox")) {
      await user.click(checkbox);
    }

    expect(screen.getByText("All Done!")).toBeInTheDocument();
  });

  it("saves a note against the task it was written on", async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getAllByRole("button", { name: "+ Add Note" })[0]);

    const textarea = screen.getByLabelText("Add a note to Fix Login Timeout on Proctor App");
    await user.type(textarea, "Waiting on the auth team.");
    await user.click(screen.getByRole("button", { name: "Save Update" }));

    const item = screen.getByText("Fix Login Timeout on Proctor App").closest("li") as HTMLElement;
    expect(within(item).getByText("Waiting on the auth team.")).toBeInTheDocument();
    expect(within(item).getByText(/^Today at /)).toBeInTheDocument();
    // The editor closes once the note is saved.
    expect(screen.queryByRole("button", { name: "Save Update" })).not.toBeInTheDocument();
  });

  it("will not save an empty note", async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getAllByRole("button", { name: "+ Add Note" })[0]);
    expect(screen.getByRole("button", { name: "Save Update" })).toBeDisabled();
  });

  it("falls back to the empty state when the JSON is malformed", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    renderWidget({ tasksjson: "{ not json ]" });

    expect(screen.getByText("Nothing needs your attention")).toBeInTheDocument();
    expect(screen.queryByText(/Pending/)).not.toBeInTheDocument();
    (console.error as jest.Mock).mockRestore();
  });

  it("falls back to the empty state when the JSON is not an array", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    renderWidget({ tasksjson: '{"title":"Lonely task"}' });

    expect(screen.getByText("Nothing needs your attention")).toBeInTheDocument();
    (console.error as jest.Mock).mockRestore();
  });

  it("skips entries without a usable title", () => {
    renderWidget({ tasksjson: '[{"title":"Real task"},{"title":"   "},{"tag":"NO-TITLE"},null]' });

    expect(screen.getByText("Real task")).toBeInTheDocument();
    expect(screen.queryByText("NO-TITLE")).not.toBeInTheDocument();
    expect(screen.getByText("1 Pending")).toBeInTheDocument();
  });

  it("applies the dark surface when dark mode is on", () => {
    const { container } = renderWidget({ darkmode: "true" });
    const root = container.querySelector(".sbai") as HTMLElement;

    expect(root.style.getPropertyValue("--sbai-surface")).toBe("#15161a");
    expect(root.style.getPropertyValue("--sbai-text")).toBe("#eceef2");
  });

  it("applies the light surface by default", () => {
    const { container } = renderWidget();
    const root = container.querySelector(".sbai") as HTMLElement;

    expect(root.style.getPropertyValue("--sbai-surface")).toBe("#ffffff");
    expect(root.style.getPropertyValue("--sbai-text")).toBe("#333333");
  });

  it("lifts a too-dark brand color so the header still reads on a dark card", () => {
    const { container } = renderWidget({ darkmode: "true", primarycolor: "#0d004c" });
    const root = container.querySelector(".sbai") as HTMLElement;

    // The header fill is lifted off the near-black surface...
    expect(root.style.getPropertyValue("--sbai-primary").toLowerCase()).not.toBe("#0d004c");
    // ...and on-surface text derived from it is lifted further still.
    expect(root.style.getPropertyValue("--sbai-status-text").toLowerCase()).not.toBe("#0d004c");
  });

  it("keeps the brand color literal on a light card", () => {
    const { container } = renderWidget({ primarycolor: "#0d004c" });
    const root = container.querySelector(".sbai") as HTMLElement;

    expect(root.style.getPropertyValue("--sbai-primary").toLowerCase()).toBe("#0d004c");
  });

  it("leaves a readable brand color untouched", () => {
    const { container } = renderWidget({ primarycolor: "#512eab" });
    const root = container.querySelector(".sbai") as HTMLElement;

    expect(root.style.getPropertyValue("--sbai-status-text").toLowerCase()).toBe("#512eab");
  });

  it("honours an explicit background color over the surface default", () => {
    const { container } = renderWidget({ backgroundcolor: "#fef6ff" });
    const root = container.querySelector(".sbai") as HTMLElement;

    expect(root.style.getPropertyValue("--sbai-surface")).toBe("#fef6ff");
  });

  it("hides completed tasks when configured to", async () => {
    const user = userEvent.setup();
    renderWidget({ showcompleted: "false" });

    const item = screen.getByText("Fix Login Timeout on Proctor App").closest("li") as HTMLElement;
    expect(item.className).not.toContain("sbai-item--leaving");

    await user.click(screen.getByRole("checkbox", { name: "Fix Login Timeout on Proctor App" }));

    expect(item.className).toContain("sbai-item--leaving");
  });

  it("flags a past due date as overdue", () => {
    renderWidget({ tasksjson: '[{"title":"Overdue thing","dueDate":"today-3"}]' });

    const pill = screen.getByText(/\w{3} \d+/);
    expect(pill.className).toContain("sbai-due--overdue");
  });

  it("clears checkmarks and notes when the task list is re-authored", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWidget();

    await user.click(screen.getByRole("checkbox", { name: "Fix Login Timeout on Proctor App" }));
    expect(screen.getByText("1 Pending")).toBeInTheDocument();

    rerender(<ActionItems contentLanguage="en_US" tasksjson={'[{"title":"A brand new task"}]'} />);

    expect(screen.getByText("A brand new task")).toBeInTheDocument();
    expect(screen.getByText("1 Pending")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "A brand new task" })).toHaveAttribute("aria-checked", "false");
  });
});
