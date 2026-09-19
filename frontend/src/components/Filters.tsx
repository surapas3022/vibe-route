type Props = {
  region: string;
  province: string;
  provinces: string[];
  preferSecondary: boolean;
  onRegion: (value: string) => void;
  onProvince: (value: string) => void;
  onPreferSecondary: (value: boolean) => void;
};

export function Filters({
  region,
  province,
  provinces,
  preferSecondary,
  onRegion,
  onProvince,
  onPreferSecondary,
}: Props) {
  return (
    <div className="filters">
      <h2>ตัวกรอง</h2>
      <label>
        ภาค
        <select value={region} onChange={(e) => onRegion(e.target.value)}>
          <option value="ภาคเหนือ">ภาคเหนือ</option>
          <option value="ภาคกลาง" disabled>
            ภาคกลาง — ยังไม่ ingest
          </option>
          <option value="ภาคตะวันออกเฉียงเหนือ" disabled>
            ภาคตะวันออกเฉียงเหนือ — ยังไม่ ingest
          </option>
          <option value="ภาคใต้" disabled>
            ภาคใต้ — ยังไม่ ingest
          </option>
          <option value="ภาคตะวันออก" disabled>
            ภาคตะวันออก — ยังไม่ ingest
          </option>
        </select>
      </label>
      <label>
        จังหวัด
        <select value={province} onChange={(e) => onProvince(e.target.value)}>
          <option value="">ทุกจังหวัดในภาคเหนือ</option>
          {provinces.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={preferSecondary}
          onChange={(e) => onPreferSecondary(e.target.checked)}
        />
        <span>
          <strong>เน้นชุมชนและจังหวัดรอง</strong>
          <br />
          ปิดแล้วจะเรียงตามความตรงมู้ด รวมเมืองหลัก
        </span>
      </label>
    </div>
  );
}
