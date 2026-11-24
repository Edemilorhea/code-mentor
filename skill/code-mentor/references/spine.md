# 主線、機制與圖

流程第 4.5 步讀一次。要畫圖或寫 `mechanisms` 時也讀這一份。

## 主線（`spines`）

讀者要先看到整條路，再選一段放大看。站是一段一段的；主線把一次操作串成一條。讀完一條主線，讀者要能不看資料答出：流過哪幾個檔案、寫進哪些表、失敗時會留下什麼。

- **閱讀順序**：功能總覽 → 主線（每條約 5 分鐘）→ 站（需要細節才讀）。報告會在功能總覽頂端寫出這個順序。
- 一條主線 = 一個會寫入資料的使用者操作，從按鈕講到資料表。只讀的操作（清單、檢視）不寫主線，用站的 `chain`。
- 固定四段：`diagram`（每個節點標模組與檔案）、`steps`（每步連到站）、`example`（同一個具體例子的每張表那一列，標出串接的值）、`failure`（哪一步失敗、留下什麼、怎麼補救）。最後一題 `recall`。
- **出處規則**：步驟、範例列、失敗路徑的每一項都要有 `ref`（`hunkId:line`，格式同註解的 `see`），指到證明這件事的程式行。diff 看不到的事（另一個模組的交易會不會回滾、某張表的其他欄位）不要推論成事實，標 `unverified: true`，報告顯示「未驗證」。寧可標未驗證，也不要寫得像確定。
- 主線講過整條鏈的站，`chain` 可以縮成「本站是主線 p1 第 N 步」，不要重寫一次。
- **簡圖規則**（`diagram`）：
  - 節點 label 只寫「模組＋動作」，例如「② Customer 開帳號」，不超過 12 個字。
  - 邊 label 只寫編號，或留空。
  - Handler 名稱、檔案 id、寫入的表放在 `steps`，不放進圖。
  - 節點超過 6 個，或圖裡有分支或失敗路徑時，另外用 `diagram-design` 畫 sequence 圖，存到 `diagrams/`，填進 `diagramFile`。
  - `check` 在節點 label 超過 24 字、邊 label 超過 12 字、或一個節點連出超過 3 條都有 label 的邊時警告。

### 欄位

```json
"features": [{ "title": "申請帳號", "spine": "p1", "stations": ["s3"] }],
"spines": [{
  "id": "p1", "title": "送出申請：從按鈕到資料表", "text": "（選填）一兩句開場",
  "diagram": { "type": "flow", "nodes": [{ "id": "a", "label": "① 前端送出", "kind": "focal" }], "edges": [] },
  "diagramFile": "（選填）diagrams/p1-apply.html",
  "steps": [{ "file": "f12", "module": "前端", "does": "按送出，POST /api/apply", "writes": "", "station": "s3", "ref": "f12#2:40" },
            { "file": "f20", "module": "Account", "does": "建帳號", "writes": "Account（新增一列）", "station": "s3", "ref": "f20#1:55" }],
  "exampleCase": "以王小明（A123456789）申請為例",
  "example": [{ "table": "Account", "op": "新增", "row": "Id=101, Name=王小明", "link": "Id → Apply.AccountId", "ref": "f20#1:55" }],
  "failure": [{ "when": "第 2 步建帳號失敗", "leaves": "Apply 已寫入、Account 沒有", "fix": "重送會再建一次", "unverified": true }],
  "recall": "不看資料，說出送出申請流過哪些檔案、寫了哪些表。", "recallAnswer": "（選填）答案"
}],
"noSpine": "（選填）教學等級有 SaveChanges 卻不需要主線的原因，例如只有 seed"
```

- `spines`：「主線」分頁（緊接在功能總覽之後）。
  - `steps[]`：`file`（檔案或 hunk id）、`module`（所在模組）、`does`、`writes`（寫入哪張表，沒寫入留空）、`station`（對應的站 id，必填）。
  - `example[]`：同一個具體例子，每張表最後新增或修改的那一列。`table`、`op`、`row`、`link`（靠哪個值串到別的表）。`導讀` 等級可省略。
  - `failure[]`：`when`、`leaves`（會留下什麼）、`fix`（怎麼補救）。
  - `recall`：一題重述題，讀者不看資料回答；`recallAnswer` 選填。
  - `features[].spine`：功能總覽先連主線，再連站。
- `noSpine`：`教學` 等級程式有 `SaveChanges` 卻沒有 `spines` 時 `check` 報**錯誤**；寫入不是使用者操作（seed、腳本）時，填這個欄位說明原因。
- `spines[].diagramFile`、`mechanisms[].diagramFile`（選填）：用 `diagram-design` 畫的細節圖，例如 `"diagrams/p1-confirm.html"`。報告在簡圖下方加「開啟完整圖」連結；有 `diagramFile` 時可以不寫 `diagram`。路徑規則同 `plan.md` 的 markdown-lite 連結。

## 機制（`mechanisms`）

寫不寫照 `SKILL.md`「每一級寫什麼」。

```json
"mechanisms": [{
  "id": "m1", "title": "...", "problem": "...", "text": "...", "hunks": [], "notes": [],
  "diagram": {
    "type": "flow|state",
    "nodes": [{ "id": "a", "label": "Draft", "kind": "normal|focal|external|pending" }],
    "edges": [{ "from": "a", "to": "b", "label": "上傳", "dashed": false }]
  }
}]
```

## 圖（`diagram-design`）

- 有 `diagram-design`：只在使用者要求「架構圖」「sequence 圖」或一站的機制用文字講不清楚時，才用它畫圖。用 `diagram-design` 畫的圖存在工作資料夾的 `diagrams/`（和 `index.html` 同一層）。主線與機制用 `diagramFile` 指向它；站內用 `[說明](diagrams/xxx.html)` 連到它。報告內建的 `diagram` 只當簡圖，用來讓讀者一眼看出順序。不要把它的 HTML 貼進 `guide.json`。
- 沒有 `diagram-design`：用 `guide.json` 的 `mechanisms[].diagram`（flow／state）。migration 的資料表圖由工具自動產生，不必另畫。
