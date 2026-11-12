---
name: code-mentor
description: 把本機 git 分支／修改／MR 的 diff 做成情境導向的 code 導讀（離線 HTML 加 Markdown，像 GitLab diff 一樣逐段講解）。當使用者說「導讀這個分支」「導讀這次修改」「導讀這個 MR」「像 GitLab diff 一樣講解」「產生 code 導讀 HTML／Markdown」「看懂 migration／產生檔的修改」時使用。
---

# code-mentor：情境導向的 code 導讀

你只負責寫 `guide.json`（說明、情境站、哪些 hunk 屬於哪裡、行註解、圖）。
真正的 diff、GitLab 風格渲染、「每個檔案都被涵蓋」的檢查都由 `code-mentor` 工具負責。

## 1. 準備

- 先試 `code-mentor help`。找不到指令時用 `npx -y @edemilorhea/code-mentor <子指令>`，或 `npm i -g @edemilorhea/code-mentor`。
- 套件還沒發佈時：`npm i -g <套件資料夾路徑>`。
- 工作目錄是目前 repo 的 `.code-mentor/`（工具會自動加 `.gitignore`）。

## 2. 選擇比較範圍

先決定比較範圍，再執行 `collect`。

| 使用者說 | 指令 |
|---|---|
| 「導讀這個分支」「導讀這次修改」（預設） | `code-mentor collect`，不加參數。比較「與主分支的 merge-base → 工作目錄」，**包含未 commit 與未追蹤檔** |
| 只要已 commit 的部分 | `code-mentor collect --no-worktree` |
| 提到 MR／PR 編號或網址 | `code-mentor collect --mr <iid>` |
| 給兩個 ref 或 commit | `code-mentor collect --range a..b` |
| 指定另一個 base 分支 | `code-mentor collect --base <ref>` |

- 主分支自動偵測順序：`origin/HEAD`、本機 `main`、`master`、`develop`、`origin/main`、`origin/master`、`origin/develop`。
- 若目前就在主分支，工具會報錯。請改用 `--base` 或 `--mr`。
- MR 網址取 iid：`/-/merge_requests/123` 或 `/pull/123` 最後的數字。用 `git remote -v` 比對網址的主機或路徑，選出 `--remote`（預設 `origin`）。
- MR 模式會 fetch `merge-requests/<iid>/head`（失敗再試 `pull/<iid>/head`）。目標分支優先順序：`--target`、`glab`／`gh` 查到的值、主分支偵測。
- **寫 guide.json 之前，一定先告訴使用者**這次用了什麼比較：base、merge-base sha、檔案數（`collect` 第一行會印出）。

## 3. 流程

1. `code-mentor collect [選項]`：讀印出的表格（id、狀態、+/−、旗標 gen／large、路徑、hunk 數）。
2. `code-mentor show <fileId|hunkId|path>`：看需要的 hunk，行號是新檔行號。diff 看不懂時才去讀原始碼。
3. 依第 5 節規則寫 `.code-mentor/guide.json`。
4. `code-mentor check`：反覆修到 0 個錯誤。
5. `code-mentor build`：產生 `.code-mentor/out/index.html` 與 `guide.md`。
6. 告訴使用者 HTML 路徑並開啟它（Windows `start`、macOS `open`、Linux `xdg-open`）。

## 4. guide.json 格式

```json
{
  "title": "標題", "summary": "結論一段", "need": "需求",
  "intent": "Confirmed|Inferred|Unknown",
  "outOfScope": ["..."], "unknowns": ["..."], "evidence": "用了哪些證據、跑過什麼",
  "scenarios": [{
    "id": "apply", "title": "大同醫院申請帳號", "actor": "申請人",
    "stations": [{
      "id": "s3", "title": "送出申請，拿到臨時密碼", "parent": null,
      "intuition": "（選填）生活類比，再說精確意思與限制",
      "situation": "情境：使用者這時在做什麼",
      "purpose": "為了完成：要解決什麼",
      "did": "我做了：改了哪裡",
      "change": "ADDED|MODIFIED|REMOVED", "status": "done|unverified|gap",
      "hunks": ["f12", "f13#2", "src/x.ts"],
      "notes": [{
        "hunk": "f13#2", "line": 47, "side": "new|old",
        "to": 62, "step": 1, "see": "f14#1:30",
        "kind": "why|good|risk|bug|info", "text": "..."
      }],
      "callouts": [{ "kind": "why|good|risk|bug", "title": "...", "text": "markdown-lite" }]
    }]
  }],
  "mechanisms": [{
    "id": "m1", "title": "...", "problem": "...", "text": "...", "hunks": [], "notes": [],
    "diagram": {
      "type": "flow|state",
      "nodes": [{ "id": "a", "label": "Draft", "kind": "normal|focal|external|pending" }],
      "edges": [{ "from": "a", "to": "b", "label": "上傳", "dashed": false }]
    }
  }],
  "files": {
    "path/to/file": {
      "summary": "", "explain": "", "skip": "略過原因", "skipHunks": ["f3#4"],
      "mapping": [{ "from": "f5#1:20", "to": "f9#1:14", "text": "Entity 這行產生 migration 那行" }]
    }
  }
}
```

欄位說明：

