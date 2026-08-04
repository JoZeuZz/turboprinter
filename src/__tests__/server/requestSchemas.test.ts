import { describe, expect, it } from "vitest";
import { configPatchSchema, projectPatchSchema, timelineItemSchema } from "../../server/requestSchemas";

describe("projectPatchSchema", () => {
  it("accepts a realistic timeline-save payload shaped like ScriptPanel.tsx's replaceTimeline call", () => {
    const payload = {
      project_id: "proj-1",
      script: "Había una vez...",
      topic: "gatos misteriosos",
      language: "es",
      params: {
        video_subject: "gatos misteriosos",
        video_aspect: "9:16",
        video_clip_duration: 5,
      },
    };
    const result = projectPatchSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("accepts a realistic full TimelineProject payload with tracks/items", () => {
    const payload = {
      schema_version: "1.0",
      task_id: "task-123",
      title: "Mi proyecto",
      script: "guión",
      narration_audio_path: "/api/v1/projects/proj-1/assets/narration.mp3",
      tracks: [
        {
          id: "track-1",
          type: "video",
          name: "Video principal",
          items: [
            {
              id: "item-1",
              source_url: "https://videos.pexels.com/clip.mp4",
              asset_url: "/api/v1/projects/proj-1/assets/clip.mp4",
              start_sec: 0,
              duration_sec: 5,
            },
          ],
        },
      ],
      metadata: { some_future_field: true },
      params: { video_subject: "gatos", video_niche: "curiosidades" },
    };
    const result = projectPatchSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects a source_url that isn't a relative path or an http(s) URL", () => {
    const payload = {
      tracks: [
        {
          id: "track-1",
          items: [{ id: "item-1", source_url: "../../etc/passwd" }],
        },
      ],
    };
    const result = projectPatchSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an asset_url using a file:// scheme", () => {
    const payload = {
      tracks: [
        {
          id: "track-1",
          items: [{ id: "item-1", asset_url: "file:///etc/passwd" }],
        },
      ],
    };
    const result = projectPatchSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a narration_audio_path with no scheme and no leading slash", () => {
    const result = projectPatchSchema.safeParse({
      narration_audio_path: "../../../etc/passwd",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a null narration_audio_path", () => {
    const result = projectPatchSchema.safeParse({ narration_audio_path: null });
    expect(result.success).toBe(true);
  });
});

describe("timelineItemSchema", () => {
  it("accepts a relative asset_url", () => {
    expect(timelineItemSchema.safeParse({ id: "x", asset_url: "/local/clip.mp4" }).success).toBe(true);
  });
  it("accepts an http(s) source_url", () => {
    expect(timelineItemSchema.safeParse({ id: "x", source_url: "http://example.com/clip.mp4" }).success).toBe(true);
  });
});

describe("configPatchSchema", () => {
  it("accepts a realistic Settings-page payload", () => {
    const payload = {
      app: {
        video_source: "pexels",
        pexels_api_keys: ["key-1"],
        llm_provider: "openai",
      },
      youtube: {
        client_id: "some-client-id.apps.googleusercontent.com",
        api_key: "some-secret",
      },
      tiktok: {
        client_id: "tiktok-client-id",
        client_secret: "tiktok-secret",
        verification_filename: "tiktok-verify.txt",
        verification_content: "verify-me",
      },
      ui: { language: "es", hide_log: false },
    };
    const result = configPatchSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects youtube replaced with a string instead of an object", () => {
    const result = configPatchSchema.safeParse({ youtube: "not-an-object" });
    expect(result.success).toBe(false);
  });

  it("rejects tiktok replaced with an array instead of an object", () => {
    const result = configPatchSchema.safeParse({ tiktok: ["not", "an", "object"] });
    expect(result.success).toBe(false);
  });

  it("accepts an empty patch", () => {
    expect(configPatchSchema.safeParse({}).success).toBe(true);
  });
});
