# 即時預覽（`serve`）

使用者要即時預覽時讀一次。

**即時預覽（只在使用者要求時）**：使用者說「邊寫邊看」「開 serve」「即時預覽」才啟動 `code-mentor serve`，不要自己預設開。
- `serve` 是常駐程序，絕對不要在前景執行（會卡住整個工作階段）。Windows 用 `Start-Process -PassThru -WindowStyle Hidden code-mentor -ArgumentList serve` 並記下 PID；macOS/Linux 用 `nohup code-mentor serve > .code-mentor/serve.log 2>&1 &`（serve 啟動時固定在當下的工作資料夾；換分支 collect 後要看新分支，就停掉舊的再開一個） 並記下 `$!`。
- 啟動前先檢查 4173 是否已有 code-mentor serve 在跑，有就沿用，不要重複開。啟動後用有時限的請求確認 `http://127.0.0.1:<port>/` 回應 200，再把網址給使用者。
- 開著 serve 時，每次存 `guide.json` 會自動重建，**不必再跑 `build`**；交付前仍要跑 `check` 修到 0 錯誤，並跑一次 `build` 留下正式檔案。
- 結束工作或使用者說停止時，只結束你記下的那個 PID；不要殺任何沒確認過的程序。
