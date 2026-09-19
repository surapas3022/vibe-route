import { useCallback, useEffect, useRef, useState } from "react";
import { api, clearAuthSession, hasAuthSession, type AuthUser } from "./api";
import { AssistantBar } from "./components/AssistantBar";
import { AuthScreen } from "./components/AuthScreen";
import { ChatHistory } from "./components/ChatHistory";
import { ChatThread } from "./components/ChatThread";
import { ConfirmModal } from "./components/ConfirmModal";
import { Filters } from "./components/Filters";
import { PlaceCard } from "./components/PlaceCard";
import { PlaceMap } from "./components/PlaceMap";
import { TeamPanel } from "./components/TeamPanel";
import { VibeComposer } from "./components/VibeComposer";
import { useColumnResize } from "./hooks/useColumnResize";
import {
  CHIANG_MAI,
  DEFAULT_REGION,
  DEMO_CHIPS,
  EXPLAINING_COPY,
  LOADING_COPY,
  type AssistantStatus,
  type ChatSummary,
  type ChatTurn,
  type HealthResponse,
  type Place,
  type SearchResponse,
} from "./types";

const PENDING_TURN = "pending";

function replacePendingTurn(turns: ChatTurn[], next: ChatTurn): ChatTurn[] {
  const withoutPending = turns.filter((turn) => turn.id !== PENDING_TURN);
  if (withoutPending.some((turn) => turn.id === next.id)) {
    return withoutPending.map((turn) => (turn.id === next.id ? next : turn));
  }
  return [...withoutPending, next];
}

const FALLBACK_ASSISTANT: AssistantStatus = {
  level: "off",
  label: "ผู้ช่วยยังไม่พร้อม",
  detail: "กำลังเชื่อม API",
};

function roleLabel(role: AuthUser["role"]): string {
  return role === "admin" ? "ผู้ดูแล" : "ผู้ใช้ทั่วไป";
}

type ConfirmAction =
  | { kind: "logout" }
  | { kind: "delete-chat"; chat: ChatSummary }
  | { kind: "delete-all" };

function confirmCopy(action: ConfirmAction): { title: string; description: string; confirmLabel: string } {
  if (action.kind === "logout") {
    return {
      title: "ออกจากระบบ?",
      description: "ต้องเข้าสู่ระบบอีกครั้งก่อนค้นต่อ ประวัติแชทยังอยู่กับบัญชีนี้",
      confirmLabel: "ออกจากระบบ",
    };
  }
  if (action.kind === "delete-all") {
    return {
      title: "เอาออกจากประวัติทั้งหมด?",
      description:
        "แชทจะหายจากรายการของคุณ กู้กลับมาที่หน้านี้ไม่ได้ ระบบยังเก็บข้อความไว้เพื่อพัฒนาการค้นหา",
      confirmLabel: "เอาออกจากประวัติ",
    };
  }
  return {
    title: "เอาแชทนี้ออกจากประวัติ?",
    description: `แชท «${action.chat.title || "ไม่มีชื่อ"}» จะหายจากรายการของคุณ ระบบยังเก็บข้อความไว้เพื่อพัฒนาการค้นหา`,
    confirmLabel: "เอาออกจากประวัติ",
  };
}

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (!hasAuthSession()) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        clearAuthSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="auth-screen">
        <p className="auth-lede">กำลังตรวจเซสชัน</p>
      </div>
    );
  }
  if (!user) {
    return <AuthScreen onAuthed={setUser} />;
  }
  return (
    <Workbench
      key={user.id}
      user={user}
      onLogout={() => {
        clearAuthSession();
        setUser(null);
      }}
    />
  );
}

