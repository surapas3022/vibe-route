import { useEffect, useRef } from "react";
import L from "leaflet";
import { formatKm, kmBetween, type MapPoint } from "../types";

const STREET_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const NORTH: L.LatLngExpression = [18.8, 99.0];
const NUDGE_MIN_KM = 0.22;

type Props = {
  points: MapPoint[];
  layoutTick: number;
  focusId?: string | null;
  originId?: string | null;
  radiusKm?: number | null;
  viewKey?: string | null;
  onSelect?: (attId: string) => void;
};

function pinHtml(pt: MapPoint, label: string): string {
  const kind = pt.kind || "result";
  return `<div class="pin is-${kind}">${label}</div>`;
}

function pinSize(kind: MapPoint["kind"]): [number, number] {
  if (kind === "origin") return [34, 34];
  if (kind === "nearby") return [22, 22];
  return [26, 26];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function popupText(pt: MapPoint, label: string): string {
  const title =
    pt.kind === "origin" ? `ฐาน · ${pt.name_th}` : pt.kind === "nearby" ? `ใกล้ · ${pt.name_th}` : `${label}. ${pt.name_th}`;
  const km = pt.kind === "nearby" && pt.distance_km != null ? `${formatKm(pt.distance_km)} กม.` : "";
  const bits = [pt.type_label, km].filter(Boolean).join(" · ");
  const blurb = pt.blurb ? `<p>${escapeHtml(pt.blurb)}</p>` : "";
  return `<div class="map-pop"><strong>${escapeHtml(title)}</strong>${bits ? `<small>${escapeHtml(bits)}</small>` : ""}${blurb}</div>`;
}

function offsetKm(lat: number, lng: number, km: number, angle: number): [number, number] {
  const lat2 = lat + (km / 111) * Math.cos(angle);
  const lng2 = lng + (km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))) * Math.sin(angle);
  return [lat2, lng2];
}

/** Keep true coordinates in data; shift stacked pins so 0.3km neighbors stay clickable. */
export function displayLatLngs(points: MapPoint[]): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const placed: Array<{ att_id: string; lat: number; lng: number }> = [];
  for (const pt of points) {
    let lat = pt.lat;
    let lng = pt.lng;
    let tries = 0;
    while (placed.some((item) => kmBetween(item, { lat, lng }) < NUDGE_MIN_KM) && tries < 14) {
      const angle = -Math.PI / 2 + tries * 0.9;
      const radius = NUDGE_MIN_KM * (1.15 + tries * 0.12);
      [lat, lng] = offsetKm(pt.lat, pt.lng, radius, angle);
      tries += 1;
    }
    placed.push({ att_id: pt.att_id, lat, lng });
    out.set(pt.att_id, [lat, lng]);
  }
  return out;
}

