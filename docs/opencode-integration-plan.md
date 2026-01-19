# Happy + OpenCode 整合規劃文件

## 1. 專案背景

### 1.1 Happy 架構簡述

Happy Coder 由三部分組成：
- **Happy CLI** (`happy`)：本地命令列工具，負責啟動 AI 編程工具並監控輸出
- **Happy Server**：中繼伺服器，作為「加密郵筒」轉發端對端加密的訊息
- **行動/Web 客戶端**：顯示對話內容並發送指令

核心設計原則：**伺服器保持簡單（dumb relay）**，所有複雜邏輯都在 CLI 和客戶端處理。

### 1.2 Happy CLI 現有 AI 工具支援

| 工具 | 實現方式 | 傳輸協議 |
|------|---------|---------|
| Claude | 直接 SDK 整合 | Native SDK |
| Codex | MCP Client | Model Context Protocol |
| Gemini | ACP Backend | Agent Client Protocol (JSON-RPC over stdio) |

### 1.3 OpenCode 概述

OpenCode 是開源的 AI 編程代理，提供：
- **TUI 模式**：終端使用者介面
- **HTTP Server 模式** (`opencode serve`)：REST API + SSE 事件流
- **ACP 模式** (`opencode acp`)：Agent Client Protocol，透過 JSON-RPC over stdio 通訊

## 2. 整合方案選擇

### 2.1 方案比較

| 方案 | 描述 | 優點 | 缺點 |
|------|------|------|------|
| **A. ACP 整合** | 使用 `opencode acp` 透過 AcpBackend | 與 Gemini 架構一致、已有參考實作 | 需要 OpenCode CLI 已安裝 |
| **B. HTTP API 整合** | 使用 `opencode serve` 的 REST API | 可遠端部署 OpenCode Server | 協議轉換複雜、需處理 SSE→WebSocket |
| **C. CLI 子程序** | 直接執行 `opencode` 並解析輸出 | 最簡單 | 輸出解析不穩定、難以處理互動 |

### 2.2 推薦方案：A. ACP 整合

**理由**：
1. Happy CLI 已有成熟的 AcpBackend 實作（用於 Gemini）
2. OpenCode 原生支援 ACP 協議
3. 符合 Happy 的架構理念：CLI 執行本地工具並轉發
4. 複用現有程式碼，減少維護成本

## 3. 技術設計

### 3.1 架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        Happy CLI                                 │
├─────────────────────────────────────────────────────────────────┤
│  index.ts                                                        │
│    └── happy opencode ─────────────────────────────┐             │
│                                                     ▼             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   runOpenCode.ts                             │ │
│  │  1. 認證 & 建立 Happy Session                               │ │
│  │  2. 建立 OpenCode ACP Backend                               │ │
│  │  3. 啟動訊息循環                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   AcpBackend                                 │ │
│  │  - spawn: opencode acp --cwd <project>                      │ │
│  │  - 透過 JSON-RPC over stdio 通訊                            │ │
│  │  - 使用 OpenCodeTransport 處理訊息格式                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               ApiSessionClient (WebSocket)                   │ │
│  │  - 加密訊息並發送到 Happy Server                            │ │
│  │  - 接收手機端指令並轉發給 OpenCode                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Happy Server                               │
│  (無需修改 - 純粹轉發加密訊息)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      行動端 App                                  │
│  - 顯示 OpenCode 對話                                           │
│  - 發送 prompt / 核准權限                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 需要新增的檔案 (happy-cli)

```
src/
├── opencode/
│   ├── runOpenCode.ts          # 主程式進入點
│   ├── types.ts                # OpenCode 特定型別定義
│   └── utils/
│       └── config.ts           # OpenCode 配置管理
├── agent/
│   ├── factories/
│   │   └── opencode.ts         # OpenCode 工廠函數
│   └── transport/
│       └── handlers/
│           └── OpenCodeTransport.ts  # OpenCode 訊息處理器
```

### 3.3 需要修改的檔案 (happy-cli)

| 檔案 | 修改內容 |
|------|---------|
| `src/index.ts` | 新增 `opencode` 子命令路由 |
| `src/agent/factories/index.ts` | 匯出 OpenCode 工廠 |
| `src/agent/index.ts` | 註冊 OpenCode Agent |
| `src/agent/transport/index.ts` | 匯出 OpenCode Transport |

### 3.4 Happy Server 修改

**無需修改**。Happy Server 是純粹的加密訊息轉發，不需要知道 AI 工具類型。

