import { useState } from "react";
import { api, clearAuthSession, setAuthSession, type AuthUser } from "../api";

type Props = {
  onAuthed: (user: AuthUser) => void;
};

export function AuthScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setBusy(true);
    try {
      clearAuthSession();
      const payload =
        mode === "register"
          ? await api.register({ email, password, confirm_password: confirmPassword })
          : await api.login({ email, password });
      setAuthSession(payload);
      onAuthed(payload.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="kicker">ภาคเหนือ · ข้อเท็จจริงจาก ททท.</p>
        <h1>VibeRoute</h1>
        <p className="auth-lede">
          {mode === "login" ? "เข้าสู่ระบบเพื่อเก็บประวัติการค้นของตัวเอง" : "สมัครด้วยอีเมล ยังไม่ต้องยืนยันเมลในรอบนี้"}
        </p>
        <label>
          อีเมล
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          รหัสผ่าน
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === "register" ? (
          <label>
            ยืนยันรหัสผ่าน
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        ) : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? "กำลังทำงาน" : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>
        <p className="auth-switch">
          {mode === "login" ? "ยังไม่มีบัญชี " : "มีบัญชีแล้ว "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
        </p>
      </form>
    </div>
  );
}
