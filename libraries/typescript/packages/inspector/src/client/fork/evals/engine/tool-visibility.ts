/**
 * Determines whether a tool is visible to the LLM model.
 * Tools with `_meta.ui.visibility` containing only "app" (or other non-"model" targets)
 * should not be exposed to the model.
 */
export function isToolVisibleToModel(tool: { _meta?: unknown }): boolean {
  if (!tool._meta || typeof tool._meta !== "object") return true;
  const ui = (tool._meta as Record<string, unknown>).ui;
  if (!ui || typeof ui !== "object") return true;
  const visibility = (ui as Record<string, unknown>).visibility;
  return !Array.isArray(visibility) || visibility.some((value) => value === "model");
}
