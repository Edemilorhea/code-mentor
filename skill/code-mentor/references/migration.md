# 產生檔與 Migration

`collect` 的表格有 migration 或產生檔（旗標 gen）時讀一次。每個深度等級都適用。

- 產生檔（migration、Designer、ModelSnapshot）要有各檔的 `summary` 與 `explain`：說明它與本次資料模型變更的關係。不要逐行讀或逐行重述數千行的 Designer／Snapshot。
- 對有實際 schema 行為的 migration，說清楚 `Up`／`Down` 中新增或移除的表、欄位、索引與外鍵，必要時解釋 `nullable`、`maxLength`、`onDelete` 等語法；對快照只講本次差異與用途。
- 有可確認的對應關係時，從 Entity 設定（Fluent API、屬性、`DbSet`）挑**關鍵行**對照 migration 行，寫在 `files[migration 路徑].mapping`。每筆 `from` = Entity 行、`to` = migration 行、`text` = 對應原因；沒有可靠對應時明說，不能為了每檔都有 mapping 而猜。
- 工具會自動從 `Up` 推出資料表變更圖，顯示在「機制／架構」分頁。

## 欄位

```json
"files": {
  "path/to/file": {
    "summary": "", "explain": "",
    "mapping": [{ "from": "f5#1:20", "to": "f9#1:14", "text": "Entity 這行產生 migration 那行" }]
  }
}
```

- `files[path].mapping`：Entity 設定行 ↔ Migration 語法行的對照，`from`／`to` 格式同 `see`。
