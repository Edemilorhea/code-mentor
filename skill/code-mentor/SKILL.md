---
name: code-mentor
description: 把本機 git 分支／修改／MR 的 diff 做成情境導向的 code 導讀（離線 HTML 加 Markdown，像 GitLab diff 一樣逐段講解）。當使用者說「導讀這個分支」「導讀這次修改」「導讀這個 MR」「像 GitLab diff 一樣講解」「產生 code 導讀 HTML／Markdown」「看懂 migration／產生檔的修改」時使用。
---

# code-mentor：情境導向的 code 導讀

你只負責寫 `guide.json`（說明、情境站、哪些 hunk 屬於哪裡、行註解、圖）。
真正的 diff、GitLab 風格渲染、「每個檔案都被涵蓋」的檢查都由 `code-mentor` 工具負責。

## 0. 內容大腦：先決定誰負責「怎麼理解、怎麼講」

code-mentor 只負責 diff 的收集、渲染與覆蓋檢查。講解內容由「內容大腦」決定。開始前依下表選**一條**路徑，並在第一則回覆用一行告訴使用者選了哪條。

### 怎麼知道有沒有某個 skill

1. 由 `/code-mentor` 指令啟動時，提示裡有「本機偵測到的 skill」清單。**以那份清單為準**，不要再自己猜或搜尋檔案系統。
2. 沒有清單時，只看你目前可用的 skill 列表（系統提供的 available skills）。列表裡沒有 = 沒有。不要去磁碟上找 SKILL.md。

### 路徑

| 偵測結果 | 路徑 | 做法 |
|---|---|---|
| 有 `implementation-understanding-tutor` | **A：tutor 當大腦** | 見下方 A |
| 沒有 tutor，有 `change-understanding-review` | **B：review 當大腦** | 見下方 B |
| 兩個都沒有 | **C：內建規則** | 只用本 skill 第 5 節 |

`diagram-design` 不是大腦，它只影響圖（見下方 D），可以和 A、B、C 任一條並用。

### A：tutor 當大腦

1. 載入 `implementation-understanding-tutor`。它規定的 quality contract、code-teach contract 需要時一併載入。
2. 用 tutor 的規則決定：主線情境、站的順序、每站的「為了什麼」情境句、每段程式的講法（責任 → 輸入 → 結果 → 交給誰 → 下游影響）。
3. 有 `change-understanding-review` 時也載入它，只用它的 Added／Modified／Removed 判斷與「依需求意圖分組」，填進 `change` 與站的分組。
4. tutor 的以下部分**不適用**，不要照做：
   - guided 模式的「一次一站、等使用者說下一站」：code-mentor 一次產出整份 HTML。
   - 「每輪閱讀預算」（一輪最多 1 張圖、3 段程式）：改用本 skill 的「一站只回答一個問題」。
   - tutor 的「Optional: HTML walkthrough」與 `explain-with-code-walkthrough`：輸出一律是 code-mentor 的 `guide.json` → `build`。
   - tutor 的輸出路徑 `$TEMP/opencode/walkthrough/`：輸出一律在 `.code-mentor/out/`。
5. 兩邊衝突時：**格式、覆蓋、輸出位置聽 code-mentor；內容怎麼講聽 tutor。**
6. 把 tutor 的結果對應到 `guide.json`：情境句 → `situation`／`purpose`／`did`；逐段講解 → 帶 `step` 與 `to` 的 notes；需要先懂的機制 → 子站或 `mechanisms`。

### B：review 當大腦

1. 載入 `change-understanding-review`。
2. 用它把變更依需求意圖分組，判斷每組 Added／Modified／Removed，找出實際程式範圍。分組 → 情境站，判斷 → `change`，範圍 → `hunks`。
3. 「怎麼逐段講」用本 skill 第 5 節的規則。
4. 它是講解變更的 skill，不是 code review。不要寫正確性、安全性評分或核准意見。

### C：內建規則

