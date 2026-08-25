'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import '../../styles.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
type Schedule = { id: number; time: string; grams: number; enabled: boolean };
type Device = {
  deviceId: string;
  nickname: string;
  online: boolean;
  foodPercent: number;
  pet?: { name: string; avatar: string };
  schedules: Schedule[];
};

export default function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [nickname, setNickname] = useState('');
  const [petName, setPetName] = useState('');
  const [avatar, setAvatar] = useState('🐱');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [grams, setGrams] = useState('20');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = () =>
    fetch(`${API}/api/devices/${deviceId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('设备加载失败'))))
      .then((data: Device) => {
        setDevice(data);
        setNickname(data.nickname);
        setPetName(data.pet?.name ?? '');
        setAvatar(data.pet?.avatar ?? '🐱');
      })
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
  }, [deviceId]);
  const feed = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const r = await fetch(`${API}/api/devices/${deviceId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grams: 20 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail);
      setMessage(`已提交喂食命令 · ${d.requestId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '喂食失败');
    } finally {
      setBusy(false);
    }
  };
  const saveInfo = async () => {
    const r = await fetch(`${API}/api/devices/${deviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, pet: { name: petName, avatar } }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.detail ?? '保存失败');
      return;
    }
    setMessage('设备信息已保存');
    load();
  };
  const addSchedule = async (event: FormEvent) => {
    event.preventDefault();
    const r = await fetch(`${API}/api/devices/${deviceId}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: scheduleTime, grams: Number(grams), enabled: true }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.detail?.[0]?.msg ?? '保存失败');
      return;
    }
    setMessage('放粮时间已保存');
    load();
  };
  const removeSchedule = async (id: number) => {
    await fetch(`${API}/api/devices/${deviceId}/schedules/${id}`, { method: 'DELETE' });
    load();
  };
  if (!device)
    return (
      <main className="shell">
        <p>{error || '正在加载...'}</p>
      </main>
    );
  return (
    <main className="shell">
      <button className="back" onClick={() => router.push('/')}>
        ‹ 设备列表
      </button>
      <header className="page-heading">
        <span className="eyebrow">DEVICE DETAIL</span>
        <h1>{device.nickname}</h1>
        <p>
          <i className={device.online ? 'online' : 'offline'} /> {device.online ? '设备在线' : '设备离线'} · {device.pet?.avatar} {device.pet?.name}
        </p>
      </header>
      <section className="detail-card">
        <span>当前余粮</span>
        <strong>{device.foodPercent}%</strong>
        <div className="progress">
          <div style={{ width: `${device.foodPercent}%` }} />
        </div>
      </section>
      <button className="feed" onClick={feed} disabled={busy || !device.online}>
        {busy ? '正在准备一餐...' : device.online ? '手动放粮 · 20g' : '设备离线'}
      </button>
      <section className="form-card">
        <h2>设备与宠物信息</h2>
        <label>
          设备昵称
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </label>
        <label>
          宠物名称
          <input value={petName} onChange={(e) => setPetName(e.target.value)} />
        </label>
        <label>
          宠物头像
          <input value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={4} />
        </label>
        <button className="small-button" onClick={saveInfo}>
          保存信息
        </button>
      </section>
      <section className="form-card">
        <h2>每日放粮时间</h2>
        <p className="muted">当前仅保存配置，暂不自动执行。</p>
        <form className="schedule-form" onSubmit={addSchedule}>
          <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
          <input type="number" min="1" max="500" value={grams} onChange={(e) => setGrams(e.target.value)} />
          <button className="small-button">添加</button>
        </form>
        {device.schedules.length === 0 && <p className="muted">还没有设置放粮时间</p>}
        {device.schedules.map((item) => (
          <div className="schedule-row" key={item.id}>
            <strong>{item.time}</strong>
            <span>{item.grams}g · 已启用</span>
            <button onClick={() => removeSchedule(item.id)}>删除</button>
          </div>
        ))}
      </section>
      {message && <p className="notice success">{message}</p>}
      {error && <p className="notice error">{error}</p>}
    </main>
  );
}
