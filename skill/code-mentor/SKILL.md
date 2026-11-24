---
name: code-mentor
description: 把本機 git 分支／修改／MR 的 diff 做成情境導向的 code 導讀報告檔（離線 HTML 加 Markdown，像 GitLab diff 一樣逐段講解，整個 diff 的每個檔案都講到）。有三個深度：概覽、導讀（預設）、教學。當使用者說「導讀這個分支」「導讀這次修改」「導讀這個 MR」「概覽這個分支」「產生 code 導讀 HTML／Markdown」「像 GitLab diff 一樣講解」「看懂 migration／產生檔的修改」，或用 `/code-mentor`（含 `--help`）時使用。不用於：只想在對話裡知道改了什麼、不要報告檔（用 change-understanding-review）；想被一站一站帶著讀（用 implementation-understanding-tutor）。
---

# code-mentor：情境導向的 code 導讀

你只負責寫 `guide.json`（說明、情境站、哪些 hunk 屬於哪裡、行註解、圖）。
真正的 diff、GitLab 風格渲染、「每個檔案都被涵蓋」的檢查都由 `code-mentor` 工具負責。

## 怎麼下 prompt（`--help`）

使用者的訊息或 `/code-mentor` 的參數含 `--help`、`-h`，或他問「code-mentor 怎麼用」「怎麼下 prompt」時：讀本 skill 資料夾的 `references/prompt-help.md`，**只**把它的內容原樣回給使用者。不要 `collect`、不要讀程式、不要載入其他 skill、不要加自己的說明。

其他情況不要讀那個檔。

## 哪一步讀哪一份

寫作規則與 `guide.json` 的欄位放在本 skill 資料夾的 `references/`，一份對應一個步驟。**到了那一步才讀，每份只讀一次。** 還沒到的步驟不要先讀：先讀的內容會在用到之前被移出對話。

| 什麼時候 | 讀哪一份 | 內容 |
|---|---|---|
| 流程第 2 步（每次） | `references/plan.md` | 站的結構、覆蓋、預設讀者、callout、句子規則；`guide.json` 的骨架欄位 |
| `collect` 的表格有 migration 或產生檔（旗標 gen） | `references/migration.md` | 產生檔的 `explain`、`mapping` |
| 內容大腦選到路徑 A 或 B | `references/brain.md` | 怎麼用 tutor／review skill |
| 流程第 4 步，寫第一站之前（`概覽` 不讀） | `references/station.md` | 行註解、`chain`、core 與 detail、驗讀 |
| 流程第 4.5 步；或要畫圖、寫 `mechanisms` | `references/spine.md` | 主線 `spines`、簡圖、`diagramFile`、`mechanisms` |
| 流程第 5 步（只有 `教學`） | `references/logic.md` | 邏輯導讀 `logic` |
| `guide.json` 已存在；或使用者說加深、看不懂 | `references/update.md` | 更新／重做模式、加深、只改一站 |
| 使用者要即時預覽 | `references/serve.md` | `serve` 的啟動與停止 |

`check` 的訊息指出某個欄位有問題，而你還沒讀它對應的那一份時，先讀再修。

## 內容大腦：先決定誰負責「怎麼理解、怎麼講」

code-mentor 只負責 diff 的收集、渲染與覆蓋檢查。講解內容由「內容大腦」決定。開始前依下表選**一條**路徑，並在第一則回覆用一行告訴使用者選了哪條。講多深由下方「深度等級」決定，和選哪條路徑無關。

### 怎麼知道有沒有某個 skill

1. 由 `/code-mentor` 指令啟動時，提示裡有「本機偵測到的 skill」清單。**以那份清單為準**，不要再自己猜或搜尋檔案系統。
2. 沒有清單時，只看你目前可用的 skill 列表（系統提供的 available skills）。列表裡沒有 = 沒有。不要去磁碟上找 SKILL.md。

### 路徑

| 偵測結果 | 路徑 | 做法 |
|---|---|---|
| 有 `implementation-understanding-tutor` | **A：tutor 當大腦** | 讀 `references/brain.md` 的 A |
| 沒有 tutor，有 `change-understanding-review` | **B：review 當大腦** | 讀 `references/brain.md` 的 B |
| 兩個都沒有 | **C：內建規則** | 只用本 skill 的 `references/` |

`diagram-design` 不是大腦，它只影響圖（見 `references/spine.md`「圖」），可以和 A、B、C 任一條並用。

### C：內建規則

只用本 skill 的 `references/`。不要因為沒有 tutor 就降低講解深度：講多深只由「深度等級」決定，`references/station.md` 的 `what`／`how`／`why`／`syntax` 要求照樣適用。

### 不論哪條路徑都不能違反

- 每個變更檔都要被涵蓋，`check` 要 0 錯誤。
- 不要自己用 shell 讀整份 `diff.json`。看 diff 用 `show`。
- 沒有證據的意圖寫「推測：」，不確定就寫「不確定」。

## 深度等級：決定寫多少

