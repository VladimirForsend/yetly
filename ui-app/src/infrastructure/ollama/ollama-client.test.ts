import { describe, expect, it } from "vitest";
import type { OllamaModel } from "../../features/ai/types";
import { choosePreferredOllamaModel } from "./ollama-client";

function model(name: string): OllamaModel {
  return { name, model: name, capabilities: [] };
}

describe("Ollama model preference", () => {
  it("keeps an explicitly selected model when it is still available", () => {
    const models = [model("gemma3:12b-cloud"), model("qwen3-coder:480b-cloud")];
    expect(choosePreferredOllamaModel(models, "qwen3-coder:480b-cloud")).toBe("qwen3-coder:480b-cloud");
  });

  it("prefers an available Gemma cloud model", () => {
    const models = [model("qwen3-coder:480b-cloud"), model("gemma3:12b-cloud")];
    expect(choosePreferredOllamaModel(models)).toBe("gemma3:12b-cloud");
  });

  it("uses another available family when Gemma is unavailable", () => {
    const models = [model("qwen3-coder:480b-cloud"), model("gpt-oss:120b-cloud")];
    expect(choosePreferredOllamaModel(models)).toBe("qwen3-coder:480b-cloud");
  });
});
