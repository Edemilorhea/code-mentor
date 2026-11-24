# 邏輯導讀（`logic`）

流程第 5 步讀一次。只有 `教學` 等級寫。

- 一個 section 只講一個方法群，`question` 是一個問題（「送出時怎麼…？」），不是方法名。
- 每個 section 4–8 步，依**執行順序**排列，每步只框一段程式（`line`～`to`）。
- 接線、DTO、設定不放進 `logic`，它們留在情境站裡講。
- `text` 寫一到兩句「做什麼、為什麼」，不要把程式字面再念一次。
- 被第 3 步呼叫的方法，放在第 3 步之後講。
- `result`、`handoff`、`failure` 寫實際的值和狀態（回傳什麼、寫入哪張表、哪個錯誤碼），不寫「處理完成」這類空話。

## 欄位

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
