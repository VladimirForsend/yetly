import { describe, expect, it } from "vitest";
import { parseAiProposal } from "./ai-proposal-service";

describe("parseAiProposal", () => {
  it("acepta solo acciones permitidas y normaliza sus campos", () => {
    const proposal = parseAiProposal({
      summary: "Plan de rescate",
      actions: [
        { type: "create_task", clientRef: "new-1", title: "Revisar alcance", priority: "urgent", estimateMinutes: 90 },
        { type: "update_project", projectId: "project-1", changes: { status: "on_hold", name: "No permitido" } },
        { type: "delete_task", taskId: "task-1" },
      ],
    });
    expect(proposal?.actions).toHaveLength(2);
    expect(proposal?.actions[0].type).toBe("create_task");
    expect(proposal?.actions[1]).toMatchObject({ type: "update_project", changes: { status: "on_hold" } });
    expect(JSON.stringify(proposal)).not.toContain("delete_task");
  });
});