### 3.5 Happy App 修改 (React Native + Expo)

Happy App 使用 **Flavor 系統** 識別不同的 AI 工具，每個會話在 `Metadata.flavor` 中存儲工具類型。

#### 3.5.1 技術棧
- **框架**: React Native 0.81.4 + Expo 54
- **狀態管理**: Zustand 5.0.6
- **通訊**: Socket.io 4.8.1
- **加密**: Tweetnacl (端對端加密)

#### 3.5.2 需要修改的檔案

| 檔案 | 修改內容 | 優先級 |
|------|---------|-------|
| `sources/sync/settings.ts` | 在 `ProfileCompatibilitySchema` 加入 `'opencode'` | P0 |
| `sources/sync/typesRaw.ts` | 在 provider enum 加入 `'opencode'` | P0 |
| `sources/components/Avatar.tsx` | 在 `flavorIcons` 加入 OpenCode 圖標映射 | P0 |
| `sources/assets/images/` | 新增 `icon-opencode.png` 圖標檔案 | P0 |
| `sources/components/AgentInput.tsx` | 新增 `isOpenCode` 條件檢查 | P1 |
| `sources/components/NewSessionWizard.tsx` | 在 Agent 選擇列表加入 OpenCode | P1 |
| `sources/components/ToolView.tsx` | OpenCode 權限模式配置 | P1 |
| `sources/text/translations/*.ts` | 新增 OpenCode 翻譯字串 (en, ru, pl, es) | P2 |

#### 3.5.3 Flavor 系統擴展

```typescript
// sources/sync/settings.ts (L87-91)
const FlavorSchema = z.enum(['claude', 'codex', 'gemini', 'opencode']);

// sources/components/Avatar.tsx (L21-25)
const flavorIcons: Record<string, ImageSourcePropType> = {
  claude: require('@/assets/images/icon-claude.png'),
  codex: require('@/assets/images/icon-codex.png'),
  gemini: require('@/assets/images/icon-gemini.png'),
  opencode: require('@/assets/images/icon-opencode.png'),  // 新增
};
```

#### 3.5.4 Agent 選擇器擴展

```typescript
// sources/components/AgentInput.tsx
const isOpenCode = metadata?.flavor === 'opencode' || agentType === 'opencode';

// 根據 isOpenCode 調整：
// - 權限模式預設值
// - UI 文本顯示
// - 工具呼叫處理
```

#### 3.5.5 訊息格式相容性

**好消息**：App 的訊息規範化系統已經支援 ACP 格式，因此 OpenCode 的訊息格式**無需額外處理**。

```typescript
// sources/sync/typesRaw.ts 已支援：
// 1. 標準格式 (Claude): type: 'text', 'tool_use', 'tool_result'
// 2. 連字號格式 (Codex): 'tool-call' → 'tool_use'
// 3. ACP 格式 (通用): 支援任意 provider
```

## 4. 實作細節

### 4.1 OpenCode 工廠函數

```typescript
// src/agent/factories/opencode.ts

import { AcpBackend, type AcpBackendOptions } from '../acp/AcpBackend';
import type { AgentBackend, AgentFactoryOptions } from '../core';
import { agentRegistry } from '../core';
import { opencodeTransport } from '../transport';

export interface OpenCodeBackendOptions extends AgentFactoryOptions {
  apiKey?: string;           // OpenCode API Key (如果使用雲端服務)
  model?: string | null;     // 模型選擇 (anthropic/claude-*, openai/gpt-*, 等)
  mcpServers?: Record<string, McpServerConfig>;
  permissionHandler?: AcpPermissionHandler;
}

export function createOpenCodeBackend(
  options: OpenCodeBackendOptions
): { backend: AgentBackend; model: string } {

  // 解析 API 金鑰來源
  const apiKey = process.env.OPENCODE_API_KEY || options.apiKey;

  // 決定模型
  const model = options.model || process.env.OPENCODE_MODEL || 'anthropic/claude-sonnet-4-20250514';

  // 構建 ACP 後端配置
  const backendOptions: AcpBackendOptions = {
    agentName: 'opencode',
    cwd: options.cwd,
    command: 'opencode',
    args: ['acp'],           // 使用 ACP 模式
    env: {
      ...options.env,
      ...(apiKey && { OPENCODE_API_KEY: apiKey }),
      ...(options.model && { OPENCODE_MODEL: options.model }),
    },
    mcpServers: options.mcpServers,
    permissionHandler: options.permissionHandler,
    transportHandler: opencodeTransport,
  };

  return {
    backend: new AcpBackend(backendOptions),
    model,
  };
}

export function registerOpenCodeAgent(): void {
  agentRegistry.register('opencode', (opts) =>
    createOpenCodeBackend(opts).backend
  );
}
```

