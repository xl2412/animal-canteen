'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../../styles.css';

const CLOUD_API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://animal-canteen-backend-production.up.railway.app';
const avatars = ['🐱', '🐶', '🐰', '🐹'];
type Hardware = { deviceId: string; model?: string; mac?: string; firmwareVersion?: string; capabilities?: string[]; pairingRequired?: boolean };

export default function BindDevicePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState('');
  const [provisioningToken, setProvisioningToken] = useState('');
  const [hardware, setHardware] = useState<Hardware | null>(null);
  const [deviceUrl, setDeviceUrl] = useState('http://192.168.4.1');
  const [pairCode, setPairCode] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [petName, setPetName] = useState('');
  const [avatar, setAvatar] = useState('🐱');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wifiHelp, setWifiHelp] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [checkingCloud, setCheckingCloud] = useState(false);

  const requestCloud = async (path: string, options?: RequestInit) => {
    const url = `${CLOUD_API}${path}`;
    const response = await fetch(url, options);
    const text = await response.text();
    let data: unknown = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`云端返回了无效数据（${response.status}）`); }
    if (!response.ok) throw new Error((data as { detail?: string }).detail ?? `云端请求失败（${response.status}）`);
    return data as Record<string, unknown>;
  };

  const begin = async () => {
    setBusy(true); setError('');
    try {
      const data = await requestCloud('/api/devices/provisioning/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setSessionId(String(data.sessionId)); setProvisioningToken(String(data.token)); setStep(2);
    } catch (err) { setError(err instanceof Error ? err.message : '无法创建配网会话'); }
    finally { setBusy(false); }
  };

  const readInfo = async () => {
    setBusy(true); setError('');
    try {
      const url = `${deviceUrl.replace(/\/$/, '')}/api/info`;
      const response = await fetch(url);
      const text = await response.text();
      const data = JSON.parse(text);
      if (!response.ok || !data.deviceId) throw new Error('设备信息不完整');
      setHardware(data); setStep(data.pairingRequired === false ? 4 : 3);
    } catch (err) { setError('无法读取设备。请确认已连接设备热点，并检查地址是否为 http://192.168.4.1。'); }
    finally { setBusy(false); }
  };

  const pair = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${deviceUrl.replace(/\/$/, '')}/api/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: pairCode }) });
      if (!response.ok) throw new Error('配对码错误或已过期');
      setStep(4);
    } catch (err) { setError(err instanceof Error ? err.message : '设备配对失败'); }
    finally { setBusy(false); }
  };

  const provision = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const form = new URLSearchParams({ ssid, password, provisioningToken });
      const response = await fetch(`${deviceUrl.replace(/\/$/, '')}/api/wifi`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
      if (!response.ok) throw new Error('Wi‑Fi 配置失败');
      setStep(5);
    } catch (err) { setError(err instanceof Error ? err.message : 'Wi‑Fi 配置失败'); }
    finally { setBusy(false); }
  };

  const checkCloud = async () => {
    if (!hardware) return;
    setCheckingCloud(true); setError('');
    try {
      await requestCloud('/api/devices/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hardware) });
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const data = await requestCloud(`/api/devices/${hardware.deviceId}/provisioning-status`);
        if (data.online === true || data.status === 'connected') { setCloudReady(true); return; }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      throw new Error('设备暂未上线，请确认手机已重新连接家庭 Wi‑Fi，设备也已成功联网。');
    } catch (err) { setError(err instanceof Error ? err.message : '检查设备上线状态失败'); }
    finally { setCheckingCloud(false); }
  };

  const claim = async (event: FormEvent) => {
    event.preventDefault(); if (!hardware) return; setBusy(true); setError('');
    try {
      const data = await requestCloud(`/api/devices/${hardware.deviceId}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provisioningSessionId: sessionId, provisioningToken, deviceId: hardware.deviceId, nickname, pet: { name: petName, avatar } }) });
      router.push(`/devices/${String(data.deviceId)}`);
    } catch (err) { setError(err instanceof Error ? err.message : '绑定失败'); }
    finally { setBusy(false); }
  };

  return <main className="shell form-shell">
    <button className="back" onClick={() => router.back()}>‹ 返回</button>
    <header className="page-heading"><span className="eyebrow">NEW DEVICE · {step}/5</span><h1>绑定一台新设备</h1><p>跟着步骤，把喂食器安全连接到家庭 Wi‑Fi。</p></header>
    <section className="form-card">
      {step === 1 && <><h2>准备设备</h2><p className="muted">请让设备进入配网模式，然后开始读取设备信息。</p><button className="feed" onClick={begin} disabled={busy}>{busy ? '准备中...' : '开始配网'}</button></>}
      {step === 2 && <><h2>连接设备热点</h2><p className="muted">请打开手机系统 Wi‑Fi 设置，连接设备创建的热点（通常类似 AnimalCanteen-XXXX），再返回这里。</p><button className="outline-button" type="button" onClick={() => setWifiHelp(true)}>查看连接方法</button>{wifiHelp && <p className="notice">请离开当前页面，打开手机“设置 → Wi‑Fi”，连接设备热点后，再回到本页面继续。</p>}<label>设备地址<input value={deviceUrl} onChange={e => setDeviceUrl(e.target.value)} /></label><button className="feed" onClick={readInfo} disabled={busy}>{busy ? '读取中...' : '我已连接，读取设备信息'}</button></>}
      {step === 3 && hardware && <><h2>确认设备</h2><div className="hardware-info"><p>设备 ID：<strong>{hardware.deviceId}</strong></p><p>型号：{hardware.model ?? '未提供'}</p><p>MAC：{hardware.mac ?? '未提供'}</p><p>固件：{hardware.firmwareVersion ?? '未提供'}</p></div><form onSubmit={pair}><label>配对码<input value={pairCode} onChange={e => setPairCode(e.target.value)} placeholder="输入设备显示的配对码" required /></label><button className="feed" disabled={busy}>{busy ? '配对中...' : '确认配对'}</button></form></>}
      {step === 4 && <form onSubmit={provision}><h2>配置家庭 Wi‑Fi</h2><p className="muted">Wi‑Fi 密码只会发送给当前设备，不会保存到云端。</p><label>Wi‑Fi 名称<input value={ssid} onChange={e => setSsid(e.target.value)} required /></label><label>Wi‑Fi 密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="feed" disabled={busy}>{busy ? '发送中...' : '发送 Wi‑Fi 配置'}</button></form>}
      {step === 5 && <>{!cloudReady ? <><h2>等待设备上线</h2><p className="muted">设备正在重启并连接家庭 Wi‑Fi。请先让手机重新连接家庭 Wi‑Fi，再点击检查。</p><button className="feed" type="button" onClick={checkCloud} disabled={checkingCloud}>{checkingCloud ? '检查中...' : '我已重新连接，检查设备'}</button></> : <form onSubmit={claim}><h2>完成设备绑定</h2><p className="muted">设备已连接云端，请填写设备和宠物信息。</p><label>设备昵称<input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="例如 小橘的食堂" required /></label><label>宠物名称<input value={petName} onChange={e => setPetName(e.target.value)} placeholder="例如 小橘" required /></label><label>选择头像<div className="avatar-picker">{avatars.map(item => <button type="button" className={avatar === item ? 'avatar-choice selected' : 'avatar-choice'} key={item} onClick={() => setAvatar(item)}>{item}</button>)}</div></label><button className="feed" disabled={busy}>{busy ? '绑定中...' : '完成绑定'}</button></form>}</>}
      {error && <p className="notice error">{error}</p>}
    </section>
  </main>;
}
