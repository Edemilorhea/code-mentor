# 規劃：站的結構、覆蓋與欄位

流程第 2 步讀一次，之後不要重讀。每個深度等級都適用。

## guide.json 的骨架

```json
{
  "title": "標題", "summary": "結論一段", "need": "需求",
  "intent": "Confirmed|Inferred|Unknown",
  "depth": "概覽|導讀|教學",
  "outOfScope": ["..."], "unknowns": ["..."], "evidence": "用了哪些證據、跑過什麼",
  "features": [{ "title": "申請帳號", "what": "申請人填表送出，拿到臨時密碼", "why": "醫院不用再人工開帳號", "status": "done|unverified|gap", "stations": ["s3"] }],
  "scenarios": [{
    "id": "apply", "title": "大同醫院申請帳號", "actor": "申請人",
    "stations": [{
      "id": "s3", "title": "送出申請，拿到臨時密碼", "parent": null,
      "situation": "情境：使用者這時在做什麼",
      "purpose": "為了完成：要解決什麼",
      "did": "我做了：改了哪裡",
      "change": "ADDED|MODIFIED|REMOVED", "status": "done|unverified|gap",
      "hunks": ["f12", "f13#2", "src/x.ts"],
      "callouts": [{ "kind": "what|how|why|syntax|good|risk|bug", "title": "...", "text": "markdown-lite" }]
    }]
  }],
  "kinds": { "後端": ["src/server/**", "apps/api/**"], "前端": ["ClientApp/**"], "資料模型": ["src/**/Migrations/**"] },
  "files": {
    "path/to/file": {
      "kind": "前端|後端|資料模型|其他",
      "role": "測試|產生檔|前端元件|前端 Model|前端 Service|API 入口|後端 Command／Query|後端 Model|後端 Service|DB 設定|設定／資料|其他",
      "summary": "", "purpose": "這個檔案是什麼、為了什麼存在（寫法在 station.md）", "skip": "略過原因", "skipHunks": ["f3#4"]
    }
  }
}
```

其他欄位在用到它的那一份：站的 `intuition`／`chain`／`notes` 在 `station.md`；`spines`／`mechanisms` 在 `spine.md`；`logic` 在 `logic.md`；`files[path].explain`／`mapping` 在 `migration.md`。

欄位說明：

- `depth`：這份導讀的深度等級（`SKILL.md`「深度等級」）。只能是 `概覽`、`導讀`、`教學`；不填時 `check` 照 `導讀` 的規則檢查。
- `features`：「功能總覽」分頁（報告第一個分頁，不放程式）。每個功能一項：`title` 功能名稱、`what` 使用者能做什麼、`why` 為什麼要做、`status` 同站的狀態、`stations` 講這個功能的站 id（指向子站也算涵蓋它的主站）。分頁也顯示 `summary`、`need`、`outOfScope`、`unknowns`。`導讀`／`教學` 沒有 `features` 時 `check` 警告；主站沒被任何功能引用時也警告。
- `hunks`：可填檔案 id（整檔）、路徑，或 hunk id（`f13#2`）。
- `parent`：設為某主站 id 時，這站是子站，顯示成 `3-a`、`3-b`。
- 文字欄位支援 markdown-lite：`` `code` ``、`**粗體**`、空行分段、`- ` 清單、`[文字](diagrams/…)` 連結（開新分頁）。工具會跳脫 HTML。連結只接受 `diagrams/` 開頭的相對路徑，其他寫法（`http:`、`../`、絕對路徑）照原文顯示；連到的檔案不存在時 `check` 報錯。
- 報告上方的下拉選單有四種檢視：整體（全部檔案、只顯示 core）、前端、後端、資料模型（只顯示那一類檔案，core 加 detail）。資料模型檔另依副檔名歸邊：`ts`／`tsx`／`js`／`vue` 也出現在「前端」，其他也出現在「後端」。
- 「依檔案」分頁把檔案分成 前端／後端／資料模型／其他（舊名 `資料庫` 仍可用，等於 `資料模型`）。工具認得的資料模型：`*.model.ts`／`*.schema.ts`／`*.types.ts`、`models/`／`dtos/`／`entities/` 目錄、`*Dto.cs`／`*Views.cs`／`*Entity.cs`、`Configurations/*Configuration.cs`、migration／ModelSnapshot／DbContext／SQL。其他命名的 Entity、enum、interface 要用 `kinds` 或 `files[path].kind` 指定。優先順序：`files[path].kind` > `kinds`（glob，`**` 跨目錄、`*` 單層）> 工具依副檔名與路徑猜。工具只看副檔名，分不出 Node／monorepo 的 `.js`／`.ts`。專案的 `.js`／`.ts` 同時有前後端時（看 `package.json` 依賴：`express`、`@nestjs/*`、`fastify` 是後端，`react`、`vue`、`@angular/*` 是前端；也看目錄結構），**必須**填 `kinds`。少數例外檔再用 `files[path].kind`。
- `files[path].role`（選填）：檔案標題前的彩色標籤，共 12 類（見上方範例）。工具依路徑猜；猜錯時才填。讀者可在「顯示設定」選哪幾類預設收合（預設：測試、產生檔），點標籤可一次收合或展開同類檔案。

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

