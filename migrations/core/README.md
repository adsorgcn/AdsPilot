# core schema 迁移

跨功能共享主数据(offer/click/conversion/ip_intel/browser_profile)。功能①③④ 依赖此 schema。

## 执行

```bash
psql "$DATABASE_URL" -f migrations/core/001_create_core_schema.up.sql
```

回滚:

```bash
psql "$DATABASE_URL" -f migrations/core/001_create_core_schema.down.sql
```

## 分区维护(重要)

`core.clicks` 按月 RANGE 分区。迁移脚本建了当月 + 下月两个分区。**需要定时(每月)新建后续月份分区**,否则写入落在未来月份会失败。建议加一个 cron/定时任务执行:

```sql
-- 每月月初跑一次,建下下月分区
DO $$
DECLARE m date := (date_trunc('month', now()) + interval '2 month')::date;
        n date := (date_trunc('month', now()) + interval '3 month')::date;
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS core.clicks_p%s PARTITION OF core.clicks FOR VALUES FROM (%L) TO (%L)',
    to_char(m,'YYYYMM'), m, n);
END $$;
```
