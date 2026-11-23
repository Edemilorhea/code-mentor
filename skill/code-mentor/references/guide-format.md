# guide.json 格式

第一次寫 `guide.json` 之前讀一次。文中的「第 N 節」指 `SKILL.md` 的章節。

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
      "intuition": "（選填）生活類比，再說精確意思與限制",
      "situation": "情境：使用者這時在做什麼",
      "purpose": "為了完成：要解決什麼",
      "did": "我做了：改了哪裡",
      "change": "ADDED|MODIFIED|REMOVED", "status": "done|unverified|gap",
      "hunks": ["f12", "f13#2", "src/x.ts"],
      "chain": "（選填）呼叫鏈，多行文字，照原樣顯示",
      "notes": [{
        "hunk": "f13#2", "line": 47, "side": "new|old",
        "to": 62, "step": 1, "see": "f14#1:30",
        "kind": "what|how|why|syntax|good|risk|bug|info", "tier": "core|detail", "text": "..."
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
  "kinds": { "後端": ["src/server/**", "apps/api/**"], "前端": ["ClientApp/**"], "資料模型": ["src/**/Migrations/**"] },
  "files": {
    "path/to/file": {
      "kind": "前端|後端|資料模型|其他",
      "summary": "", "explain": "", "skip": "略過原因", "skipHunks": ["f3#4"],
      "mapping": [{ "from": "f5#1:20", "to": "f9#1:14", "text": "Entity 這行產生 migration 那行" }]
    }
  }
}
```

欄位說明：

- `depth`：這份導讀的深度等級（第 0.5 節）。只能是 `概覽`、`導讀`、`教學`；不填時 `check` 照 `導讀` 的規則檢查。
- `features`：「功能總覽」分頁（報告第一個分頁，不放程式）。每個功能一項：`title` 功能名稱、`what` 使用者能做什麼、`why` 為什麼要做、`status` 同站的狀態、`stations` 講這個功能的站 id（指向子站也算涵蓋它的主站）。分頁也顯示 `summary`、`need`、`outOfScope`、`unknowns`。`導讀`／`教學` 沒有 `features` 時 `check` 警告；主站沒被任何功能引用時也警告。
- `hunks`：可填檔案 id（整檔）、路徑，或 hunk id（`f13#2`）。
- `parent`：設為某主站 id 時，這站是子站，顯示成 `3-a`、`3-b`。
- 文字欄位支援 markdown-lite：`` `code` ``、`**粗體**`、空行分段、`- ` 清單。工具會跳脫 HTML。
- 註解 `note`
  - `line` 是該 hunk 內的行號。`side` 預設 `new`；`side: "old"` 用舊檔行號。
  - `to`（選填）：結束行（同一側）。形成**範圍註解**：範圍左側有色條，說明框放在範圍第一行上方，標題 `L47–L62`。
  - `step`（選填）：數字，顯示成編號圓章。用來把一個方法依序一段一段講。
  - `see`（選填）：`"<hunkId|fileId>:<行號>"`，產生可點的交叉參照，跳到「依檔案」分頁該行。
  - `tier`（選填，預設 `core`）：`core` 在四種檢視都顯示；`detail` 只在「前端」「後端」「資料模型」檢視顯示（第 5 節「core 與 detail」）。
- `chain`（站，選填）：這站的呼叫鏈，顯示在「我做了」下方。用 `→` 表示呼叫、`├`／`└` 表示分支，右邊對齊寫在哪一層、哪個檔或 API。例：

  ```
  清單頁 useEffect
    → load()                    前端：AuthorizedNaturalPersons.tsx
    → service.getList()         GET /api/AuthorizedNaturalPerson
    → Controller.GetList        後端
    → Query.GetListAsync
         ├ ResolveAccessAsync   目前事業與 canManage（2-e）
         └ 組回應：quota/used/items
  ```
- 報告上方的下拉選單有四種檢視：整體（全部檔案、只顯示 core）、前端、後端、資料模型（只顯示那一類檔案，core 加 detail）。資料模型檔另依副檔名歸邊：`ts`／`tsx`／`js`／`vue` 也出現在「前端」，其他也出現在「後端」。
- 「依檔案」分頁把檔案分成 前端／後端／資料模型／其他（舊名 `資料庫` 仍可用，等於 `資料模型`）。工具認得的資料模型：`*.model.ts`／`*.schema.ts`／`*.types.ts`、`models/`／`dtos/`／`entities/` 目錄、`*Dto.cs`／`*Views.cs`／`*Entity.cs`、`Configurations/*Configuration.cs`、migration／ModelSnapshot／DbContext／SQL。其他命名的 Entity、enum、interface 要用 `kinds` 或 `files[path].kind` 指定。優先順序：`files[path].kind` > `kinds`（glob，`**` 跨目錄、`*` 單層）> 工具依副檔名與路徑猜。工具只看副檔名，分不出 Node／monorepo 的 `.js`／`.ts`。專案的 `.js`／`.ts` 同時有前後端時（看 `package.json` 依賴：`express`、`@nestjs/*`、`fastify` 是後端，`react`、`vue`、`@angular/*` 是前端；也看目錄結構），**必須**填 `kinds`。少數例外檔再用 `files[path].kind`。
- `files[path].mapping`：Entity 設定行 ↔ Migration 語法行的對照，`from`／`to` 格式同 `see`。
- `check` 會驗證：`to` ≥ `line` 且兩端在 hunk 內；`see`／`mapping` 的目標存在；`tier` 只能是 `core`／`detail`；`chain` 是字串。`導讀`／`教學` 的站跨兩個以上檔案沒有 `chain`、或只有 detail 沒有 core 時會警告。
- `logic`（選填）：「邏輯導讀」分頁，一個 section 講一個核心方法群。不參與覆蓋檢查（覆蓋仍由 stations 負責）。
  - 必填：`id`（不可重複）、`station`（某個情境裡存在的站 id）、`question`、`steps`（至少 1 步）。其他選填：`situation`、`input`、`result`、`handoff`、`failure`。
  - `steps[]`：`title`、`text`，加上與註解相同的 `hunk`／`line`／`to`／`side`／`kind`／`see`。每步必須指到程式；報告右側面板只顯示該步 `line`～`to` 前後 3 行。
  - `check` 用註解的規則驗證每一步；超過 8 步或某步沒有 `text` 會警告。

```json
"logic": [{
  "id": "l1", "station": "s1",
  "question": "送出申請時，系統怎麼產生並保存臨時密碼？",
  "situation": "申請人按下送出，表單資料到了後端。",
  "input": "已通過前端檢核的表單；DB 裡還沒有這筆申請。",
  "steps": [
    { "title": "後端再檢核一次", "text": "前端檢核可以被繞過，所以後端要再擋。", "hunk": "f1#1", "line": 35, "to": 41, "kind": "why" },
    { "title": "產生臨時密碼", "text": "只存雜湊，明碼只回傳這一次。", "hunk": "f1#2", "line": 60, "to": 68 }
  ],
  "result": "寫入一筆 Draft 申請，回傳臨時密碼明碼一次。",
  "handoff": "前端存進 sessionStorage，導到上傳頁。",
  "failure": "名稱重複時回 400；寄信失敗時申請仍成立，`mailSent=false`。"
}]
```

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