function Workbench({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [assistant, setAssistant] = useState<AssistantStatus>(FALLBACK_ASSISTANT);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [province, setProvince] = useState("");
  const [preferSecondary, setPreferSecondary] = useState(true);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [lastRequest, setLastRequest] = useState("ยังไม่มีการค้น");
  const [lastResponse, setLastResponse] = useState("ยังไม่มี response");
  const [ratings, setRatings] = useState<Record<string, 1 | -1>>({});
  const [layoutTick, setLayoutTick] = useState(0);
  const uploadAttId = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchGen = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === "admin";
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const bumpLayout = useCallback(() => setLayoutTick((n) => n + 1), []);
  useColumnResize({ onChange: bumpLayout });

  const logTeam = (req: unknown, res: unknown) => {
    setLastRequest(JSON.stringify(req, null, 2));
    setLastResponse(JSON.stringify(res, null, 2));
  };

  const refreshChats = async () => {
    try {
      const data = await api.chats();
      setChats(data.chats || []);
    } catch {
      setChats([]);
    }
  };

  const loadProvinces = async (nextRegion: string) => {
    try {
      const data = await api.provinces(nextRegion);
      const names = (data.provinces || [])
        .map((row) => (typeof row === "string" ? row : row.name || row.province || ""))
        .filter(Boolean);
      setProvinces(names);
    } catch {
      setProvinces([]);
    }
  };

  const boot = async () => {
    try {
      const h = await api.health();
      setHealth(h);
      setAssistant(h.assistant);
      logTeam({ method: "GET", path: "/v1/health" }, h);
    } catch (err) {
      setAssistant({
        level: "off",
        label: "ผู้ช่วยยังไม่พร้อม",
        detail: err instanceof Error ? err.message : "ยังต่อ API ไม่ได้",
      });
    }
    await loadProvinces(region);
    await refreshChats();
  };

  useEffect(() => {
    void boot();
  }, []);

  const search = async (
    text: string,
    opts?: { fresh?: boolean; prefer?: boolean; province?: string },
  ) => {
    const q = text.trim();
    if (!q) return;
    const prefer = opts?.prefer ?? preferSecondary;
    const nextProvince = opts?.province ?? province;
    const gen = ++searchGen.current;
    const filterOnly = opts?.prefer !== undefined || opts?.province !== undefined;
    setLoading(true);
    setExplaining(false);
    if (!filterOnly) setResult(null);
    setQuery(q);
    if (!filterOnly) {
      const pending: ChatTurn = { id: PENDING_TURN, query: q };
      if (opts?.fresh || !activeChatId) setThread([pending]);
      else setThread((prev) => [...prev.filter((turn) => turn.id !== PENDING_TURN), pending]);
    }
    const body: {
      query: string;
      region: string;
      prefer_secondary: boolean;
      province?: string;
      chat_id?: string;
    } = {
      query: q,
      region,
      prefer_secondary: prefer,
    };
    if (nextProvince) body.province = nextProvince;
    if (activeChatId && !opts?.fresh) body.chat_id = activeChatId;
    const req = {
      method: "POST",
      path: "/v1/search",
      headers: { Authorization: "Bearer (token)" },
      body,
    };
    logTeam(req, "รอ response");
    try {
      const res = await api.search(body);
      if (gen !== searchGen.current) return;
      logTeam(req, res);
      setResult(res);
      setAssistant(res.assistant);
      setActiveChatId(res.chat_id);
      setPreferSecondary(res.prefer_secondary);
      setDraft("");
      setThread((prev) => {
        const next = { id: res.message_id, query: q, intro: res.intro };
        if (filterOnly) {
          if (!prev.length) return [next];
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], ...next };
          return copy;
        }
        return replacePendingTurn(prev, next);
      });
      setLoading(false);
      await refreshChats();
      if (!res.explain_pending) return;
      setExplaining(true);
      try {
        const explained = await api.explain(res.message_id);
        if (gen !== searchGen.current) return;
        logTeam({ method: "POST", path: "/v1/messages/" + res.message_id + "/explain" }, explained);
        const nextAssistant =
          explained.assistant.level === "off" ? res.assistant : explained.assistant;
        setResult({ ...explained, assistant: nextAssistant });
        setAssistant(nextAssistant);
        setThread((prev) =>
          prev.map((turn) =>
            turn.id === explained.message_id ? { ...turn, intro: explained.intro } : turn,
          ),
        );
      } catch (err) {
        if (gen !== searchGen.current) return;
        logTeam(
          { method: "POST", path: "/v1/messages/" + res.message_id + "/explain" },
          { error: err instanceof Error ? err.message : "อธิบายไม่สำเร็จ" },
        );
      } finally {
        if (gen === searchGen.current) setExplaining(false);
      }
    } catch (err) {
      if (gen !== searchGen.current) return;
      const message = err instanceof Error ? err.message : "ค้นไม่สำเร็จ";
      logTeam(req, { error: message });
      setResult({
        chat_id: activeChatId || "",
        message_id: "",
        intro: message,
        assistant,
        prefer_secondary: preferSecondary,
        secondary_count: 0,
        places: [],
        map_points: [],
        explain_pending: false,
      });
      setLoading(false);
      setExplaining(false);
      setThread((prev) =>
        prev.map((turn) => (turn.id === PENDING_TURN ? { ...turn, intro: message } : turn)),
      );
    }
  };

  const onPreferSecondary = (value: boolean) => {
    setPreferSecondary(value);
    if (query && result) void search(query, { prefer: value });
  };

  const onProvince = (value: string) => {
    setProvince(value);
    if (query && result) void search(query, { province: value });
  };

  const loadChat = async (id: string) => {
    searchGen.current += 1;
    setLoading(false);
    setExplaining(false);
    try {
      const data = await api.chat(id);
      const last = data.messages[data.messages.length - 1];
      if (!last) return;
      setActiveChatId(data.id);
      setQuery(last.query);
      setDraft("");
      setThread(
        data.messages.map((row) => ({
          id: row.id,
          query: row.query,
          intro: row.intro,
        })),
      );
      setPreferSecondary(last.prefer_secondary);
      const packed: SearchResponse = {
        chat_id: data.id,
        message_id: last.id,
        intro: last.intro,
        assistant: last.assistant,
        prefer_secondary: last.prefer_secondary,
        secondary_count: (last.places || []).filter((p) => p.province !== CHIANG_MAI).length,
        places: last.places || [],
        map_points: last.map_points || [],
      };
      setResult(packed);
      setAssistant(last.assistant);
      setLoading(false);
      setExplaining(false);
    } catch (err) {
      logTeam({ path: "/v1/chats/" + id }, { error: err instanceof Error ? err.message : "ไม่พบแชท" });
    }
  };

  const newChat = () => {
    searchGen.current += 1;
    setActiveChatId(null);
    setResult(null);
    setQuery("");
    setDraft("");
    setThread([]);
    setLoading(false);
    setExplaining(false);
  };

  const askConfirm = (action: ConfirmAction) => {
    setConfirmError("");
    setConfirmLoading(false);
    setConfirmAction(action);
  };

  const closeConfirm = () => {
    if (confirmLoading) return;
    setConfirmAction(null);
    setConfirmError("");
  };

  const runConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    setConfirmError("");
    try {
      if (confirmAction.kind === "logout") {
        onLogout();
        return;
      }
      if (confirmAction.kind === "delete-chat") {
        const id = confirmAction.chat.id;
        await api.deleteChat(id);
        if (activeChatId === id) newChat();
        await refreshChats();
      } else {
        await api.deleteAllChats();
        newChat();
        await refreshChats();
      }
      setConfirmAction(null);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ");
    } finally {
      if (confirmAction.kind !== "logout") setConfirmLoading(false);
    }
  };

  const vote = async (place: Place, rating: 1 | -1) => {
    if (!result) return;
    const key = `${result.message_id}:${place.att_id}`;
    const next = ratings[key] === rating ? undefined : rating;
    setRatings((prev) => {
      const copy = { ...prev };
      if (!next) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    if (!next) return;
    const body = { message_id: result.message_id, att_id: place.att_id, rating: next };
    try {
      await api.feedback(body);
      logTeam({ method: "POST", path: "/v1/feedback", body }, { ok: true });
    } catch (err) {
      logTeam({ method: "POST", path: "/v1/feedback", body }, { error: err instanceof Error ? err.message : "ไม่สำเร็จ" });
    }
  };

  const favorite = async (place: Place, imageId: string) => {
    if (!result) return;
    try {
      const updated = await api.favoriteImage(imageId);
      setResult({
        ...result,
        places: result.places.map((item) =>
          item.att_id !== place.att_id
            ? item
            : { ...item, images: item.images.map((img) => (img.id === updated.id ? updated : img)) },
        ),
      });
    } catch (err) {
      logTeam({ path: "/v1/images/" + imageId + "/favorite" }, { error: err instanceof Error ? err.message : "ไม่สำเร็จ" });
    }
  };

  const pickUpload = (attId: string) => {
    uploadAttId.current = attId;
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !uploadAttId.current || !result) return;
    const okType = /image\/(jpeg|png|webp)/.test(file.type);
    if (!okType || file.size > 5 * 1024 * 1024) {
      alert("รับเฉพาะ jpg png webp ขนาดไม่เกิน 5MB");
      return;
    }
    const attId = uploadAttId.current;
    try {
      const saved = await api.uploadImage(attId, file);
      saved.is_cover = true;
      setResult({
        ...result,
        places: result.places.map((item) =>
          item.att_id !== attId
            ? item
            : {
                ...item,
                images: [saved, ...item.images.map((img) => ({ ...img, is_cover: false }))],
              },
        ),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    }
  };

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread, loading, explaining, result?.message_id]);

  const focusedName =
    result?.places[0] && query.includes(result.places[0].name_th) ? result.places[0].name_th : "";
  const meta = loading
    ? "กำลังค้นในภาคเหนือ"
    : explaining
      ? EXPLAINING_COPY
      : result
        ? result.places.length
          ? focusedName
            ? `${focusedName} จากฐาน ททท. ที่เหลือเป็นที่ใกล้เคียงในมู้ดเดิม`
            : `ใน ${result.places.length} แห่งนี้ เป็นจังหวัดอื่นนอกเชียงใหม่ ${result.secondary_count} แห่ง`
          : result.message_id
            ? "ไม่มีการ์ดจากฐาน"
            : ""
        : "";
  const barAssistant = loading
    ? { ...assistant, label: "กำลังค้น", detail: LOADING_COPY }
    : explaining
      ? { ...assistant, label: "กำลังอธิบายมู้ด", detail: EXPLAINING_COPY }
      : assistant;

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          <h1>VibeRoute</h1>
          <p>ค้นที่เที่ยวภาคเหนือตามความรู้สึก จากข้อมูล ททท. เท่านั้น</p>
        </div>
        <AssistantBar assistant={barAssistant} />
        <div className="bar-actions">
          <div className="account-chip">
            <strong>{user.email}</strong>
            <span className="role-pill">{roleLabel(user.role)}</span>
          </div>
          <button type="button" className="drawer-btn" onClick={() => setHistoryOpen((v) => !v)}>
            ประวัติ
          </button>
          <button type="button" onClick={newChat}>
            แชทใหม่
          </button>
          {isAdmin ? (
            <button
              type="button"
              aria-pressed={teamOpen}
              onClick={() => {
                setTeamOpen((v) => !v);
                setTimeout(bumpLayout, 160);
              }}
            >
              สำหรับทีมงาน
            </button>
          ) : null}
          <button type="button" onClick={() => askConfirm({ kind: "logout" })}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="shell">
        <div className={historyOpen ? "history-col open" : "history-col"} id="history-col">
          <ChatHistory
            chats={chats}
            activeId={activeChatId}
            onSelect={(id) => {
              setHistoryOpen(false);
              void loadChat(id);
            }}
            onNew={() => {
              setHistoryOpen(false);
              newChat();
            }}
            onDelete={(chat) => askConfirm({ kind: "delete-chat", chat })}
            onDeleteAll={() => askConfirm({ kind: "delete-all" })}
          />
          <Filters
            region={region}
            province={province}
            provinces={provinces}
            preferSecondary={preferSecondary}
            onRegion={(value) => {
              setRegion(value);
              void loadProvinces(value);
            }}
            onProvince={onProvince}
            onPreferSecondary={onPreferSecondary}
          />
        </div>

        <div
          className="gutter"
          id="gutter-history"
          role="separator"
          aria-orientation="vertical"
          aria-label="ลากปรับความกว้างประวัติ"
          tabIndex={0}
        />

        <section className="stage">
          <div className="feed" ref={feedRef}>
            {!result && !loading && thread.length === 0 ? (
              <div className="welcome">
                <h2>พิมพ์มู้ดแล้วค้นจากฐาน ททท.</h2>
                <p>เปิดมาก็ไม่มีการ์ดปลอม ผลขึ้นเมื่อค้นจริงเท่านั้น</p>
                <div className="chips" data-component="DemoChips">
                  {DEMO_CHIPS.map((chip) => (
                    <button key={chip.q} type="button" onClick={() => void search(chip.q, { fresh: true })}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <ChatThread turns={thread} />
            {meta ? <p className="meta">{meta}</p> : null}
            <div className="cards">
              {loading
                ? Array.from({ length: 6 }, (_, index) => (
                    <article key={index} className="card skeleton" aria-hidden>
                      <div className="cover" />
                      <div className="card-body">
                        <div className="sk sk-title" />
                        <div className="sk sk-line" />
                        <div className="sk sk-line" />
                      </div>
                    </article>
                  ))
                : (result?.places || []).map((place, index) => (
                    <PlaceCard
                      key={place.att_id}
                      place={place}
                      rank={index + 1}
                      rating={result ? ratings[`${result.message_id}:${place.att_id}`] || 0 : 0}
                      showScores={showScores}
                      onVote={(value) => void vote(place, value)}
                      onUpload={() => pickUpload(place.att_id)}
                      onFavoriteCover={(imageId) => void favorite(place, imageId)}
                    />
                  ))}
            </div>
          </div>
          <VibeComposer
            query={draft}
            continuing={Boolean(activeChatId)}
            lastVibe={query}
            onQuery={setDraft}
            onSubmit={() => void search(draft, { fresh: false })}
          />
        </section>

        <div
          className="gutter"
          id="gutter-map"
          role="separator"
          aria-orientation="vertical"
          aria-label="ลากปรับความกว้างแผนที่"
          tabIndex={0}
        />

        <PlaceMap points={result?.map_points || []} layoutTick={layoutTick} />
      </div>

      {isAdmin ? (
        <TeamPanel
          open={teamOpen}
          showScores={showScores}
          lastRequest={lastRequest}
          lastResponse={lastResponse}
          health={health}
          onShowScores={setShowScores}
        />
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onFile(file);
        }}
      />
      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmAction ? confirmCopy(confirmAction).title : ""}
        description={confirmAction ? confirmCopy(confirmAction).description : ""}
        confirmLabel={confirmAction ? confirmCopy(confirmAction).confirmLabel : "ยืนยัน"}
        loading={confirmLoading}
        error={confirmError}
        onConfirm={() => void runConfirm()}
        onCancel={closeConfirm}
      />
    </div>
  );
}
