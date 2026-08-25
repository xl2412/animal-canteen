'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import './styles.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
type Device = { deviceId: string; nickname: string; online: boolean; foodPercent: number; pet?: { name: string; avatar: string } };
export default function Home() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${API}/api/devices`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('设备加载失败'))))
      .then((d) => setDevices(d.items))
      .catch((e: Error) => setError(e.message));
  }, []);
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">ANIMAL CANTEEN</span>
          <h1>今天也要好好吃饭 🐾</h1>
        </div>
        <div className="avatar">M</div>
      </header>
      <section className="hello">
        <p>早上好，主人</p>
        <strong>你的设备都在这里</strong>
      </section>
      {error && <p className="notice error">{error}</p>}
      {devices.length === 0 && !error ? (
        <section className="empty-card">
          <div className="empty-icon">🐾</div>
          <h2>还没有绑定设备</h2>
          <p>绑定喂食器后，就可以随时照顾小伙伴。</p>
          <Link className="feed link-button" href="/devices/bind">
            绑定设备
          </Link>
        </section>
      ) : (
        <section className="device-list">
          {devices.map((device) => (
            <Link className="device-card device-link" href={`/devices/${device.deviceId}`} key={device.deviceId}>
              <div className="device-title">
                <div className="pet">{device.pet?.avatar ?? '🐱'}</div>
                <div>
                  <h2>{device.nickname}</h2>
                  <p>
                    <i className={device.online ? 'online' : 'offline'} /> {device.online ? '在线' : '设备暂时休息中'} ·{' '}
                    {device.pet?.name ?? '未设置宠物'}
                  </p>
                </div>
                <span className="arrow">›</span>
              </div>
              <div className="progress">
                <div style={{ width: `${device.foodPercent}%` }} />
              </div>
              <div className="device-meta">
                <span>余粮 {device.foodPercent}%</span>
                <span>查看详情</span>
              </div>
            </Link>
          ))}
        </section>
      )}
      <Link className="outline-button" href="/devices/bind">
        ＋ 添加设备
      </Link>
      <nav className="nav">
        <Link className="active" href="/">
          ⌂<span>首页</span>
        </Link>
        <Link href="/">
          ▣<span>设备</span>
        </Link>
        <Link href="/">
          ◷<span>记录</span>
        </Link>
        <Link href="/">
          ⚙<span>设置</span>
        </Link>
      </nav>
    </main>
  );
}
