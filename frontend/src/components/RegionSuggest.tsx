type TrendPlace = {
  att_id: string;
  name_th: string;
  province: string;
  type_label?: string | null;
  likes: number;
};

type TrendQuery = {
  query: string;
  label: string;
  count: number;
};

type Props = {
  region: string;
  days: number;
  queries: TrendQuery[];
  places: TrendPlace[];
  fallbackQueries?: ReadonlyArray<{ q: string; label: string }>;
  onQuery: (query: string) => void;
  onPlace: (name: string) => void;
};

export function RegionSuggest({
  region,
  days,
  queries,
  places,
  fallbackQueries = [],
  onQuery,
  onPlace,
}: Props) {
  const liveQueries = queries.length ? queries : fallbackQueries.map((item) => ({ query: item.q, label: item.label, count: 0 }));
  const live = queries.length > 0 || places.length > 0;
  return (
    <section className="region-suggest" data-component="RegionSuggest">
      <p>
        {live
          ? `ช่วง ${days} วันใน${region} รวมจากทุกคนที่ค้นและกดถูกใจ`
          : `ช่วงนี้ใน${region} ยังรวมโหวตไม่พอ ใช้มู้ดตัวอย่างไปก่อน`}
      </p>
      {places.length ? (
        <>
          <p className="chips-label">คนถูกใจไปที่ไหนมากสุด</p>
          <div className="chips liked">
            {places.map((place) => (
              <button
                key={place.att_id}
                type="button"
                onClick={() => onPlace(place.name_th)}
              >
                <strong>{place.name_th}</strong>
                <small>
                  {place.province} · ถูกใจ {place.likes}
                </small>
              </button>
            ))}
          </div>
        </>
      ) : null}
      <p className="chips-label">{queries.length ? `คนค้นหาอะไรใน${region}` : "คำค้นหายอดนิยม"}</p>
      <div className="chips popular">
        {liveQueries.map((item) => (
          <button key={item.query} type="button" onClick={() => onQuery(item.query)}>
            {item.label}
            {item.count > 1 ? <small> {item.count}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