只用本 skill 第 5 節。不要因為沒有 tutor 就降低講解深度：第 5 節的 `what`／`how`／`why`／`syntax` 要求照樣適用。

### D：圖

- 有 `diagram-design`：只在使用者要求「架構圖」「sequence 圖」或一站的機制用文字講不清楚時，才用它畫圖。把畫好的單檔 HTML 存在 `.code-mentor/out/diagrams/`，在該站的 callout 裡寫相對路徑連結。不要把它的 HTML 貼進 `guide.json`。
- 沒有 `diagram-design`：用 `guide.json` 的 `mechanisms[].diagram`（flow／state）。migration 的資料表圖由工具自動產生，不必另畫。

### 不論哪條路徑都不能違反

- 每個變更檔都要被涵蓋，`check` 要 0 錯誤。
- 不要自己用 shell 讀整份 `diff.json`。看 diff 用 `show`。
- 沒有證據的意圖寫「推測：」，不確定就寫「不確定」。

## 1. 準備

- 在 OpenCode 裡且有 `code_mentor` 工具（`collect`、`show`、`check`、`build`）時，**一律用工具**，不要用 shell 跑 CLI。以下說的 `code-mentor collect` 等指令，在工具模式下對應同名工具，參數名稱相同（`--no-worktree` → `noWorktree`、`--include-ignored` → `includeIgnored`、`--keep-cr` → `keepCr`）。
- 沒有工具時，先試 `code-mentor help`。找不到指令時用 `npx -y @edemilorhea/code-mentor <子指令>`，或 `npm i -g @edemilorhea/code-mentor`。
- 套件還沒發佈時：`npm i -g <套件資料夾路徑>`。
- 工作目錄是目前 repo 的 `.code-mentor/`（工具會自動加 `.gitignore`）。

## 2. 選擇比較範圍

先決定比較範圍，再執行 `collect`。

| 使用者說 | 指令 |
|---|---|
| 「導讀這個分支」「導讀這次修改」（預設） | `code-mentor collect`，不加參數。從 reflog 確認分支建立時的基準，再比較「merge-base → 工作目錄」，**包含未 commit 與未追蹤檔** |
| 只要已 commit 的部分 | `code-mentor collect --no-worktree` |
| 提到 MR／PR 編號或網址 | `code-mentor collect --mr <iid>` |
| 給兩個 ref 或 commit | `code-mentor collect --range a..b` |
| 指定另一個 base 分支 | `code-mentor collect --base <ref>` |

- 分支模式只使用本機 reflog 的分支建立證據，不會以預設分支或最近的共同祖先猜測。`--base <ref>` 明確覆寫此值。
- 若建立證據不存在、reflog 已過期、ref 不存在或證據有歧義，工具會停止並要求 `--base`。Git reflog 會過期或被清理。
- 若目前就在建立基準分支，工具會報錯。請改用 `--base` 或 `--mr`。
- MR 網址取 iid：`/-/merge_requests/123` 或 `/pull/123` 最後的數字。用 `git remote -v` 比對網址的主機或路徑，選出 `--remote`（預設 `origin`）。
- MR 模式會 fetch `merge-requests/<iid>/head`（失敗再試 `pull/<iid>/head`）。目標分支優先順序：`--target`、`glab`／`gh` 查到的值、原有預設分支偵測。
- 符合 `.gitignore` 的檔案不會進導讀，就算它已被 git 追蹤。`collect` 會印出排除了哪些。使用者要看它們時加 `--include-ignored`。
- **寫 guide.json 之前，一定先告訴使用者**這次用了什麼比較：base、merge-base sha、檔案數、被排除的檔案數（`collect` 開頭會印出）。

## 3. 流程

