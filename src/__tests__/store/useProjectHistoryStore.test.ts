import { beforeEach, describe, expect, it } from "vitest";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";

describe("useProjectHistoryStore actions", () => {
  beforeEach(() => {
    useProjectHistoryStore.setState({ currentDraftId: null, drafts: [] });
  });

  it("renameDraft updates topic of the given draft", () => {
    const id = useProjectHistoryStore.getState().startDraft();
    useProjectHistoryStore.getState().renameDraft(id, "  Nuevo nombre  ");
    const draft = useProjectHistoryStore.getState().drafts.find((d) => d.project_id === id);
    expect(draft?.topic).toBe("Nuevo nombre");
  });

  it("renameDraft ignores empty topic", () => {
    const id = useProjectHistoryStore.getState().startDraft();
    useProjectHistoryStore.getState().renameDraft(id, "   ");
    const draft = useProjectHistoryStore.getState().drafts.find((d) => d.project_id === id);
    expect(draft?.topic).toBe("Untitled project");
  });

  it("duplicateDraft creates a new draft with 'Copia de' topic", () => {
    const id = useProjectHistoryStore.getState().startDraft();
    useProjectHistoryStore.getState().renameDraft(id, "Original");
    const newId = useProjectHistoryStore.getState().duplicateDraft(id);
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(id);
    const drafts = useProjectHistoryStore.getState().drafts;
    const copy = drafts.find((d) => d.project_id === newId);
    expect(copy?.topic).toBe("Copia de Original");
    expect(drafts[0].project_id).toBe(newId); // inserted at front
  });

  it("duplicateDraft returns null for unknown id", () => {
    expect(useProjectHistoryStore.getState().duplicateDraft("missing")).toBeNull();
  });
});
