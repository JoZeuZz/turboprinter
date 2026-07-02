import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface DraftProject {
  project_id: string;
  topic: string;
  updated_at: string;
  kind: "draft";
}

interface ProjectHistoryStoreState {
  currentDraftId: string | null;
  drafts: DraftProject[];
  startDraft: () => string;
  selectDraft: (draftId: string) => DraftProject | null;
  updateCurrentDraft: (topic: string) => void;
  removeDraft: (draftId: string | null) => void;
  resetCurrentDraft: () => void;
  renameDraft: (draftId: string, topic: string) => void;
  duplicateDraft: (draftId: string) => string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function createDraft(): DraftProject {
  return {
    project_id: `draft-${crypto.randomUUID()}`,
    topic: "Untitled project",
    updated_at: nowIso(),
    kind: "draft",
  };
}

export const useProjectHistoryStore = create<ProjectHistoryStoreState>()(
  persist(
    (set, get) => ({
      currentDraftId: null,
      drafts: [],

      startDraft: () => {
        const draft = createDraft();
        set((state) => ({
          currentDraftId: draft.project_id,
          drafts: [draft, ...state.drafts],
        }));
        return draft.project_id;
      },

      selectDraft: (draftId) => {
        const draft = get().drafts.find((item) => item.project_id === draftId) ?? null;
        if (draft) {
          set({ currentDraftId: draft.project_id });
        }
        return draft;
      },

      updateCurrentDraft: (topic) => {
        const trimmed = topic.trim();
        const currentDraftId = get().currentDraftId;
        if (!currentDraftId || !trimmed) {
          return;
        }
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.project_id === currentDraftId
              ? { ...draft, topic: trimmed, updated_at: nowIso() }
              : draft
          ),
        }));
      },

      removeDraft: (draftId) => {
        if (!draftId) {
          return;
        }
        set((state) => ({
          currentDraftId:
            state.currentDraftId === draftId ? null : state.currentDraftId,
          drafts: state.drafts.filter((draft) => draft.project_id !== draftId),
        }));
      },

      renameDraft: (draftId, topic) => {
        const trimmed = topic.trim();
        if (!draftId || !trimmed) {
          return;
        }
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.project_id === draftId
              ? { ...draft, topic: trimmed, updated_at: nowIso() }
              : draft
          ),
        }));
      },

      duplicateDraft: (draftId) => {
        const source = get().drafts.find((item) => item.project_id === draftId);
        if (!source) {
          return null;
        }
        const copy: DraftProject = {
          project_id: `draft-${crypto.randomUUID()}`,
          topic: `Copia de ${source.topic}`,
          updated_at: nowIso(),
          kind: "draft",
        };
        set((state) => ({ drafts: [copy, ...state.drafts] }));
        return copy.project_id;
      },

      resetCurrentDraft: () => set({ currentDraftId: null }),
    }),
    {
      name: "mpt-project-history",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
