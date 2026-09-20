import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  cacheUser,
  clearAuthSession,
  getCachedUser,
  chatIdFromLocation,
  hasAuthSession,
  isWakeError,
  readRememberedChatId,
  saveActiveChatId,
  type AuthUser,
} from "./api";
import { AssistantBar } from "./components/AssistantBar";
import { AuthScreen } from "./components/AuthScreen";
import { ChatHistory } from "./components/ChatHistory";
import { ChatThread } from "./components/ChatThread";
import { ConfirmModal } from "./components/ConfirmModal";
import { Filters } from "./components/Filters";
import { NextSteps } from "./components/NextSteps";
import { PlaceCard } from "./components/PlaceCard";
import { PlaceDetailModal } from "./components/PlaceDetailModal";
import { PlaceMap } from "./components/PlaceMap";
import { RegionSuggest } from "./components/RegionSuggest";
import { SkeletonCards, SkeletonThread } from "./components/Skeleton";
import { TeamPanel } from "./components/TeamPanel";
import { VibeComposer } from "./components/VibeComposer";
import { useColumnResize } from "./hooks/useColumnResize";
import {
  CHIANG_MAI,
  DEFAULT_REGION,
  DEMO_CHIPS,
  POPULAR_SEARCHES,
  EXPLAINING_COPY,
  LOADING_COPY,
  NEARBY_KM,
  OPENING_CHAT_COPY,
  maskQuery,
  nextStepSearches,
  placeBlurb,
  type AssistantStatus,
  type ChatSummary,
  type ChatTurn,
  type HealthResponse,
  type MapPoint,
  type NearbyKm,
  type Place,
  type SearchResponse,
  type SuggestResponse,
} from "./types";

const PENDING_TURN = "pending";

function searchText(draft: string, lastVibe: string, canReuse: boolean): string {
  const typed = draft.trim();
  if (typed) return typed;
  return canReuse ? lastVibe.trim() : "";
}

function maskLoggedQuery(req: unknown): unknown {
  if (!req || typeof req !== "object") return req;
  const row = req as { body?: { query?: unknown } };
  if (!row.body || typeof row.body !== "object" || typeof row.body.query !== "string") return req;
  return { ...row, body: { ...row.body, query: maskQuery(row.body.query) } };
}

function nearbyCacheKey(attId: string, km: number): string {
  return `${attId}:${km}`;
}

function listedById(places: Place[], attId: string | null | undefined): Place | undefined {
  if (!attId) return undefined;
  return places.find((item) => item.att_id === attId);
}

function replacePendingTurn(turns: ChatTurn[], next: ChatTurn): ChatTurn[] {
  const withoutPending = turns.filter((turn) => turn.id !== PENDING_TURN);
  if (withoutPending.some((turn) => turn.id === next.id)) {
    return withoutPending.map((turn) => (turn.id === next.id ? next : turn));
  }
  return [...withoutPending, next];
}

function mergePlaceImages(fromApi: Place[], fromCurrent: Place[] | undefined): Place[] {
  if (!fromCurrent?.length) return fromApi;
  return fromApi.map((place) => {
    const current = fromCurrent.find((item) => item.att_id === place.att_id);
    if (!current?.images.length) return place;
    const byId = new Map(place.images.map((img) => [img.id, img]));
    for (const img of current.images) {
      if (!byId.has(img.id)) byId.set(img.id, img);
    }
    const images = [...byId.values()].map((img, index) => ({ ...img, is_cover: index === 0 }));
    return { ...place, images };
  });
}

