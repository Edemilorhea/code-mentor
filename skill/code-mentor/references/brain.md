# 內容大腦：路徑 A、B

`SKILL.md`「內容大腦」選到路徑 A 或 B 時讀一次。路徑 C 不讀這一份。

## A：tutor 當大腦

1. 載入 `implementation-understanding-tutor`。它規定的 quality contract、code-teach contract 需要時一併載入。
2. 用 tutor 的規則決定：主要情境、站的順序、每站的「為了什麼」情境句、每段程式的講法（責任 → 輸入 → 結果 → 交給誰 → 下游影響）。
3. 有 `change-understanding-review` 時也載入它，只用它的 Added／Modified／Removed 判斷與「依需求意圖分組」，填進 `change` 與站的分組。
4. tutor 的以下部分**不適用**，不要照做：
   - guided 模式的「一次一站、等使用者說下一站」：code-mentor 一次產出整份 HTML。
   - 「每輪閱讀預算」（一輪最多 1 張圖、3 段程式）：改用本 skill 的「一站只回答一個問題」。
   - tutor 的「Optional: HTML walkthrough」與 `explain-with-code-walkthrough`：tutor 的「程式邏輯」內容寫進 `guide.json` 的 `logic`，由 `build` 產生「邏輯導讀」分頁，不另外寫 HTML。
   - tutor 的輸出路徑 `$TEMP/opencode/walkthrough/`：輸出一律在 `collect` 回報的工作資料夾。
5. 兩邊衝突時：**格式、覆蓋、輸出位置聽 code-mentor；內容怎麼講聽 tutor。**
6. 把 tutor 的結果對應到 `guide.json`：情境句 → `situation`／`purpose`／`did`；逐段講解 → 帶 `step` 與 `to` 的 notes；需要先懂的機制 → 子站或 `mechanisms`。`教學` 等級時，核心方法的程式邏輯另外寫進 `logic`：「為了什麼」情境句 → `situation`；輸入／前置狀態 → `input`；逐段講解 → `steps`；結果 → `result`；交給誰 → `handoff`；失敗或下游影響 → `failure`。

## B：review 當大腦

1. 載入 `change-understanding-review`。
2. 用它把變更依需求意圖分組，判斷每組 Added／Modified／Removed，找出實際程式範圍。分組 → 情境站，判斷 → `change`，範圍 → `hunks`。
3. 「怎麼逐段講」用 `station.md` 的規則。`教學` 等級時，核心方法同樣要填 `logic`（`logic.md`）。
4. 它是講解變更的 skill，不是 code review。不要寫正確性、安全性評分或核准意見。