### 4.2 OpenCode Transport Handler

```typescript
// src/agent/transport/handlers/OpenCodeTransport.ts

import type { TransportHandler, StderrContext, StderrResult } from '../TransportHandler';

export class OpenCodeTransport implements TransportHandler {

  filterStderr(context: StderrContext): StderrResult {
    const { line } = context;

    // 過濾 OpenCode 特定的噪音輸出
    const ignorePatterns = [
      /^\s*$/,                           // 空行
      /^Loading/i,                       // 載入訊息
      /^Connecting/i,                    // 連接訊息
      /^Debug:/i,                        // Debug 訊息
      /opencode version/i,               // 版本資訊
    ];

    for (const pattern of ignorePatterns) {
      if (pattern.test(line)) {
        return { shouldIgnore: true };
      }
    }

    return { shouldIgnore: false };
  }

  extractToolName(context: { toolCall: unknown }): string | null {
    // OpenCode 的工具名稱提取邏輯
    const call = context.toolCall as Record<string, unknown>;
    if (call && typeof call.name === 'string') {
      return call.name;
    }
    return null;
  }
}

export const opencodeTransport = new OpenCodeTransport();
```

### 4.3 主程式 runOpenCode.ts

```typescript
// src/opencode/runOpenCode.ts

import { render } from 'ink';
import React from 'react';
import { ApiClient } from '@/api/api';
import { createOpenCodeBackend } from '@/agent/factories/opencode';
import { Credentials } from '@/persistence';
import { createMachineForAgent } from '@/utils/machine';
import { OpenCodeUI } from '@/ui/ink/OpenCodeUI';  // 或復用現有 UI

export interface RunOpenCodeOptions {
  credentials: Credentials;
  startedBy?: 'daemon' | 'terminal';
  model?: string;
}

export async function runOpenCode(opts: RunOpenCodeOptions): Promise<void> {
  const { credentials, startedBy, model } = opts;

  // 1. 建立 API 客戶端
  const api = await ApiClient.create(credentials);

  // 2. 建立或取得機器資訊
  const machine = await createMachineForAgent(api, {
    agentType: 'opencode',
    startedBy,
  });

  // 3. 建立 OpenCode ACP 後端
  const { backend, model: resolvedModel } = createOpenCodeBackend({
    cwd: process.cwd(),
    model,
  });

  // 4. 建立 Happy Session
  const session = await api.getOrCreateSession({
    tag: generateSessionTag(),
    metadata: {
      path: process.cwd(),
      host: os.hostname(),
      os: process.platform,
      machineId: machine.id,
      version: packageJson.version,
      startedBy,
      flavor: 'opencode',
      model: resolvedModel,
    },
  });

  // 5. 建立 Session 同步客戶端
  const sessionClient = api.sessionSyncClient(session);

  // 6. 連接訊息處理
  backend.onMessage((message) => {
    // 將 OpenCode 的訊息加密並發送到 Happy Server
    sessionClient.sendAgentMessage(message);
  });

  sessionClient.on('message', async (msg) => {
    // 從手機端接收的訊息轉發給 OpenCode
    if (msg.type === 'prompt') {
      await backend.sendPrompt(session.id, msg.content);
    } else if (msg.type === 'permission-response') {
      await backend.handlePermission(session.id, msg.requestId, msg.approved);
    }
  });

  // 7. 啟動 UI
  render(<OpenCodeUI backend={backend} session={session} />);

  // 8. 啟動初始會話
  await backend.startSession('');
}
```

### 4.4 CLI 入口修改

```typescript
// src/index.ts 新增

} else if (subcommand === 'opencode') {
  try {
    const { runOpenCode } = await import('@/opencode/runOpenCode');
    const { credentials } = await authAndSetupMachineIfNeeded();

    let startedBy: 'daemon' | 'terminal' | undefined = undefined;
    let model: string | undefined = undefined;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--started-by') {
        startedBy = args[++i] as 'daemon' | 'terminal';
      } else if (args[i] === '--model' || args[i] === '-m') {
        model = args[++i];
      }
    }

    await runOpenCode({ credentials, startedBy, model });
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
  return;
}
```

## 5. 訊息類型對應

### 5.1 OpenCode → Happy 訊息映射