export function PlaceMap({ points, layoutTick, focusId, originId, radiusKm, viewKey, onSelect }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Array<{ att_id: string; marker: L.Marker }>>([]);
  const circleRef = useRef<L.Circle | null>(null);
  const linesRef = useRef<L.Polyline[]>([]);
  const onSelectRef = useRef(onSelect);
  const userView = useRef(false);
  const ignoreUserView = useRef(false);
  const lastFit = useRef({ viewKey: "", radiusKm: null as number | null, zoom: null as number | null });
  onSelectRef.current = onSelect;

  useEffect(() => {
    const map = L.map("map", { zoomControl: true }).setView(NORTH, 6);
    L.tileLayer(STREET_TILES, { attribution: "Tiles © Esri" }).addTo(map);
    const noteUser = () => {
      if (ignoreUserView.current) return;
      userView.current = true;
    };
    map.on("zoomstart", noteUser);
    map.on("dragstart", noteUser);
    map.on("zoomend", () => {
      if (ignoreUserView.current) return;
      if (lastFit.current.zoom != null && map.getZoom() !== lastFit.current.zoom) {
        userView.current = true;
      }
    });
    mapRef.current = map;
    return () => {
      map.off("zoomstart", noteUser);
      map.off("dragstart", noteUser);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((item) => item.marker.remove());
    markersRef.current = [];
    circleRef.current?.remove();
    circleRef.current = null;
    linesRef.current.forEach((line) => line.remove());
    linesRef.current = [];

    const origin = points.find((pt) => pt.kind === "origin") || points.find((pt) => pt.att_id === originId) || null;
    const nearby = points.filter((pt) => pt.kind === "nearby");
    const display = displayLatLngs(points);
    let nearbyIndex = 0;
    let resultIndex = 0;

    if (!points.length) {
      userView.current = false;
      lastFit.current = { viewKey: "", radiusKm: null, zoom: null };
      map.setView(NORTH, 6);
      return;
    }

    points.forEach((pt) => {
      const kind = pt.kind || "result";
      let label = "";
      if (kind === "origin") label = "ฐาน";
      else if (kind === "nearby") {
        nearbyIndex += 1;
        label = String(nearbyIndex);
      } else {
        resultIndex += 1;
        label = String(resultIndex);
      }
      const size = pinSize(kind);
      const icon = L.divIcon({
        className: "map-pin-wrap",
        html: pinHtml(pt, label),
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1] / 2],
      });
      const pos = display.get(pt.att_id) || [pt.lat, pt.lng];
      const marker = L.marker(pos, {
        icon,
        riseOnHover: true,
        zIndexOffset: kind === "origin" ? 600 : kind === "nearby" ? 400 : 200,
      }).addTo(map);
      marker.bindPopup(popupText(pt, label), { maxWidth: 260 });
      marker.on("click", () => onSelectRef.current?.(pt.att_id));
      markersRef.current.push({ att_id: pt.att_id, marker });
      if (pos[0] !== pt.lat || pos[1] !== pt.lng) {
        const line = L.polyline([[pt.lat, pt.lng], pos], {
          color: "#38bdf8",
          weight: 1,
          dashArray: "4 4",
          opacity: 0.8,
          interactive: false,
        }).addTo(map);
        linesRef.current.push(line);
      }
    });

    if (origin && radiusKm) {
      const circle = L.circle([origin.lat, origin.lng], {
        radius: radiusKm * 1000,
        color: "#10b981",
        weight: 1,
        fillColor: "#34d399",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
      circleRef.current = circle;
    }

    const key = viewKey || "";
    if (key !== lastFit.current.viewKey) userView.current = false;
    const shouldFit =
      !userView.current || key !== lastFit.current.viewKey || radiusKm !== lastFit.current.radiusKm;
    if (shouldFit) {
      const pinPoints = origin ? [origin, ...nearby] : points;
      const b = L.latLngBounds(pinPoints.map((pt) => [pt.lat, pt.lng] as L.LatLngTuple));
      ignoreUserView.current = true;
      map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
      map.once("moveend", () => {
        lastFit.current.zoom = map.getZoom();
        ignoreUserView.current = false;
      });
      lastFit.current = { viewKey: key, radiusKm: radiusKm ?? null, zoom: lastFit.current.zoom };
    }
  }, [points, originId, radiusKm, viewKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const pt = points.find((item) => item.att_id === focusId);
    const entry = markersRef.current.find((item) => item.att_id === focusId);
    markersRef.current.forEach((item) => {
      item.marker.getElement()?.querySelector(".pin")?.classList.toggle("is-focus", item.att_id === focusId);
    });
    if (!pt) return;
    const latlng = entry?.marker.getLatLng() || L.latLng(pt.lat, pt.lng);
    if (!map.getBounds().pad(0.15).contains(latlng)) {
      map.panTo(latlng, { animate: true, duration: 0.45 });
    }
    entry?.marker.openPopup();
  }, [focusId, points]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [layoutTick, points]);

  const nearbyCount = points.filter((pt) => pt.kind === "nearby").length;
  const origin = points.find((pt) => pt.kind === "origin");
  const meta = !points.length
    ? "ยังไม่มีหมุด — ลากเส้นแบ่งเพื่อขยายแผนที่"
    : origin
      ? `ฐาน «${origin.name_th}» · จุดใกล้ๆ ${nearbyCount} จุด${radiusKm ? ` ใน ${radiusKm} กม.` : ""}`
      : `หมุด ${points.length} จุด · กดการ์ดเพื่อซูมไปที่หมุด`;

  return (
    <aside className="map-pane" data-component="PlaceMap">
      <div className="map-head">
        <div>
          <h2>แผนที่</h2>
          <p className="meta">{meta}</p>
          {origin ? (
            <ul className="map-legend">
              <li>
                <span className="pin is-origin" aria-hidden="true">
                  ฐาน
                </span>
                จุดเริ่ม
              </li>
              <li>
                <span className="pin is-nearby" aria-hidden="true">
                  1
                </span>
                จุดใกล้ๆ
              </li>
              <li>
                <span className="pin" aria-hidden="true">
                  #
                </span>
                ผลค้น
              </li>
            </ul>
          ) : null}
        </div>
        <div className="map-tools">
          <button type="button" id="btn-map-wide">
            ขยายแผนที่
          </button>
          <button type="button" id="btn-layout-reset">
            คืนค่าเลย์เอาต์
          </button>
        </div>
      </div>
      <div id="map" />
    </aside>
  );
}