1. `code-mentor collect [選項]`：讀印出的表格（id、狀態、+/−、旗標 gen／large、路徑、hunk 數）。`collect` 已停用 Git 的外部 textconv；二進位檔仍列在清單，不會冒充文字 diff。
2. 先把**所有檔案**按情境歸類，列出核心程式、接線、產生檔與其他變更。大型分支先確定每個檔案的去向，再深入閱讀；不要先把整份 `diff.json` 或大量原始檔倒進對話。
3. `code-mentor show <fileId|hunkId|path>`：優先看核心流程、跨檔接線、重要行為差異，以及無法判斷作用的 hunk。行號是新檔行號；diff 看不懂時才讀相應原始碼。已讀過的內容不要重讀。
4. 依第 5 節規則寫 `.code-mentor/guide.json`。每個檔案都要有具體去向；篇幅按變更的影響分配，不按 hunk 數平均分配。
5. `code-mentor check`：修到 0 個錯誤；它只檢查格式與覆蓋，不代表講解內容正確。抽查主要情境、產生檔說明與行註解，刪除套版或沒有證據的說法。
6. `code-mentor build`：產生 `.code-mentor/out/index.html` 與 `guide.md`。
7. 告訴使用者 HTML 路徑並開啟它（Windows `start`、macOS `open`、Linux `xdg-open`）。

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
        "kind": "what|how|why|syntax|good|risk|bug|info", "text": "..."
      }],
      "callouts": [{ "kind": "what|how|why|syntax|good|risk|bug", "title": "...", "text": "markdown-lite" }]
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
  "kinds": { "後端": ["src/server/**", "apps/api/**"], "前端": ["ClientApp/**"] },
  "files": {
    "path/to/file": {
      "kind": "前端|後端|資料庫|其他",
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
- 「依檔案」分頁把檔案分成 前端／後端／資料庫／其他。優先順序：`files[path].kind` > `kinds`（glob，`**` 跨目錄、`*` 單層）> 工具依副檔名與路徑猜。工具只看副檔名，分不出 Node／monorepo 的 `.js`／`.ts`。專案的 `.js`／`.ts` 同時有前後端時（看 `package.json` 依賴：`express`、`@nestjs/*`、`fastify` 是後端，`react`、`vue`、`@angular/*` 是前端；也看目錄結構），**必須**填 `kinds`。少數例外檔再用 `files[path].kind`。
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
- **一站只回答一個問題。** 一站裡有兩個以上的決策、轉換或規則時，拆成子站。`check` 會在一站引用超過 6 個區塊時警告。
- 核心檔用 hunk id（`f13#2`）引用，讓每個區塊只顯示一段程式和它的註解。整檔引用（`f13`）只給接線、設定、產生檔。
- 每站的「情境／為了完成／我做了」三句要寫成**情境句**，不要寫技術術語。讀者卡住時最常問「你為了什麼而做」，`purpose` 就是回答它的地方。
- 依**資料流**排序，不要依檔案或分層排序。
- 接線（DI 註冊、migration、seed、路由）放在**資料第一次需要它的那一站**。
- 多個情境時，各用 2–3 行情境線說清楚。
- 尚未實作的流程段落標 `gap`。
- `status: "done"` 只在有測試證據時使用。沒有證據就不要說測試跑過；寫在 `evidence`。
- 標出意圖：`Confirmed`、`Inferred` 或 `Unknown`。
- `change`（ADDED／MODIFIED／REMOVED）依**語意角色**判斷，不是依 git 狀態。

### 覆蓋

- 每個變更檔都要被涵蓋。這是 `check` 強制的；即使只改接線或文件，也要交代它在這次修改中的作用。
- 不要把所有東西倒進同一站，要拆到對應的站。大型分支可用簡短的檔案摘要涵蓋次要變更，但核心行為要在情境站深入解釋。
- `files[path].skip` 只給真正的雜訊（格式調整、lockfile），並寫原因。不要用 skip 隱藏還不懂的變更。
- 大修改與產生檔必須有 `files[path].summary`。

### 詳細說明（註解）

導讀的目的：讀者不必自己讀完 diff，就知道**改了什麼、怎麼改、為什麼改、用到的語法怎麼讀**。註解的 `kind` 對應這四件事。

| `kind` | 回答的問題 | 怎麼寫 |
|---|---|---|
| `what` | 改了什麼 | 行為差異：改之前怎樣，改之後怎樣。修改既有邏輯時，用 `side: "old"` 的註解標舊行為，再用新行的註解標新行為 |
| `how` | 怎麼改 | 這段程式負責什麼、吃什麼輸入、產生什麼結果、交給誰用 |
| `why` | 為什麼這樣改 | 設計原因，以及沒有它時下游哪裡會壞 |
| `syntax` | 語法／用法 | 讀者可能不熟的語法、框架 API 或慣用寫法：它是什麼意思、在這裡起什麼作用 |

- **核心區塊**（含決策、轉換或規則的方法）：至少要有 `what` 和 `why`。方法超過約 15 行時，用 `to` 與 `step` 切成 5–15 行一段，每段一則註解，順序對應程式執行順序。
- **報告預設只顯示「重點」**：有行註解的區塊，只顯示註解的 `line`～`to` 範圍前後 3 行，其餘折成「略過 N 行」；讀者可按「看完整檔案」切到整份。所以核心邏輯一定要用範圍註解（`to`）框起來，沒框到的程式會被折起來。
- **次要區塊**（接線、DTO、設定、文件）：一則 `what` 就夠，或由該站的「我做了」涵蓋。不必為了數量逐 hunk 填註解。
- `syntax` 在該語法**第一次出現**的地方解釋一次。之後再出現時用 `see` 指回去，不要重講。
- 註解貼在**精確的那一行**，不要重述程式碼字面。禁止「某檔承擔本情境、與其他檔共同完成」或剪貼前三行程式碼這類套版文字。
- 意圖是推論時，註解開頭寫「推測：」。無法確認的細節寫「不確定」，不要補造。
- 需要跳到別處時用 `see`。
- `check` 會在「有程式變更但沒有任何註解或 callout」的站警告。這個警告代表那一站還沒有導讀，不要用一句空話消掉它。

### Callout 種類

Callout 是整站層級的說明，不貼在某一行上。`what`／`how`／`syntax` 也可以用在 callout，例如用一則 `what` 說明這站改之前與改之後的流程差異。

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
- 每段沿同一條線說：為了什麼 → 責任 → 輸入與前置狀態 → 轉換與結果 → 交給誰 → 失敗或拿掉它時下游會怎樣。只列「誰呼叫誰」不算導讀。
- 用 `step` 的編號對應程式裡的順序。被第 3 段呼叫的方法，放在第 3 段之後講，不要另開一條線。
- 主線先講完，再講失敗路徑、替代路徑與邊界情況。
- 看懂下一段程式前必須先懂的機制（例如交易、快取、授權載入），放在用到它的那段程式**之前**，一次只講一個。

### 產生檔與 Migration

- 產生檔（migration、Designer、ModelSnapshot）要有各檔的 `summary` 與 `explain`：說明它與本次資料模型變更的關係。不要逐行讀或逐行重述數千行的 Designer／Snapshot。
- 對有實際 schema 行為的 migration，說清楚 `Up`／`Down` 中新增或移除的表、欄位、索引與外鍵，必要時解釋 `nullable`、`maxLength`、`onDelete` 等語法；對快照只講本次差異與用途。
- 有可確認的對應關係時，從 Entity 設定（Fluent API、屬性、`DbSet`）挑**關鍵行**對照 migration 行，寫在 `files[migration 路徑].mapping`。每筆 `from` = Entity 行、`to` = migration 行、`text` = 對應原因；沒有可靠對應時明說，不能為了每檔都有 mapping 而猜。
- 工具會自動從 `Up` 推出資料表變更圖，顯示在「機制／架構」分頁。

## 6. 使用者說看不懂時

不要整份重寫。

1. 找出**缺的那座橋**：是少一個名詞定義、少一個步驟，還是順序不對？
2. 只改那一站或那則註解。
3. 一次只加**一個更小的步驟**，用專案裡已出現的詞。
4. 必要時補一個 `intuition`。
5. 重新 `check`、`build`，告訴使用者改了哪一站。
