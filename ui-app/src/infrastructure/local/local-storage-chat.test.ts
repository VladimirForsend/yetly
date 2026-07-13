import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageWorkspaceAdapter } from "./local-storage-workspace-adapter";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("local channel moderation", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
  });

  it("edits and deletes an own message", async () => {
    const adapter = new LocalStorageWorkspaceAdapter();
    await adapter.createWorkspace({ userName: "Vladimir", organizationName: "Yetly", role: "Owner" });
    const channelId = await adapter.createChatChannel("producto");
    await adapter.sendChatMessage(channelId, "Mensaje inicial");
    let snapshot = await adapter.getSnapshot();
    const message = snapshot!.chatMessages.find((item) => item.conversationId === channelId)!;

    await adapter.updateChatMessage(message.id, "Mensaje corregido");
    snapshot = await adapter.getSnapshot();
    expect(snapshot!.chatMessages.find((item) => item.id === message.id)).toMatchObject({ body: "Mensaje corregido" });
    expect(snapshot!.chatMessages.find((item) => item.id === message.id)?.updatedAt).toBeTruthy();

    await adapter.deleteChatMessage(message.id);
    snapshot = await adapter.getSnapshot();
    expect(snapshot!.chatMessages.some((item) => item.id === message.id)).toBe(false);
  });

  it("renames and removes a channel together with its messages", async () => {
    const adapter = new LocalStorageWorkspaceAdapter();
    await adapter.createWorkspace({ userName: "Vladimir", organizationName: "Yetly", role: "Owner" });
    const channelId = await adapter.createChatChannel("general-ventas");
    await adapter.sendChatMessage(channelId, "Mensaje temporal");

    await adapter.updateChatChannel(channelId, "ventas");
    expect((await adapter.getSnapshot())!.chatConversations.find((item) => item.id === channelId)?.name).toBe("ventas");

    await adapter.deleteChatChannel(channelId);
    const snapshot = await adapter.getSnapshot();
    expect(snapshot!.chatConversations.some((item) => item.id === channelId)).toBe(false);
    expect(snapshot!.chatMessages.some((item) => item.conversationId === channelId)).toBe(false);
  });
});
