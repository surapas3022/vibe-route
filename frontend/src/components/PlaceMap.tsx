import { useEffect, useRef } from "react";
import L from "leaflet";
import type { MapPoint } from "../types";

const STREET_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const NORTH: L.LatLngExpression = [18.8, 99.0];

type Props = {
  points: MapPoint[];
  layoutTick: number;
};

export function PlaceMap({ points, layoutTick }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    const map = L.map("map", { zoomControl: true }).setView(NORTH, 6);
    L.tileLayer(STREET_TILES, { attribution: "Tiles © Esri" }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!points.length) {
      map.setView(NORTH, 6);
      return;
    }
    points.forEach((pt, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin">${i + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([pt.lat, pt.lng], { icon }).addTo(map);
      marker.bindPopup(`${i + 1}. ${pt.name_th}`);
      markersRef.current.push(marker);
    });
    const b = L.latLngBounds(points.map((pt) => [pt.lat, pt.lng] as L.LatLngTuple));
    map.fitBounds(b, { padding: [24, 24], maxZoom: 12 });
  }, [points]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [layoutTick, points]);

  const meta = points.length
    ? `หมุด ${points.length} จุด · ลากเส้นแบ่งเพื่อขยายแผนที่`
    : "ยังไม่มีหมุด — ลากเส้นแบ่งเพื่อขยายแผนที่";

  return (
    <aside className="map-pane" data-component="PlaceMap">
      <div className="map-head">
        <div>
          <h2>แผนที่</h2>
          <p className="meta">{meta}</p>
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
