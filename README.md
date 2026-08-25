# 动物食堂

ESP8266 智能喂食器与移动端 H5 管理控制台。

## 技术栈

- `frontend/`: Next.js + React + TypeScript
- `backend/`: FastAPI + Python
- `firmware/`: ESP8266 Arduino 固件骨架
- `docker-compose.yml`: 本地 MQTT Broker、PostgreSQL、Redis

## 本地启动

```bash
docker compose up -d

# 终端 1：启动 FastAPI
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 终端 2：启动 H5
cd frontend
pnpm install && pnpm dev
```

访问 http://localhost:3000，API 文档位于 http://localhost:8000/docs。

## 当前实现与技术方案的差异

已落地：设备与宠物绑定、首页设备列表、设备详情、设备信息编辑、放粮时间配置、手动放粮、PostgreSQL 数据模型与初始化、H5 调用 FastAPI、成功/失败反馈、FastAPI CORS、设备列表/详情、份量校验、唯一 requestId 和喂食记录接口。

待补齐：JWT 登录与设备归属鉴权、MQTT Consumer（state/result/availability）、WebSocket 实时推送、真实设备接入、记录筛选与设置页。放粮时间当前只保存配置，不执行定时任务；MQTT 尚未连接真实 Broker。

### 与文档验收标准对应关系

- 375px/390px/414px 无横向滚动：页面使用 `min-height: 100dvh`、窄屏容器和响应式断点。
- 触控区域：主按钮高度 52px，底部导航和头像均满足基础触控尺寸。
- 控制状态：前端已有 idle/submitting 的基础表现；设备结果闭环需待 MQTT Consumer 与 WebSocket 完成。
- 安全边界：当前接口已校验设备存在、在线状态和份量范围；用户认证及设备绑定仍是后续工作。
