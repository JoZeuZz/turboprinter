import { useEffect, useRef, useState } from "react";
import { Clock3, PlusCircle, Settings, ChevronDown, Plus, Youtube, Check } from "lucide-react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";
import { SidebarRowMenu } from "./SidebarRowMenu";
import { videoApi } from "../../api/video";
import { useConfigStore } from "../../store/useConfigStore";
import { configApi } from "../../api/config";

interface ProjectRow {
  project_id: string;
  topic: string | null;
  updated_at: string;
}

export function ProjectSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: activeProjectId } = useParams();
  const { drafts, currentDraftId, startDraft, selectDraft, renameDraft, duplicateDraft, removeDraft } =
    useProjectHistoryStore();
  const workspaceReset = useProjectWorkspaceStore((s) => s.reset);
  const setTopic = useProjectWorkspaceStore((s) => s.setTopic);
  const projectReset = useProjectStore((s) => s.reset);
  const videoReset = useVideoStore((s) => s.reset);
  const setVideo = useVideoStore((s) => s.set);
  const taskId = useProjectWorkspaceStore((s) => s.taskId);
  const taskState = useProjectWorkspaceStore((s) => s.taskStatus?.state);
  const topic = useProjectWorkspaceStore((s) => s.topic);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Tracks whether the in-progress rename has already been resolved (committed
  // or cancelled) so that the Escape->setRenamingId(null)->onBlur chain and the
  // Enter->commitRename->setRenamingId(null)->onBlur chain don't double-fire.
  const renameResolutionRef = useRef<"idle" | "committed" | "cancelled">("idle");

  // YouTube Switcher States
  const [youtubeChannels, setYoutubeChannels] = useState<Array<{ channelId: string; channelName: string }>>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const { setConfig } = useConfigStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getProfileGradient = (channelId: string) => {
    const gradients = [
      "from-red-500 to-rose-600 text-white",
      "from-indigo-500 to-violet-600 text-white",
      "from-emerald-500 to-teal-600 text-white",
      "from-amber-500 to-orange-600 text-white",
      "from-cyan-500 to-blue-600 text-white",
      "from-fuchsia-500 to-pink-600 text-white",
    ];
    if (!channelId) return "from-zinc-600 to-zinc-700 text-zinc-300";
    let hash = 0;
    for (let i = 0; i < channelId.length; i++) {
      hash = channelId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const fetchYouTubeStatus = () => {
    videoApi.getYouTubeStatus()
      .then((res) => {
        if (res.is_linked) {
          setYoutubeChannels(res.channels || []);
          setActiveChannelId(res.active_channel_id || null);
          setActiveChannelName(res.channel_name || null);
        } else {
          setYoutubeChannels([]);
          setActiveChannelId(null);
          setActiveChannelName(null);
        }
      })
      .catch(console.error);
  };

  const handleSelectChannel = async (channelId: string) => {
    try {
      await videoApi.selectYouTubeChannel(channelId);
      fetchYouTubeStatus();
      const cfg = await configApi.get();
      setConfig(cfg);
      setIsDropdownOpen(false);
    } catch (e) {
      console.error("Error selecting channel from sidebar:", e);
    }
  };

  const handleConnectChannel = async () => {
    setIsLinking(true);
    try {
      const { url } = await videoApi.getYouTubeAuthUrl();
      const popup = window.open(url, "youtube_oauth", "width=600,height=700");
      if (!popup) {
        alert("Por favor habilita las ventanas emergentes (popups) para vincular tu canal de YouTube.");
      }
    } catch (err: any) {
      alert(err.message || "Error al obtener URL de autenticación.");
    } finally {
      setIsLinking(false);
    }
  };

  const refreshProjects = () => {
    projectsApi
      .listProjects(30)
      .then((response) => setProjects(response.projects))
      .catch((error) => {
        if (error instanceof ApiError && error.status === 404) setProjects([]);
      });
  };

  useEffect(() => {
    refreshProjects();
  }, [location.pathname, taskId, taskState, topic]);

  useEffect(() => {
    fetchYouTubeStatus();

    // Listen for OAuth messages from popup to reload status automatically
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "YOUTUBE_AUTH_SUCCESS") {
        fetchYouTubeStatus();
        configApi.get().then(setConfig).catch(console.error);
      }
    };
    window.addEventListener("message", handleMessage);

    // Close dropdown on click outside
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [setConfig]);

  const handleNew = () => {
    workspaceReset();
    projectReset();
    videoReset();
    startDraft();
    setTopic("Untitled project");
    setVideo("video_subject", "");
    navigate("/project/new");
  };

  const handleOpenDraft = (draftId: string) => {
    const draft = selectDraft(draftId);
    if (!draft) {
      return;
    }
    workspaceReset();
    projectReset();
    videoReset();
    setTopic(draft.topic);
    setVideo("video_subject", draft.topic === "Untitled project" ? "" : draft.topic);
    navigate("/project/new");
  };

  const rows = [
    ...drafts,
    ...projects.filter(
      (project) => !drafts.some((draft) => draft.project_id === project.project_id)
    ),
  ].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );

  const commitRename = (id: string, isDraft: boolean) => {
    // Guard against double-commit: Enter already resolved this rename and the
    // blur that follows the resulting unmount should be a no-op.
    if (renameResolutionRef.current !== "idle") return;
    renameResolutionRef.current = "committed";
    const value = renameValue.trim();
    setRenamingId(null);
    if (!value) return;
    if (isDraft) {
      renameDraft(id, value);
    } else {
      projectsApi.renameProject(id, value).then(refreshProjects).catch(() => {});
    }
  };

  const cancelRename = () => {
    // Escape resolves the rename as cancelled so the blur triggered by the
    // input unmounting skips commitRename entirely, discarding the edit.
    renameResolutionRef.current = "cancelled";
    setRenamingId(null);
  };

  const handleDuplicate = (id: string, isDraft: boolean) => {
    if (isDraft) {
      duplicateDraft(id);
    } else {
      projectsApi
        .duplicateProject(id)
        .then((res) => {
          refreshProjects();
          navigate(`/project/${res.project_id}`);
        })
        .catch(() => {});
    }
  };

  const handleDelete = (id: string, isDraft: boolean) => {
    const wasActive = isDraft
      ? currentDraftId === id
      : id === activeProjectId;
    if (isDraft) {
      // Drafts are local-only; no API call, so the reset+navigate can stay
      // synchronous.
      removeDraft(id);
      if (wasActive) {
        workspaceReset();
        projectReset();
        videoReset();
        navigate("/project/new");
      }
      return;
    }
    projectsApi
      .deleteProject(id)
      .then(() => {
        refreshProjects();
        if (wasActive) {
          workspaceReset();
          projectReset();
          videoReset();
          navigate("/project/new");
        }
      })
      .catch(() => {
        // Delete failed: re-sync the sidebar so the row reappears, and skip
        // the reset+navigate so the user isn't bounced with no feedback.
        refreshProjects();
      });
  };

  return (
    <nav className="flex h-screen w-48 flex-col border-r border-border bg-surface">
      {/* Netflix-style YouTube profile switcher */}
      <div className="relative border-b border-border" ref={dropdownRef}>
        {youtubeChannels.length > 0 ? (
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-surface-2 transition-all text-left outline-none group animate-fade-in"
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded bg-gradient-to-br ${getProfileGradient(activeChannelId || "")} text-[11px] font-bold uppercase shadow-sm select-none`}>
              {activeChannelName ? activeChannelName.slice(0, 2) : "YT"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-foreground truncate group-hover:text-red-400 transition-colors leading-tight">
                {activeChannelName}
              </span>
              <span className="block text-[9px] text-zinc-500 truncate mt-0.5">
                Cambiar canal
              </span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-surface-2 transition-all text-left outline-none group animate-fade-in"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-gradient-to-br from-zinc-700 to-zinc-800 text-[10px] font-bold text-zinc-400 shadow-sm select-none border border-neutral-800">
              <Youtube className="h-3.5 w-3.5 text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-zinc-400 truncate leading-tight group-hover:text-red-400 transition-colors">
                Vincular YouTube
              </span>
              <span className="block text-[9px] text-zinc-500 truncate mt-0.5">
                Sin canal activo
              </span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
          </button>
        )}

        {isDropdownOpen && (
          <div className="absolute left-1.5 right-1.5 top-[calc(100%-4px)] z-50 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md p-2 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 px-2 py-1 mb-1 select-none">
              {youtubeChannels.length > 0 ? "Cambiar de Perfil" : "YouTube no vinculado"}
            </span>
            {youtubeChannels.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {youtubeChannels.map((ch) => {
                  const isActive = ch.channelId === activeChannelId;
                  return (
                    <button
                      key={ch.channelId}
                      onClick={() => !isActive && handleSelectChannel(ch.channelId)}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors group/item ${
                        isActive 
                          ? "bg-red-500/10 text-red-400 font-medium" 
                          : "text-zinc-300 hover:bg-neutral-800/60"
                      }`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br ${getProfileGradient(ch.channelId)} text-[9px] font-bold uppercase`}>
                        {ch.channelName.slice(0, 2)}
                      </div>
                      <span className="flex-1 truncate">{ch.channelName}</span>
                      {isActive && <Check className="h-3 w-3 text-red-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                onClick={handleConnectChannel}
                disabled={isLinking}
                className="flex w-full items-center gap-2 px-2 py-2 rounded-lg text-left text-xs bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-all font-medium mb-1"
              >
                <Youtube className="h-3.5 w-3.5 shrink-0 text-red-500" />
                <span>{isLinking ? "Conectando..." : "Vincular Primer Canal"}</span>
              </button>
            )}

            <div className="mt-1.5 pt-1.5 border-t border-neutral-800 space-y-1">
              {youtubeChannels.length > 0 && (
                <button
                  onClick={handleConnectChannel}
                  disabled={isLinking}
                  className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-zinc-400 hover:text-zinc-100 hover:bg-neutral-800/60 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>{isLinking ? "Vinculando..." : "Vincular otro canal"}</span>
                </button>
              )}
              <button
                onClick={() => setIsDropdownOpen(false)}
                className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span className="w-3.5 flex justify-center text-center text-[10px]">✕</span>
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={handleNew}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
        >
          <PlusCircle className="h-4 w-4 text-accent shrink-0" />
          {t("sidebar.newProject")}
        </button>

        <div className="mt-2 space-y-0.5" id="recent-projects">
          {rows.map((project, index) => {
              const isDraft = "kind" in project && project.kind === "draft";
              const isActive = isDraft
                ? location.pathname === "/project/new" &&
                  currentDraftId === project.project_id
                : project.project_id === activeProjectId;
              const openRow = () =>
                isDraft
                  ? handleOpenDraft(project.project_id)
                  : navigate(`/project/${project.project_id}`);
              const projectNum = rows.length - index;
              return (
                <div
                  key={project.project_id}
                  role="button"
                  tabIndex={0}
                  data-testid="sidebar-row"
                  aria-current={isActive ? "true" : undefined}
                  onClick={openRow}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openRow();
                    }
                  }}
                  className={`group flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-surface-2 text-foreground"
                      : "text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                  title={project.topic ?? project.project_id}
                >
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/45 group-hover:text-accent" />
                  <span className="min-w-0 flex-1">
                    {renamingId === project.project_id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(project.project_id, isDraft);
                          if (e.key === "Escape") cancelRename();
                        }}
                        onBlur={() => commitRename(project.project_id, isDraft)}
                        className="w-full rounded bg-surface-2 px-1 text-sm text-foreground outline-none"
                      />
                    ) : (
                      <>
                        <span className="flex items-center justify-between gap-1.5 min-w-0">
                          <span className="truncate">{project.topic || project.project_id}</span>
                          {isDraft && (
                            <span className="text-accent/90 font-bold text-[10px] bg-accent/10 px-1 py-0.5 rounded shrink-0">
                              #{projectNum}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-foreground/40">
                          {isDraft ? t("sidebar.draft") : new Date(project.updated_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </span>
                  <SidebarRowMenu
                    label={project.topic || project.project_id}
                    onRename={() => {
                      renameResolutionRef.current = "idle";
                      setRenameValue(project.topic || "");
                      setRenamingId(project.project_id);
                    }}
                    onDuplicate={() => handleDuplicate(project.project_id, isDraft)}
                    onDelete={() => handleDelete(project.project_id, isDraft)}
                  />
                </div>
              );
            })}
        </div>
      </div>

      <div className="border-t border-border p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground hover:bg-surface-2"
            }`
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          {t("nav.config")}
        </NavLink>
      </div>
    </nav>
  );
}
