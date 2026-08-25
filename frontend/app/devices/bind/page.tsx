'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import '../../styles.css';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const avatars = ['🐱', '🐶', '🐰', '🐹'];

export default function BindDevicePage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState('');
  const [nickname, setNickname] = useState('');
  const [petName, setPetName] = useState('');
  const [avatar, setAvatar] = useState('🐱');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/devices/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, nickname, pet: { name: petName, avatar } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? '绑定失败');
      router.push(`/devices/${data.deviceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="shell form-shell">
      <button className="back" onClick={() => router.back()}>
        ‹ 返回
      </button>
      <header className="page-heading">
        <span className="eyebrow">NEW DEVICE</span>
        <h1>绑定一台新设备</h1>
        <p>输入设备信息，让小伙伴开始好好吃饭。</p>
      </header>
      <form className="form-card" onSubmit={submit}>
        <label>
          设备 ID
          <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="例如 feeder-demo" required />
        </label>
        <label>
          设备昵称
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="例如 小橘的食堂" required />
        </label>
        <label>
          宠物名称
          <input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="例如 小橘" required />
        </label>
        <label>
          选择头像
          <div className="avatar-picker">
            {avatars.map((item) => (
              <button
                type="button"
                className={avatar === item ? 'avatar-choice selected' : 'avatar-choice'}
                key={item}
                onClick={() => setAvatar(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </label>
        {error && <p className="notice error">{error}</p>}
        <button className="feed" disabled={busy}>
          {busy ? '正在检测设备...' : '检测并绑定'}
        </button>
      </form>
    </main>
  );
}