| OpenCode 訊息 | Happy AgentMessage |
|--------------|-------------------|
| 文字輸出 | `{ type: 'model-output', textDelta, fullText }` |
| 工具呼叫 | `{ type: 'tool-call', toolName, args, callId }` |
| 工具結果 | `{ type: 'tool-result', toolName, result, callId }` |
| 權限請求 | `{ type: 'permission-request', id, reason, payload }` |
| 檔案編輯 | `{ type: 'fs-edit', description, diff, path }` |
| 狀態變更 | `{ type: 'status', status }` |

### 5.2 Happy → OpenCode 訊息映射

| 手機端動作 | OpenCode 動作 |
|-----------|--------------|
| 發送 prompt | `backend.sendPrompt(sessionId, prompt)` |
| 核准權限 | `backend.handlePermission(sessionId, requestId, true)` |
| 拒絕權限 | `backend.handlePermission(sessionId, requestId, false)` |
| 提供工具結果 | `backend.handleToolResponse(sessionId, callId, result)` |

## 6. 測試計劃

### 6.1 單元測試

- [ ] OpenCode 工廠函數建立測試
- [ ] Transport Handler 訊息過濾測試
- [ ] 訊息類型轉換測試

### 6.2 整合測試

- [ ] CLI 啟動 `happy opencode` 測試
- [ ] 與 Happy Server 的 WebSocket 連接測試
- [ ] 端對端訊息加密/解密測試

### 6.3 E2E 測試

- [ ] 完整對話流程：手機發送 prompt → OpenCode 回應 → 手機顯示
- [ ] 權限請求流程：OpenCode 請求 → 手機核准 → 執行
- [ ] 會話恢復測試

## 7. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| OpenCode CLI 未安裝 | 無法啟動 | 啟動時檢查並提示安裝指令 |
| ACP 協議版本不相容 | 通訊失敗 | 版本檢查 + 提示升級 |
| OpenCode 回應格式變更 | 解析失敗 | 使用防禦性解析 + 日誌記錄 |
| 權限模型不一致 | UX 混亂 | 明確映射 + 文檔說明 |

## 8. 里程碑

### Phase 1: 基礎整合 (MVP)

**CLI 端:**
- [ ] 建立 OpenCode 工廠和 Transport
- [ ] 實作 `happy opencode` 命令
- [ ] 基本對話功能
- [ ] 訊息加密同步

**App 端:**
- [ ] 新增 OpenCode 圖標資源
- [ ] 擴展 Flavor Schema 支援 `'opencode'`
- [ ] Avatar 組件顯示 OpenCode 圖標
- [ ] 基本訊息顯示

### Phase 2: 功能完善

**CLI 端:**
- [ ] 權限請求處理
- [ ] 檔案編輯預覽
- [ ] 工具呼叫顯示
- [ ] 錯誤處理優化

**App 端:**
- [ ] AgentInput 組件 OpenCode 適配
- [ ] NewSessionWizard 支援選擇 OpenCode
- [ ] ToolView 權限模式配置
- [ ] 翻譯字串 (en, ru, pl, es)

### Phase 3: 進階功能

**CLI 端:**
- [ ] 模型選擇參數
- [ ] MCP Server 配置
- [ ] 會話歷史管理
- [ ] Daemon 模式支援

**App 端:**
- [ ] OpenCode 模型選擇 UI
- [ ] OpenCode 專屬設定頁面
- [ ] 進階權限管理介面

## 9. 參考資料

- [Happy CLI 原始碼](https://github.com/slopus/happy-cli)
- [Happy Server 原始碼](https://github.com/slopus/happy-server)
- [Happy App 原始碼](https://github.com/slopus/happy) - React Native + Expo 行動應用
- [OpenCode 文檔](https://opencode.ai/docs)
- [OpenCode ACP 支援](https://opencode.ai/docs/acp)
- [Agent Client Protocol 規範](https://agentclientprotocol.com)
- [docs/doc.md](./doc.md) - 原始整合分析文件

## 10. 分支管理

所有專案使用統一的 feature branch：

| 專案 | 分支名稱 | 追蹤 |
|------|---------|------|
| happy-cli | `feature/opencode-support` | `upstream/main` |
| happy-server | `feature/opencode-support` | `upstream/main` (無需修改) |
| happy (App) | `feature/opencode-support` | `upstream/main` |

### PR 提交順序建議

1. **happy-cli** - 先提交 CLI 端實作
2. **happy (App)** - 再提交 App 端 UI 支援
3. 兩個 PR 可以互相引用，說明完整功能需要兩邊配合