有三個等級：`概覽`、`導讀`、`教學`。後一級包含前一級。開始前決定**一個**等級，寫進 `guide.json` 的 `depth`，並在第一則回覆和內容大腦路徑一起告訴使用者（例如「深度：導讀。要更深就說『加深成教學』」）。`guide.json` 已存在時，同一則回覆再加一行模式（`references/update.md`），例如「模式：更新（3 個檔案有變）。要整份重想就說『重做導讀』」。偵測到 `change-understanding-review` 時，同一則回覆再加一句：「只想在對話裡看改了什麼、不要報告檔，就說『這次改了什麼』」。

### 怎麼決定

1. `/code-mentor` 的提示裡有「深度等級：X（使用者用參數指定）」時，用 X。
2. 否則看使用者的話：
   - 「概覽」「先看大概」「大概改了什麼就好」→ `概覽`
   - 「教學」「教到懂」「完整講」「每個語法都講」→ `教學`
   - 其他，包含只說「導讀這個分支」→ `導讀`
3. 不要自己升級或降級。檔案很多（扣掉產生檔超過 50 個）而使用者沒指定時，仍然做 `導讀`，只在第一則回覆加一句「檔案很多，想先看大概可以說『改成概覽』」。

### 每一級寫什麼

| 內容 | 概覽 | 導讀 | 教學 |
|---|---|---|---|
| 情境與站：`situation`／`purpose`／`did`／`change`／`hunks` | 要 | 要 | 要 |
| 每個變更檔都被涵蓋（`check` 0 錯誤） | 要 | 要 | 要 |
| `files[path].summary`：大修改與產生檔 | 要 | 要 | 要 |
| 每站一則 `what` 或 `why` callout | 改動不明顯時才寫 | 需要時 | 需要時 |
| 行註解 `what`／`how`／`why`，核心邏輯用範圍註解（`to`）＝ core | **不寫** | 要 | 要 |
| 站的呼叫鏈 `chain`（跨兩個以上檔案的站），寫入的行標 `⇒ 寫入 <表>` | 不寫 | 要 | 要 |
| `spines` 主線（每個會寫入資料的使用者操作一條） | 不寫 | 要，可省略 `example` | 要，含 `example`；沒有時 `check` **報錯** |
| 細部註解 `tier: "detail"`（`references/station.md`「core 與 detail」） | 不寫 | 要，只講作用 | 要，加 `syntax` |
| `syntax` 註解、`intuition` | 不寫 | 使用者問到才寫 | 要 |
| `mechanisms`（含 `diagram`） | 不寫 | 不講就看不懂這次修改時才寫 | 每個跨檔的機制都寫；跨檔的**流程**由主線取代，`mechanisms` 只留給狀態圖 |
| `logic`（邏輯導讀分頁） | 不寫 | 不寫 | 每個含決策、轉換或規則的方法群都寫 |

- `概覽` 省的是「讀多深」：只要讀到能判斷每個檔案屬於哪一站、那一站做了什麼。不要逐個 hunk 用 `show` 讀完。
- `概覽` 的站沒有行註解，`check` 不會因此警告。其他等級照樣會警告。
- `教學` 沒有 `logic` 時 `check` 會警告。這次修改真的沒有含決策或轉換的方法（純接線、設定）時，可以不寫，並在 `evidence` 說明。
- `references/` 的寫作規則在每一級都適用；等級只決定寫哪些欄位，不降低已寫內容的品質。

## 準備

- 在 OpenCode 裡且有 `code_mentor` 工具（`collect`、`show`、`check`、`build`）時，**一律用工具**，不要用 shell 跑 CLI。以下說的 `code-mentor collect` 等指令，在工具模式下對應同名工具，參數名稱相同（`--no-worktree` → `noWorktree`、`--include-ignored` → `includeIgnored`、`--keep-cr` → `keepCr`）。
- 沒有工具時，先試 `code-mentor help`。找不到指令時用 `npx -y @edemilorhea/code-mentor <子指令>`，或 `npm i -g @edemilorhea/code-mentor`。
- 套件還沒發佈時：`npm i -g <套件資料夾路徑>`。
- 產出位置：`.code-mentor/output/docs/<來源>-<hash>/`，每個分支／MR／range 一個資料夾，裡面有 `diff.json`、`guide.json`、`index.html`、`guide.md`、`diagrams/`（`.code-mentor/` 會自動被 git 忽略）。
- **工作資料夾以 `collect` 印出的「工作資料夾：」為準**，`guide.json` 一律寫在那裡。不要寫 `.code-mentor/guide.json`（舊版位置，已不使用）。
- 同一個來源再跑 `collect` 預設沿用並覆蓋那個資料夾（`diff.json` 更新、`guide.json` 沿用、`build` 覆蓋報告），不要問使用者。只有使用者說「開新副本」「另存一份」「不要蓋掉」時才加 `--new`（工具 `new: true`），會另開 `-2`、`-3`。
- `show`／`check`／`build`／`serve` 預設用最近一次 `collect` 的資料夾。同一個 repo 可能有別的工作階段在 collect，所以工具模式下呼叫時都帶上 `dir`（填 collect 回報的路徑），並確認 `check`／`build` 印出的工作資料夾正確。