## 結構

- 一個情境 = **一件使用者看得見的事**，最多 7 個「使用者動作」主站。
- 動作背後的機制、規則放成子站（設 `parent`），不要升成主站。
- **一站只回答一個問題。** 一站裡有兩個以上的決策、轉換或規則時，拆成子站。`check` 會在一站引用超過 6 個區塊時警告。
- 核心檔用 hunk id（`f13#2`）引用，讓每個區塊只顯示一段程式和它的註解。整檔引用（`f13`）只給接線、設定、產生檔。
- 每站的「情境／為了完成／我做了」三句要寫成**情境句**，不要寫技術術語。讀者卡住時最常問「你為了什麼而做」，`purpose` 就是回答它的地方。
- 站與站之間依**資料流**排序，不要依檔案或分層排序。
- **站內順序**：一站的 `hunks` 依閱讀順序排：先資料形狀（model、DTO、Entity、資料表），再入口（畫面元件、Controller），再順著呼叫鏈往下（service → Query／Handler → Policy）。前後端都有的站，前端在前、後端在後。讀者要先知道資料長什麼樣，才看得懂誰在處理它。
- 接線（DI 註冊、migration、seed、路由）放在**資料第一次需要它的那一站**。
- 多個情境時，各用 2–3 行情境線說清楚。
- 尚未實作的流程段落標 `gap`。
- `status: "done"` 只在有測試證據時使用。沒有證據就不要說測試跑過；寫在 `evidence`。
- 標出意圖：`Confirmed`、`Inferred` 或 `Unknown`。
- `change`（ADDED／MODIFIED／REMOVED）依**語意角色**判斷，不是依 git 狀態。

## 覆蓋

- 每個變更檔都要被涵蓋。這是 `check` 強制的；即使只改接線或文件，也要交代它在這次修改中的作用。
- 不要把所有東西倒進同一站，要拆到對應的站。大型分支可用簡短的檔案摘要涵蓋次要變更，但核心行為要在情境站深入解釋。
- `files[path].skip` 只給真正的雜訊（格式調整、lockfile），並寫原因。不要用 skip 隱藏還不懂的變更。
- 大修改與產生檔必須有 `files[path].summary`。

## 預設讀者

讀者看得懂程式的大概意圖，但**不熟這個專案，也不熟 TS／React／C# 的慣用寫法**。除非使用者說明自己的程度，一律照這個假設判斷「要不要講、講到哪」。不要因為一段程式「不是核心邏輯」就假設讀者看得懂。

## Callout 種類

Callout 是整站層級的說明，不貼在某一行上。`what`／`how`／`syntax` 也可以用在 callout，例如用一則 `what` 說明這站改之前與改之後的流程差異。

- `why`（藍）：設計原因。
- `good`（綠）：做得好的地方。
- `risk`（琥珀）：風險或要留意的邊界。
- `bug`（紅）：確定的錯誤。

## 句子規則（參考 ASD-STE100）

- 一句只講一件事。
- 用主動語態：誰、做了什麼、結果是什麼。
- 同一個意思只用一個詞，不要換說法。
- 用到新名詞前先定義它。
- 識別字、路徑、指令、API 名稱保持原樣。
- 不確定時直接寫「不確定」，不要猜。
