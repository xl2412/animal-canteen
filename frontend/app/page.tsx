"use client";
import { useEffect, useState } from "react";
import "./styles.css";

type Device = { deviceId: string; name: string; online: boolean; state: { foodPercent?: number; todayFeedCount?: number; lastFedAt?: string } };
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function Home() {
  const [device, setDevice] = useState<Device | null>(null);
  const [feeding, setFeeding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { fetch(`${API_BASE}/api/devices`).then((r) => r.ok ? r.json() : Promise.reject(new Error("设备加载失败"))).then((d) => setDevice(d.items[0] ?? null)).catch((e: Error) => setError(e.message)); }, []);
  const feed = async () => {
    if (!device) return;
    setFeeding(true); setMessage(""); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/devices/${device.deviceId}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grams: 20 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "喂食失败");
      setMessage(`命令已发送 · ${data.requestId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "喂食失败"); } finally { setFeeding(false); }
  };
  const food = device?.state.foodPercent ?? 0;
  const online = device?.online ?? false;
  return <main className="shell">
    <header className="topbar"><div><span className="eyebrow">ANIMAL CANTEEN</span><h1>今天也要好好吃饭 🐾</h1></div><div className="avatar">M</div></header>
    <section className="hello"><p>早上好，主人</p><strong>小橘正在等你准备一餐</strong></section>
    <section className="stats"><article><span>今日喂食</span><strong>{device?.state.todayFeedCount ?? 0} 次</strong><small>最近 {device?.state.lastFedAt ?? "暂无记录"}</small></article><article><span>余粮状态</span><strong className="mint">{food > 20 ? "充足" : "偏低"}</strong><small>约 {food}%</small></article></section>
    <section className="device-card"><div className="device-title"><div className="pet">🐱</div><div><h2>{device?.name ?? "正在加载设备..."}</h2><p><i className={online ? "online" : "offline"} /> {online ? "在线" : "设备暂时休息中"}</p></div></div><div className="progress"><div style={{ width: `${food}%` }} /></div><div className="device-meta"><span>余粮 {food}%</span><span>{device ? "API 已连接" : "连接中..."}</span></div></section>
    <button className="feed" onClick={feed} disabled={feeding || !device || !online} aria-live="polite">{feeding ? "正在准备一餐..." : online ? "立即喂食 · 20g" : "设备离线"}</button>
    {message && <p className="notice success">{message}</p>}{error && <p className="notice error">{error}</p>}
    <nav className="nav"><a className="active">⌂<span>首页</span></a><a>▣<span>设备</span></a><a>◷<span>记录</span></a><a>⚙<span>设置</span></a></nav>
  </main>;
}