function mergeMapPoints(base: MapPoint[], origin: Place | null, nearby: Place[]): MapPoint[] {
  const points: MapPoint[] = [];
  const seen = new Set<string>();
  const push = (pt: MapPoint) => {
    if (seen.has(pt.att_id)) return;
    seen.add(pt.att_id);
    points.push(pt);
  };
  if (origin && origin.lat != null && origin.lng != null) {
    push({
      att_id: origin.att_id,
      name_th: origin.name_th,
      lat: origin.lat,
      lng: origin.lng,
      kind: "origin",
      type_label: origin.type_label,
      blurb: placeBlurb(origin, 90),
    });
  }
  for (const place of nearby) {
    if (!origin || place.att_id === origin.att_id || place.lat == null || place.lng == null) continue;
    push({
      att_id: place.att_id,
      name_th: place.name_th,
      lat: place.lat,
      lng: place.lng,
      kind: "nearby",
      distance_km: place.distance_km,
      type_label: place.type_label,
      blurb: placeBlurb(place, 90),
    });
  }
  for (const pt of base) {
    if (pt.lat == null || pt.lng == null) continue;
    push({ ...pt, kind: pt.kind || "result" });
  }
  return points;
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
  | { kind: "delete-all" }
  | { kind: "delete-image"; attId: string; imageId: string };

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
  if (action.kind === "delete-image") {
    return {
      title: "เอาออกรูปนี้?",
      description: "รูปที่คุณอัปโหลดจะหายจากสถานที่นี้ คนอื่นจะไม่เห็นแล้ว",
      confirmLabel: "เอาออกรูป",
    };
  }
  return {
    title: "เอาแชทนี้ออกจากประวัติ?",
    description: `แชท «${action.chat.title || "ไม่มีชื่อ"}» จะหายจากรายการของคุณ ระบบยังเก็บข้อความไว้เพื่อพัฒนาการค้นหา`,
    confirmLabel: "เอาออกจากประวัติ",
  };
}

