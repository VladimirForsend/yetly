import { describe, expect, it } from "vitest";
import type { WorkspaceSnapshot } from "../../../application/ports/workspace-port";
import { buildExecutiveContext } from "./executive-context";

const person = { id: "user-1", name: "Vladimir", initials: "VF", role: "Owner", avatarTone: "bg-brand-100" };

function snapshot(): WorkspaceSnapshot {
  return {
    activeOrganization: { id: "org-1", name: "Forsend", initials: "FO", color: "#000", memberRole: "owner" },
    organizations: [],
    currentUser: person,
    projects: [{ id: "project-1", code: "PRJ", name: "Proyecto", owner: person, status: "active", health: "red", healthReason: "Una tarea vencida", progress: 0, targetDate: "2026-08-01", actualMinutes: 120, estimateMinutes: 600, teamName: "General", accent: "#000" }],
    tasks: [{
      id: "task-1", projectId: "project-1", projectCode: "PRJ", title: "Entrega vencida", description: "Descripción", status: "in_progress", priority: "urgent", dueDate: "2026-01-01", estimateMinutes: 600, actualMinutes: 120, assignees: [person], labels: [], blockedReason: "Falta aprobación", completed: false, mode: "standard", createdBy: person.id, canEdit: true, checklist: [], messages: [], attachments: [{ id: "file-1", fileName: "brief.pdf", contentType: "application/pdf", sizeBytes: 100, version: 1, uploadedBy: person, uploadedAt: "2026-07-01", cachedLocally: true }], history: [],
    }],
    teams: [], workload: [{ person, capacityMinutes: 300, assignedMinutes: 600, taskCount: 1, teamName: "General" }], activities: [], notifications: [], weeklyTime: [{ day: "Lun", minutes: 120 }], timeEntries: [], teamMessages: [], chatConversations: [], chatMessages: [], workflowNodePositions: [], workflowConnections: [],
  };
}

describe("buildExecutiveContext", () => {
  it("calcula señales ejecutivas y solo incluye metadatos de adjuntos", () => {
    const result = buildExecutiveContext(snapshot(), { type: "project", projectId: "project-1" });
    const payload = JSON.parse(result.serialized);
    expect(payload.signals.overdue).toBe(1);
    expect(payload.signals.blocked).toBe(1);
    expect(payload.signals.overloadedPeople[0].name).toBe("Vladimir");
    expect(payload.tasks[0].attachments[0].fileName).toBe("brief.pdf");
    expect(result.serialized).not.toContain("cachedLocally");
    expect(result.serialized).not.toContain("task-1");
    expect(result.serialized).not.toContain("project-1");
    expect(result.serialized).not.toContain("user-1");
    expect(result.serialized).not.toContain("file-1");
    expect(result.metadata.includedTasks).toBe(1);
  });
});
