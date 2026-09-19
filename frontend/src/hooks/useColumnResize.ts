import { useEffect } from "react";

const LAYOUT_KEY = "viberoute_layout";
const MIN_HISTORY = 240;
const MAX_HISTORY = 360;
const MIN_MAP = 280;
const MIN_STAGE = 320;

type Props = {
  onChange: () => void;
};

export function useColumnResize({ onChange }: Props) {
  useEffect(() => {
    const shell = document.querySelector(".shell") as HTMLElement | null;
    if (!shell) return;

    function shellWidth() {
      return shell!.getBoundingClientRect().width;
    }

    function applyLayout(historyW: number, mapW: number) {
      const total = shellWidth();
      const gutters = 20;
      const maxMap = Math.max(MIN_MAP, total - historyW - MIN_STAGE - gutters);
      historyW = Math.min(MAX_HISTORY, Math.max(MIN_HISTORY, historyW));
      mapW = Math.min(maxMap, Math.max(MIN_MAP, mapW));
      shell!.style.setProperty("--history-w", `${historyW}px`);
      shell!.style.setProperty("--map-w", `${mapW}px`);
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ historyW, mapW }));
      onChange();
      return { historyW, mapW };
    }

    function current() {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null") as {
        historyW: number;
        mapW: number;
      } | null;
      if (saved) return applyLayout(saved.historyW, saved.mapW);
      return applyLayout(288, Math.round(shellWidth() * 0.44));
    }

    function bind(el: HTMLElement | null, kind: "history" | "map") {
      if (!el) return;
      const startDrag = (event: PointerEvent) => {
        if (window.matchMedia("(max-width: 900px)").matches) return;
        event.preventDefault();
        document.body.classList.add("dragging");
        const startX = event.clientX;
        const startHistory = document.getElementById("history-col")!.getBoundingClientRect().width;
        const startMap = document.querySelector(".map-pane")!.getBoundingClientRect().width;
        const move = (ev: PointerEvent) => {
          const dx = ev.clientX - startX;
          if (kind === "history") applyLayout(startHistory + dx, startMap);
          else applyLayout(startHistory, startMap - dx);
        };
        const stop = () => {
          document.body.classList.remove("dragging");
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
      };
      el.addEventListener("pointerdown", startDrag);
      el.addEventListener("dblclick", () => current());
      const keydown = (ev: KeyboardEvent) => {
        const step = ev.shiftKey ? 48 : 24;
        const hist = document.getElementById("history-col")!.getBoundingClientRect().width;
        const mapW = document.querySelector(".map-pane")!.getBoundingClientRect().width;
        if (ev.key === "ArrowLeft") {
          ev.preventDefault();
          kind === "map" ? applyLayout(hist, mapW + step) : applyLayout(hist - step, mapW);
        }
        if (ev.key === "ArrowRight") {
          ev.preventDefault();
          kind === "map" ? applyLayout(hist, mapW - step) : applyLayout(hist + step, mapW);
        }
      };
      el.addEventListener("keydown", keydown);
      return () => {
        el.removeEventListener("pointerdown", startDrag);
        el.removeEventListener("keydown", keydown);
      };
    }

    const cleanH = bind(document.getElementById("gutter-history"), "history");
    const cleanM = bind(document.getElementById("gutter-map"), "map");
    const wide = () => applyLayout(200, Math.round(shellWidth() * 0.55));
    const reset = () => {
      localStorage.removeItem(LAYOUT_KEY);
      current();
    };
    document.getElementById("btn-map-wide")?.addEventListener("click", wide);
    document.getElementById("btn-layout-reset")?.addEventListener("click", reset);
    window.addEventListener("resize", current);
    current();
    return () => {
      cleanH?.();
      cleanM?.();
      document.getElementById("btn-map-wide")?.removeEventListener("click", wide);
      document.getElementById("btn-layout-reset")?.removeEventListener("click", reset);
      window.removeEventListener("resize", current);
    };
  }, [onChange]);
}