export function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getCachedUser());

  useEffect(() => {
    if (!hasAuthSession()) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        cacheUser(me);
        setUser(me);
      } catch (err) {
        if (cancelled) return;
        if (isWakeError(err) && getCachedUser()) return;
        clearAuthSession();
        setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) {
    return (
      <AuthScreen
        onAuthed={(next) => {
          cacheUser(next);
          setUser(next);
        }}
      />
    );
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
  const [suggest, setSuggest] = useState<SuggestResponse | null>(null);
  const [province, setProvince] = useState("");
  const [preferSecondary, setPreferSecondary] = useState(true);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<ChatTurn[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(() => readRememberedChatId(user.id));
  const [loading, setLoading] = useState(() => Boolean(readRememberedChatId(user.id)));
  const [openingChat, setOpeningChat] = useState(() => Boolean(readRememberedChatId(user.id)));
  const [explaining, setExplaining] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
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
  const nearbyGen = useRef(0);
  const nearbyEpoch = useRef(0);
  const nearbyCache = useRef(new Map<string, Place[]>());
  const nearbyInflight = useRef(new Map<string, Promise<Place[]>>());
  const knownPlaces = useRef(new Map<string, Place>());
  const feedRef = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === "admin";
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [openAttId, setOpenAttId] = useState<string | null>(null);
  const [focusAttId, setFocusAttId] = useState<string | null>(null);
  const [planOrigin, setPlanOrigin] = useState<Place | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [nearbyKm, setNearbyKm] = useState<NearbyKm>(NEARBY_KM);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [uploadingAttId, setUploadingAttId] = useState<string | null>(null);
  const resultPlaces = result?.places || [];
  if (planOrigin) knownPlaces.current.set(planOrigin.att_id, planOrigin);
  for (const item of resultPlaces) knownPlaces.current.set(item.att_id, item);
  for (const item of nearbyPlaces) knownPlaces.current.set(item.att_id, item);
  const anchorPlace =
    (focusAttId && focusAttId === planOrigin?.att_id ? planOrigin : null) ||
    listedById(resultPlaces, focusAttId) ||
    listedById(nearbyPlaces, focusAttId) ||
    (focusAttId ? knownPlaces.current.get(focusAttId) || null : null) ||
    planOrigin ||
    null;
  useEffect(() => {
    nearbyEpoch.current += 1;
    nearbyCache.current.clear();
    nearbyInflight.current.clear();
    knownPlaces.current.clear();
    setPlanOrigin(null);
    setFocusAttId(null);
    setNearbyKm(NEARBY_KM);
  }, [result?.message_id]);

  useEffect(() => {
    if (!planOrigin) {
      nearbyGen.current += 1;
      setNearbyPlaces([]);
      setNearbyLoading(false);
      return;
    }
    if (planOrigin.lat == null || planOrigin.lng == null) {
      nearbyGen.current += 1;
      setNearbyPlaces([]);
      setNearbyLoading(false);
      return;
    }
    const key = nearbyCacheKey(planOrigin.att_id, nearbyKm);
    const cached = nearbyCache.current.get(key);
    const gen = ++nearbyGen.current;
    if (cached) {
      setNearbyPlaces(cached);
      setNearbyLoading(false);
      return;
    }
    setNearbyLoading(true);
    const epoch = nearbyEpoch.current;
    let pending = nearbyInflight.current.get(key);
    if (!pending) {
      pending = api
        .nearby(planOrigin.att_id, nearbyKm)
        .then((res) => {
          const places = res.places || [];
          if (epoch === nearbyEpoch.current) nearbyCache.current.set(key, places);
          return places;
        })
        .finally(() => {
          nearbyInflight.current.delete(key);
        });
      nearbyInflight.current.set(key, pending);
    }
    void pending
      .then((places) => {
        if (gen !== nearbyGen.current) return;
        setNearbyPlaces(places);
      })
      .catch(() => {
        if (gen !== nearbyGen.current) return;
        setNearbyPlaces([]);
      })
      .finally(() => {
        if (gen !== nearbyGen.current) return;
        setNearbyLoading(false);
      });
  }, [planOrigin?.att_id, nearbyKm]);

  const bumpLayout = useCallback(() => setLayoutTick((n) => n + 1), []);
  useColumnResize({ onChange: bumpLayout });
  const loadChatRef = useRef<(id: string) => Promise<void>>(async () => {});

  const rememberChat = (id: string | null) => {
    setActiveChatId(id);
    saveActiveChatId(user.id, id);
  };

  const logTeam = (req: unknown, res: unknown) => {
    setLastRequest(JSON.stringify(maskLoggedQuery(req), null, 2));
    setLastResponse(JSON.stringify(res, null, 2));
  };

  const refreshChats = async () => {
    try {
      const data = await api.chats();
      const list = data.chats || [];
      setChats(list);
      return { ok: true as const, chats: list };
    } catch {
      setChats([]);
      return { ok: false as const, chats: [] as ChatSummary[] };
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

  const loadSuggest = async (nextRegion: string) => {
    try {
      const data = await api.suggest(nextRegion);
      setSuggest(data);
    } catch {
      setSuggest({ region: nextRegion, days: 14, queries: [], places: [] });
    }
  };

  const boot = async () => {
    const genAtStart = searchGen.current;
    const saved = readRememberedChatId(user.id);
    if (saved) saveActiveChatId(user.id, saved);
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
    const { ok, chats: list } = await refreshChats();
    if (genAtStart !== searchGen.current) return;
    const current = readRememberedChatId(user.id);
    if (!current) return;
    if (ok && !list.some((chat) => chat.id === current)) {
      rememberChat(null);
      setLoading(false);
      setOpeningChat(false);
      return;
    }
    await loadChatRef.current(current);
  };

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    void loadSuggest(region);
  }, [region]);

  const search = async (
    text: string,
    opts?: { fresh?: boolean; prefer?: boolean; province?: string },
  ) => {
    const canReuse = Boolean(activeChatId) && !opts?.fresh;
    const q = maskQuery(searchText(text, query, canReuse));
    if (!q) return;
    const prefer = opts?.prefer ?? preferSecondary;
    const nextProvince = opts?.province ?? province;
    const gen = ++searchGen.current;
    const reused = canReuse && !text.trim();
    const filterOnly = reused || opts?.prefer !== undefined || opts?.province !== undefined;
    setLoading(true);
    setOpeningChat(false);
    setExplaining(false);
    setFocusAttId(null);
    setOpenAttId(null);
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
      rememberChat(res.chat_id);
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
        setResult((prev) => ({
          ...explained,
          assistant: nextAssistant,
          places: mergePlaceImages(explained.places, prev?.places),
        }));
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
    if (query.trim()) void search(query, { prefer: value });
  };

  const onProvince = (value: string) => {
    setProvince(value);
    if (query.trim()) void search(query, { province: value });
  };

  const loadChat = async (id: string) => {
    const gen = ++searchGen.current;
    setOpeningChat(true);
    setLoading(true);
    setExplaining(false);
    rememberChat(id);
    setResult(null);
    setThread([]);
    setOpenAttId(null);
    setFocusAttId(null);
    try {
      const data = await api.chat(id);
      if (gen !== searchGen.current) return;
      const last = data.messages[data.messages.length - 1];
      if (!last) return;
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
    } catch (err) {
      if (gen !== searchGen.current) return;
      logTeam({ path: "/v1/chats/" + id }, { error: err instanceof Error ? err.message : "ไม่พบแชท" });
    } finally {
      if (gen === searchGen.current) {
        setLoading(false);
        setOpeningChat(false);
      }
    }
  };

  loadChatRef.current = loadChat;

  const newChat = () => {
    searchGen.current += 1;
    rememberChat(null);
    setResult(null);
    setQuery("");
    setDraft("");
    setThread([]);
    setLoading(false);
    setOpeningChat(false);
    setExplaining(false);
  };

  useEffect(() => {
    const onPop = () => {
      const id = chatIdFromLocation();
      if (id) {
        void loadChatRef.current(id);
        return;
      }
      newChat();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
      } else if (confirmAction.kind === "delete-image") {
        await api.deleteImage(confirmAction.imageId);
        if (result) {
          setResult({
            ...result,
            places: result.places.map((item) => {
              if (item.att_id !== confirmAction.attId) return item;
              const images = item.images
                .filter((img) => img.id !== confirmAction.imageId)
                .map((img, index) => ({ ...img, is_cover: index === 0 }));
              return { ...item, images };
            }),
          });
        }
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
      void loadSuggest(region);
    } catch (err) {
      logTeam({ method: "POST", path: "/v1/feedback", body }, { error: err instanceof Error ? err.message : "ไม่สำเร็จ" });
    }
  };

  const favorite = async (place: Place, imageId: string) => {
    if (!result) return;
    try {
      const updated = await api.favoriteImage(imageId);
      const patch = (places: Place[]) =>
        places.map((item) =>
          item.att_id !== place.att_id
            ? item
            : { ...item, images: item.images.map((img) => (img.id === updated.id ? updated : img)) },
        );
      setResult({
        ...result,
        places: patch(result.places),
      });
      setNearbyPlaces((prev) => patch(prev));
      setPlanOrigin((current) => (current ? patch([current])[0] : current));
    } catch (err) {
      logTeam({ path: "/v1/images/" + imageId + "/favorite" }, { error: err instanceof Error ? err.message : "ไม่สำเร็จ" });
    }
  };

  const pickUpload = (attId: string) => {
    if (uploadingAttId) return;
    uploadAttId.current = attId;
    fileRef.current?.click();
  };

  const askDeleteImage = (attId: string, imageId: string) => {
    askConfirm({ kind: "delete-image", attId, imageId });
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !uploadAttId.current || !result || uploadingAttId) return;
    const okType = /image\/(jpeg|png|webp)/.test(file.type);
    if (!okType || file.size > 5 * 1024 * 1024) {
      alert("รับเฉพาะ jpg png webp ขนาดไม่เกิน 5MB");
      return;
    }
    const attId = uploadAttId.current;
    setUploadingAttId(attId);
    try {
      const saved = await api.uploadImage(attId, file);
      saved.is_cover = true;
      saved.viewer_owned = true;
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          places: prev.places.map((item) =>
            item.att_id !== attId
              ? item
              : {
                  ...item,
                  images: [saved, ...item.images.map((img) => ({ ...img, is_cover: false }))],
                },
          ),
        };
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploadingAttId(null);
    }
  };

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    if (loading || explaining) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    const lastBubble = el.querySelector(".thread .bubble-row:last-child");
    if (!(lastBubble instanceof HTMLElement)) return;
    const feedTop = el.getBoundingClientRect().top;
    const bubbleTop = lastBubble.getBoundingClientRect().top;
    el.scrollTop = Math.max(0, el.scrollTop + bubbleTop - feedTop - 8);
  }, [thread, loading, explaining, result?.message_id]);

  const focusedName =
    result?.places[0] && query.includes(result.places[0].name_th) ? result.places[0].name_th : "";
  const skeletonCount = openingChat
    ? chats.find((chat) => chat.id === activeChatId)?.card_count || 6
    : 6;
  const meta = loading
    ? openingChat
      ? OPENING_CHAT_COPY
      : "กำลังค้นในภาคเหนือ"
    : explaining
      ? EXPLAINING_COPY
      : result
        ? result.places.length
          ? focusedName
            ? `${focusedName} จากฐาน ททท. ที่เหลือเป็นที่ใกล้เคียงในมู้ดเดิม`
            : `ใน ${result.places.length} แห่งนี้ เป็นจังหวัดอื่นนอกเชียงใหม่ ${result.secondary_count} แห่ง`
          : result.message_id
            ? "ไม่โชว์การ์ด เพราะผลไม่ตรงคำค้นจากฐาน ททท. ของภาคนี้"
            : ""
        : "";
  const barAssistant = loading
    ? openingChat
      ? { ...assistant, label: "กำลังเปิดแชท", detail: OPENING_CHAT_COPY }
      : { ...assistant, label: "กำลังค้น", detail: LOADING_COPY }
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
            loadingId={openingChat ? activeChatId : null}
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
                <p>
                  ผลขึ้นเมื่อค้นจริงเท่านั้น คำแนะนำด้านล่างแยกตาม{region} จากที่คนค้นและกดถูกใจช่วงนี้
                </p>
                <RegionSuggest
                  region={suggest?.region || region}
                  days={suggest?.days || 14}
                  queries={suggest?.queries || []}
                  places={suggest?.places || []}
                  fallbackQueries={POPULAR_SEARCHES}
                  onQuery={(text) => void search(text, { fresh: true })}
                  onPlace={(name) => void search(name, { fresh: true })}
                />
                <p className="chips-label demo">เคสเดโม</p>
                <div className="chips demo" data-component="DemoChips">
                  {DEMO_CHIPS.map((chip) => (
                    <button key={chip.q} type="button" onClick={() => void search(chip.q, { fresh: true })}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <ChatThread turns={thread} />
            {loading && openingChat ? <SkeletonThread /> : null}
            {meta ? <p className="meta">{meta}</p> : null}
            {loading || (result && result.places.length > 0) ? (
              <details
                className="cards-fold"
                open
                key={result?.message_id || "loading"}
                aria-busy={loading ? true : undefined}
              >
                <summary className="cards-head">
                  <h2>
                    {loading ? skeletonCount : result?.places.length} recommended vibe places
                    <span> ( {region} )</span>
                  </h2>
                  <p>Limit: 6 cards strictly</p>
                </summary>
                <div className="cards">
                  {loading ? (
                    <SkeletonCards count={skeletonCount} />
                  ) : (result?.places || []).map((place, index) => (
                        <PlaceCard
                          key={place.att_id}
                          place={place}
                          rank={index + 1}
                          rating={result ? ratings[`${result.message_id}:${place.att_id}`] || 0 : 0}
                          showScores={showScores}
                          uploading={uploadingAttId === place.att_id}
                          onVote={(value) => void vote(place, value)}
                          onUpload={() => pickUpload(place.att_id)}
                          onFavoriteCover={(imageId) => void favorite(place, imageId)}
                          onRemoveCover={
                            (place.images.find((img) => img.is_cover) || place.images[0])?.viewer_owned
                              ? () => {
                                  const cover =
                                    place.images.find((img) => img.is_cover) || place.images[0];
                                  if (cover) askDeleteImage(place.att_id, cover.id);
                                }
                              : undefined
                          }
                          focused={focusAttId === place.att_id}
                          onFocus={() => {
                            setFocusAttId(place.att_id);
                            setPlanOrigin(place);
                          }}
                          onOpen={() => {
                            setOpenAttId(place.att_id);
                            setFocusAttId(place.att_id);
                            setPlanOrigin(place);
                          }}
                        />
                      ))}
                </div>
              </details>
            ) : null}
            {!loading && resultPlaces.length > 0 && !planOrigin ? (
              <p className="plan-prompt">
                กดเลือกที่เที่ยวจาก {resultPlaces.length} รายการด้านบน เพื่อตั้งเป็นฐาน
                แล้วระบบจะแนะนำจุดใกล้ๆ
              </p>
            ) : null}
            {!loading && planOrigin ? (
              <NextSteps
                place={anchorPlace || planOrigin}
                origin={planOrigin}
                nearby={nearbyPlaces}
                nearbyLoading={nearbyLoading}
                nearbyKm={nearbyKm}
                onPick={(text) => void search(text, { fresh: false })}
                onKmChange={setNearbyKm}
                onFocus={(stop) => setFocusAttId(stop.att_id)}
                onSetOrigin={(stop) => {
                  setFocusAttId(stop.att_id);
                  setPlanOrigin(stop);
                }}
                onOpen={(stop) => {
                  setFocusAttId(stop.att_id);
                  setOpenAttId(stop.att_id);
                }}
              />
            ) : null}
          </div>
          <VibeComposer
            query={draft}
            continuing={Boolean(activeChatId)}
            lastVibe={query}
            onQuery={setDraft}
            onSubmit={() => void search(draft, { fresh: false })}
            suggestions={
              resultPlaces.length || planOrigin
                ? []
                : thread.length || result || loading
                  ? (suggest?.queries.length
                      ? suggest.queries.map((item) => ({ q: item.query, label: item.label }))
                      : POPULAR_SEARCHES)
                  : []
            }
            suggestionLabel={
              suggest?.queries.length ? `คนค้นใน${suggest.region || region}` : "คำค้นหายอดนิยม"
            }
            onSuggest={(text) => void search(text, { fresh: true })}
            nextSteps={planOrigin ? nextStepSearches(anchorPlace || planOrigin) : []}
            onNextStep={(text) => void search(text, { fresh: false })}
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

        <PlaceMap
          points={mergeMapPoints(result?.map_points || [], planOrigin, nearbyPlaces)}
          layoutTick={layoutTick}
          focusId={focusAttId}
          originId={planOrigin?.att_id}
          radiusKm={planOrigin ? nearbyKm : null}
          viewKey={result?.message_id}
          onSelect={(attId) => {
            const listed = listedById(resultPlaces, attId);
            if (listed) {
              setFocusAttId(listed.att_id);
              setPlanOrigin(listed);
              return;
            }
            const place =
              (planOrigin?.att_id === attId ? planOrigin : null) ||
              listedById(nearbyPlaces, attId) ||
              knownPlaces.current.get(attId);
            if (!place) return;
            setFocusAttId(place.att_id);
          }}
        />
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
      <PlaceDetailModal
        place={
          result?.places.find((item) => item.att_id === openAttId) ||
          nearbyPlaces.find((item) => item.att_id === openAttId) ||
          (planOrigin?.att_id === openAttId ? planOrigin : null) ||
          (openAttId ? knownPlaces.current.get(openAttId) || null : null)
        }
        rating={
          result && openAttId ? ratings[`${result.message_id}:${openAttId}`] || 0 : 0
        }
        uploading={Boolean(openAttId && uploadingAttId === openAttId)}
        nearby={nearbyPlaces}
        nearbyLoading={nearbyLoading}
        nearbyKm={nearbyKm}
        origin={planOrigin || undefined}
        onClose={() => setOpenAttId(null)}
        onKmChange={setNearbyKm}
        onFocusPlace={(stop) => {
          setFocusAttId(stop.att_id);
          setOpenAttId(stop.att_id);
        }}
        onSetOrigin={(stop) => {
          setFocusAttId(stop.att_id);
          setPlanOrigin(stop);
        }}
        onVote={(value) => {
          const place =
            result?.places.find((item) => item.att_id === openAttId) ||
            nearbyPlaces.find((item) => item.att_id === openAttId) ||
            planOrigin;
          if (place) void vote(place, value);
        }}
        onUpload={() => {
          if (openAttId) pickUpload(openAttId);
        }}
        onFavorite={(imageId) => {
          const place =
            result?.places.find((item) => item.att_id === openAttId) ||
            nearbyPlaces.find((item) => item.att_id === openAttId) ||
            planOrigin;
          if (place) void favorite(place, imageId);
        }}
        onDelete={(imageId) => {
          if (openAttId) askDeleteImage(openAttId, imageId);
        }}
        onNext={(text) => {
          setOpenAttId(null);
          void search(text, { fresh: false });
        }}
      />
    </div>
  );
}