## 選擇比較範圍

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

## 流程

**讀一站、寫一站。** 不要先把所有 diff 讀完，最後才一次寫 `guide.json`。對話放不下時，較早讀的 diff 會被移出對話，你就得重讀。寫進 `guide.json` 的內容不會消失。

1. `code-mentor collect [選項]`：讀印出的表格（id、狀態、+/−、旗標 gen／large、路徑、hunk 數）。`collect` 已停用 Git 的外部 textconv；二進位檔仍列在清單，不會冒充文字 diff。
2. 讀本 skill 資料夾的 `references/plan.md`（站的結構、覆蓋、`guide.json` 的骨架欄位）。只讀一次。`collect` 的表格有 migration 或產生檔（旗標 gen）時，同時讀 `references/migration.md`。
3. **先寫規劃。** 只看 `collect` 的表格，把**所有檔案**按情境歸類：核心程式、接線、產生檔、其他變更。馬上把規劃寫進 `guide.json`：`title`、`need`、`depth`、每一站的 `id`／`title`／`hunks`（先填整檔 id，例如 `f13`；順序照 `references/plan.md`「站內順序」），`kinds`（前端／後端／資料模型），以及產生檔與雜訊的 `files[path].summary`／`skip`。每站先只留這三個欄位當骨架。這一步只對「從路徑看不出去向」的檔案用 `show`。
   同時寫**功能總覽**：`summary`、`features`（每個功能的 `title`／`what`／`why`／`status`／`stations`）、`outOfScope`、`unknowns`。依據是 commit 訊息、MR 說明、`collect` 的表格；入口檔（畫面、Controller、API）看不出功能時才 `show` 它。不要為了這一步讀完整份 diff。功能用使用者看得見的行為描述，不寫類別或方法名。
3.5. **先給使用者確認功能總覽**（`概覽` 等級跳過）：跑 `code-mentor build`，打開 HTML（只有「功能總覽」有內容），在回覆列出功能清單，問「功能有沒有缺或理解錯？確認後我再寫各站的 code 講解」。**停下來等回答**；使用者指出缺漏就先改 `features` 與站的規劃。使用者一開始說「不用確認」「直接寫完」時不停。
4. **一站一站寫，一次寫完。** 寫第一站之前讀 `references/station.md`（`概覽` 等級不讀）。依站的順序，每一站做完下面三件事才換下一站：
   1. `code-mentor show <fileId|hunkId|path>`：只看這一站的檔案。行號是新檔行號；diff 看不懂時才讀相應原始碼。
   2. 依 `references/station.md` 的規則把這一站**一次寫完**：`situation`／`purpose`／`did`／`change`、`chain`、callout、core 註解與 detail 註解（核心檔的 `hunks` 改成 hunk id）。寫哪些欄位照「每一級寫什麼」。篇幅按變更的影響分配，不按 hunk 數平均分配。不要先寫 core、之後再回頭補 detail：回頭補要重讀 diff 與 `guide.json`。
   3. **局部存檔**：用編輯工具只換掉這站的骨架，不要整份覆寫 `guide.json`（整份覆寫的輸出量會隨檔案變大一直累加）。寫完的站不要再 `show` 它的 diff，也不要重讀整份 `guide.json`。
4.5. `導讀`／`教學` 等級：所有站寫完後，讀 `references/spine.md`，為每個**會寫入資料**的使用者操作（新增、註銷…）寫一條 `spines`。這時各站已讀過，主線用站裡已知的事實組成；只為了 `ref` 或確認寫入哪張表才 `show` 單一 hunk。寫完把 `features[].spine` 連上。
5. 只有 `教學` 等級：讀 `references/logic.md`，挑出含決策、轉換或規則的核心方法，填 `logic`。一次寫一個 section，寫完就存檔。沒有這類方法（純接線、設定）時可以不填。
6. `code-mentor check`：修到 0 個錯誤；它只檢查格式與覆蓋，不代表講解內容正確。抽查主要情境、產生檔說明與行註解，刪除套版或沒有證據的說法。中途想知道還有哪些檔案沒涵蓋，也跑 `check`，不要為此重讀 `guide.json`。
7. `code-mentor build`：在工作資料夾產生 `index.html` 與 `guide.md`（覆蓋上一次的）。
8. 告訴使用者 HTML 路徑並開啟它（Windows `start`、macOS `open`、Linux `xdg-open`）。

**對話被壓縮、要重新載入本 skill 時**（只剩「skill 已載入」的摘要）：重新載入後先跑 `check`，從第一個還沒有註解的站接著寫。已寫完的站不要再 `show`，也不要讀整份 `guide.json`。`references/` 的內容也會一起被移出對話：只重讀目前這一步對應的那一份。

**`guide.json` 已經有內容時**（`collect` 印出「guide.json 已存在，沿用」）：先讀 `references/update.md` 選模式（更新／重做），照它做。使用者說加深、看不懂時也讀它。
