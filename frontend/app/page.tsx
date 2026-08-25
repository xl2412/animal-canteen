"use client";
import { useState } from "react";

export default function Home() {
  const [feeding, setFeeding] = useState(false);
  const feed = async () => { setFeeding(true); await new Promise((r) => setTimeout(r, 900)); setFeeding(false); };
  return <main className="shell">
    <header className="topbar"><div><span className="eyebrow">ANIMAL CANTEEN</span><h1>今天也要好好吃饭 🐾</h1></div><div className="avatar">M</div></header>
    <section className="hello"><p>早上好，主人</p><strong>小橘正在等你准备一餐</strong></section>
    <section className="stats"><article><span>今日喂食</span><strong>3 次</strong><small>最近 10:30</small></article><article><span>余粮状态</span><strong className="mint">充足</strong><small>约 68%</small></article></section>
    <section className="device-card"><div className="device-title"><div className="pet">🐱</div><div><h2>小橘 · 智能喂食器</h2><p><i className="online" /> 在线 · 刚刚更新</p></div></div><div className="progress"><div style={{width:"68%"}} /></div><div className="device-meta"><span>余粮 68%</span><span>Wi-Fi 良好</span></div></section>
    <button className="feed" onClick={feed} disabled={feeding} aria-live="polite">{feeding ? "正在准备一餐..." : "立即喂食 · 20g"}</button>
    <nav className="nav"><a className="active">⌂<span>首页</span></a><a>▣<span>设备</span></a><a>◷<span>记录</span></a><a>⚙<span>设置</span></a></nav>
  </main>;
}
