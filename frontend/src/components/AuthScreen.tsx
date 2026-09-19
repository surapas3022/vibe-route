import { useEffect, useState } from "react";
import {
  api,
  clearAuthSession,
  isWakeError,
  setAuthSession,
  waitForHealth,
  type AuthUser,
} from "../api";

type Props = {
  onAuthed: (user: AuthUser) => void;
};

type Gate = "ready" | "waking" | "failed";

export function AuthScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<Gate>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [wakeKey, setWakeKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let tick = 0;
    setElapsed(0);
    const run = async () => {
      try {
        await api.health();
        if (!ac.signal.aborted) setGate("ready");
      } catch {
        if (ac.signal.aborted) return;
        setGate("waking");
        tick = window.setInterval(() => setElapsed((n: number) => n + 1), 1000);
        try {
          await waitForHealth({ signal: ac.signal });
          if (!ac.signal.aborted) setGate("ready");
        } catch (err) {
          if (ac.signal.aborted) return;
          setGate("failed");
          setError(err instanceof Error ? err.message : "ยังเชื่อมเซิร์ฟเวอร์ไม่ได้");
        } finally {
          window.clearInterval(tick);
        }
      }
    };
    void run();
    return () => {
      ac.abort();
      window.clearInterval(tick);
    };
  }, [wakeKey]);

  const retryWake = () => {
    setError("");
    setGate("waking");
    setWakeKey((n: number) => n + 1);
  };

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
      if (isWakeError(err)) {
        retryWake();
        return;
      }
      setError(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const waiting = gate === "waking";

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
        {gate === "waking" ? (
          <div className="auth-wake" aria-live="polite">
            <span className="auth-spinner" aria-hidden="true" />
            <p className="auth-lede">กำลังปลุกเซิร์ฟเวอร์ ครั้งแรกหลังพักอาจใช้เวลาประมาณ 1 นาที</p>
            <p className="auth-wake-meta">รอมาแล้ว {elapsed} วินาที</p>
          </div>
        ) : null}
        {gate === "failed" ? (
          <div className="auth-wake" aria-live="polite">
            <p className="auth-lede">ยังเชื่อมเซิร์ฟเวอร์ไม่ได้ แผนฟรีอาจหลับอยู่ ลองปลุกอีกครั้ง</p>
            <button type="button" className="auth-retry" onClick={retryWake}>
              ลองเชื่อมอีกครั้ง
            </button>
          </div>
        ) : null}
        {gate === "ready" ? (
          <p className="auth-lede">
            {mode === "login" ? "เข้าสู่ระบบเพื่อเก็บประวัติการค้นของตัวเอง" : "สมัครด้วยอีเมล ยังไม่ต้องยืนยันเมลในรอบนี้"}
          </p>
        ) : null}
        <label>
          อีเมล
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={busy}
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
            disabled={busy}
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
              disabled={busy}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        ) : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" disabled={waiting || busy}>
          {waiting ? "กำลังเชื่อมเซิร์ฟเวอร์" : busy ? "กำลังทำงาน" : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>
        <p className="auth-switch">
          {mode === "login" ? "ยังไม่มีบัญชี " : "มีบัญชีแล้ว "}
          <button
            type="button"
            disabled={waiting}
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