- `hunks`：可填檔案 id（整檔）、路徑，或 hunk id（`f13#2`）。
- `parent`：設為某主站 id 時，這站是子站，顯示成 `3-a`、`3-b`。
- 文字欄位支援 markdown-lite：`` `code` ``、`**粗體**`、空行分段、`- ` 清單。工具會跳脫 HTML。
- 註解 `note`
  - `line` 是該 hunk 內的行號。`side` 預設 `new`；`side: "old"` 用舊檔行號。
  - `to`（選填）：結束行（同一側）。形成**範圍註解**：範圍左側有色條，說明框放在範圍第一行上方，標題 `L47–L62`。
  - `step`（選填）：數字，顯示成編號圓章。用來把一個方法依序一段一段講。
  - `see`（選填）：`"<hunkId|fileId>:<行號>"`，產生可點的交叉參照，跳到「依檔案」分頁該行。
- `files[path].mapping`：Entity 設定行 ↔ Migration 語法行的對照，`from`／`to` 格式同 `see`。
- `check` 會驗證：`to` ≥ `line` 且兩端在 hunk 內；`see`／`mapping` 的目標存在。

### 最小範例

```json
{
  "title": "新增帳號申請",
  "summary": "申請人送出表單後，系統建立帳號並回傳臨時密碼。",
  "intent": "Inferred",
  "scenarios": [{
    "id": "apply", "title": "申請帳號", "actor": "申請人",
    "stations": [{
      "id": "s1", "title": "送出申請", "parent": null,
      "situation": "申請人填完表單，按下送出。",
      "purpose": "系統要建立帳號，並讓申請人能登入。",
      "did": "新增 `ApplyHandler`，建立帳號並產生臨時密碼。",
      "change": "ADDED", "status": "unverified",
      "hunks": ["f1"],
      "notes": [{ "hunk": "f1#1", "line": 12, "kind": "why", "text": "密碼只在這裡出現一次，所以要立刻回傳。" }]
    }]
  }],
  "files": { "package-lock.json": { "skip": "只是鎖定檔更新" } }
}
```

## 5. 寫作規則

### 結構

- 主線 = **一個使用者看得見的情境**，最多 7 個「使用者動作」站。
- 動作背後的機制、規則放成子站（設 `parent`），不要升成主站。
- 每站的「情境／為了完成／我做了」三句要寫成**情境句**，不要寫技術術語。
- 依**資料流**排序，不要依檔案或分層排序。
- 接線（DI 註冊、migration、seed、路由）放在**資料第一次需要它的那一站**。
- 多個情境時，各用 2–3 行情境線說清楚。
- 尚未實作的流程段落標 `gap`。
- `status: "done"` 只在有測試證據時使用。沒有證據就不要說測試跑過；寫在 `evidence`。
- 標出意圖：`Confirmed`、`Inferred` 或 `Unknown`。
- `change`（ADDED／MODIFIED／REMOVED）依**語意角色**判斷，不是依 git 狀態。

### 覆蓋

- 每個變更檔都要被涵蓋。這是 `check` 強制的。
- 不要把所有東西倒進同一站，要拆到對應的站。
- `files[path].skip` 只給真正的雜訊（格式調整、lockfile），並寫原因。
- 大修改與產生檔必須有 `files[path].summary`。

### 詳細說明（註解）

- 每個**非瑣碎的 hunk 至少一則註解**。
- 大檔或核心檔要做**分段導讀**：用 `to` 標出範圍，再用 `step` 編號 ①②③，一段一段走完一個方法。
- 註解貼在**精確的那一行**，講**為什麼**，不要重述程式碼做了什麼。
- 需要跳到別處時用 `see`。

### Callout 種類

- `why`（藍）：設計原因。
- `good`（綠）：做得好的地方。
- `risk`（琥珀）：風險或要留意的邊界。
- `bug`（紅）：確定的錯誤。

### 直覺層（選填 `intuition`）

- 只在概念抽象時使用。
- 先用一個生活類比，再寫精確意思，最後寫類比的限制。
- 例：「像櫃台領號碼牌（類比）。精確來說，`Outbox` 是…。類比不涵蓋：號碼牌不會重送。」

### 句子規則（參考 ASD-STE100）

- 一句只講一件事。
- 用主動語態：誰、做了什麼、結果是什麼。
- 同一個意思只用一個詞，不要換說法。
- 用到新名詞前先定義它。
- 識別字、路徑、指令、API 名稱保持原樣。
- 不確定時直接寫「不確定」，不要猜。

### 程式導讀結構（參考 code walkthrough）

- 先講這段程式在整體流程中的角色，再逐段走。
- 每段說：責任、輸入、輸出、交給誰、影響誰。
- 用 `step` 的編號對應程式裡的順序。

### 產生檔與 Migration

- 產生檔（migration、Designer、ModelSnapshot）必須有 `explain`，用白話逐行教語法：
  - `Up`／`Down`：套用與還原。
  - `table.Column<T>`：欄位型別；`nullable`、`maxLength` 的意義。
  - `HasIndex` → `CreateIndex`；`principalTable`、`onDelete`。
  - `Designer`／`ModelSnapshot` 的用途：記錄目前模型快照，供下次產生 migration 比對。
- **每個 migration 都要做 mapping**：把 Entity 設定（Fluent API、屬性、`DbSet`）的行，對應到它產生的 migration 行。寫在 `files[migration 路徑].mapping`，每筆 `from` = Entity 行、`to` = migration 行、`text` 說明為什麼這行會產生那行。
- 工具會自動從 `Up` 推出資料表變更圖，顯示在「機制／架構」分頁。

## 6. 使用者說看不懂時

不要整份重寫。

1. 找出**缺的那座橋**：是少一個名詞定義、少一個步驟，還是順序不對？
2. 只改那一站或那則註解。
3. 一次只加**一個更小的步驟**，用專案裡已出現的詞。
4. 必要時補一個 `intuition`。
5. 重新 `check`、`build`，告訴使用者改了哪一站。
