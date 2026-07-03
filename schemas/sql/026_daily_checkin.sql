-- 每日签到系统
-- 用于追踪用户签到记录和连续签到奖励

-- 1. 创建签到记录表
CREATE TABLE IF NOT EXISTS "DailyCheckin" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "checkinDate" DATE NOT NULL,
    "reward" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 唯一约束：每个用户每天只能签到一次
    CONSTRAINT unique_user_checkin_per_day UNIQUE ("userId", "checkinDate")
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_date
ON "DailyCheckin"("userId", "checkinDate" DESC);

CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_created
ON "DailyCheckin"("userId", "createdAt" DESC);

-- 3. 添加注释
COMMENT ON TABLE "DailyCheckin" IS '每日签到记录表';
COMMENT ON COLUMN "DailyCheckin"."userId" IS '用户ID';
COMMENT ON COLUMN "DailyCheckin"."checkinDate" IS '签到日期';
COMMENT ON COLUMN "DailyCheckin"."reward" IS '本次签到奖励Token数';
COMMENT ON COLUMN "DailyCheckin"."streak" IS '连续签到天数';
COMMENT ON COLUMN "DailyCheckin"."createdAt" IS '签到时间戳';

-- 4. 创建获取用户签到状态的函数
CREATE OR REPLACE FUNCTION get_user_checkin_status(p_user_id TEXT)
RETURNS TABLE (
    has_checked_in_today BOOLEAN,
    current_streak INTEGER,
    next_reward INTEGER,
    last_checkin_date DATE
) AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_last_checkin_date DATE;
    v_last_streak INTEGER := 0;
    v_checked_today BOOLEAN := FALSE;
BEGIN
    -- 获取最后一次签到记录
    SELECT "checkinDate", "streak"
    INTO v_last_checkin_date, v_last_streak
    FROM "DailyCheckin"
    WHERE "userId" = p_user_id
    ORDER BY "checkinDate" DESC
    LIMIT 1;

    -- 检查今天是否已签到
    IF v_last_checkin_date = v_today THEN
        v_checked_today := TRUE;
    END IF;

    -- 计算当前连续签到天数
    IF v_last_checkin_date IS NULL THEN
        -- 从未签到
        v_last_streak := 0;
    ELSIF v_last_checkin_date = v_today THEN
        -- 今天已签到，使用记录的streak
        v_last_streak := v_last_streak;
    ELSIF v_last_checkin_date = v_yesterday THEN
        -- 昨天签到了，今天未签到，streak保持
        v_last_streak := v_last_streak;
    ELSE
        -- 中断了，重置为0
        v_last_streak := 0;
    END IF;

    -- 计算下次奖励
    RETURN QUERY SELECT
        v_checked_today,
        v_last_streak,
        calculate_checkin_reward(v_last_streak + 1),
        v_last_checkin_date;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建计算签到奖励的函数
CREATE OR REPLACE FUNCTION calculate_checkin_reward(p_streak INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- 基础奖励: 1 Token
    -- 每7天额外奖励: +5 Tokens
    -- 每30天额外奖励: +20 Tokens
    CASE
        WHEN p_streak % 30 = 0 THEN RETURN 21; -- 1 + 20 (30天奖励)
        WHEN p_streak % 7 = 0 THEN RETURN 6;   -- 1 + 5 (7天奖励)
        ELSE RETURN 1;                          -- 基础奖励
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建执行签到的函数
CREATE OR REPLACE FUNCTION perform_daily_checkin(
    p_user_id TEXT,
    OUT success BOOLEAN,
    OUT reward INTEGER,
    OUT new_streak INTEGER,
    OUT new_balance BIGINT,
    OUT message TEXT
) AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_last_checkin_date DATE;
    v_last_streak INTEGER := 0;
    v_checkin_id UUID;
BEGIN
    -- 检查今天是否已签到
    SELECT "checkinDate", "streak"
    INTO v_last_checkin_date, v_last_streak
    FROM "DailyCheckin"
    WHERE "userId" = p_user_id
    ORDER BY "checkinDate" DESC
    LIMIT 1;

    IF v_last_checkin_date = v_today THEN
        success := FALSE;
        reward := 0;
        new_streak := v_last_streak;
        message := '今天已经签到过了';
        RETURN;
    END IF;

    -- 计算新的streak
    IF v_last_checkin_date IS NULL THEN
        new_streak := 1;
    ELSIF v_last_checkin_date = v_yesterday THEN
        new_streak := v_last_streak + 1;
    ELSE
        new_streak := 1; -- 中断了，重新开始
    END IF;

    -- 计算奖励
    reward := calculate_checkin_reward(new_streak);

    -- 开始事务
    BEGIN
        -- 插入签到记录
        INSERT INTO "DailyCheckin" ("userId", "checkinDate", "reward", "streak")
        VALUES (p_user_id, v_today, reward, new_streak)
        RETURNING id INTO v_checkin_id;

        -- 增加用户Token余额
        UPDATE "UserToken"
        SET balance = balance + reward,
            "updatedAt" = NOW()
        WHERE "userId" = p_user_id
        RETURNING balance INTO new_balance;

        -- 创建Token交易记录
        INSERT INTO "TokenTransaction" (
            id, "userId", type, amount, source, description, "createdAt"
        ) VALUES (
            gen_random_uuid(),
            p_user_id,
            'checkin',
            reward,
            'daily_checkin',
            CASE
                WHEN new_streak % 30 = 0 THEN '连续签到30天奖励'
                WHEN new_streak % 7 = 0 THEN '连续签到7天奖励'
                ELSE '每日签到奖励'
            END,
            NOW()
        );

        success := TRUE;
        message := '签到成功！';

    EXCEPTION WHEN OTHERS THEN
        success := FALSE;
        reward := 0;
        message := '签到失败: ' || SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建获取签到日历的函数（最近7天）
CREATE OR REPLACE FUNCTION get_checkin_calendar(p_user_id TEXT)
RETURNS TABLE (
    day_number INTEGER,
    checkin_date DATE,
    checked_in BOOLEAN
) AS $$
DECLARE
    v_start_date DATE := CURRENT_DATE - INTERVAL '6 days';
    v_end_date DATE := CURRENT_DATE;
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(v_start_date, v_end_date, '1 day'::INTERVAL)::DATE AS date
    )
    SELECT
        EXTRACT(DAY FROM ds.date)::INTEGER AS day_number,
        ds.date AS checkin_date,
        EXISTS (
            SELECT 1 FROM "DailyCheckin" dc
            WHERE dc."userId" = p_user_id
              AND dc."checkinDate" = ds.date
        ) AS checked_in
    FROM date_series ds
    ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_checkin_status IS '获取用户签到状态';
COMMENT ON FUNCTION calculate_checkin_reward IS '计算签到奖励（1/6/21 Tokens）';
COMMENT ON FUNCTION perform_daily_checkin IS '执行每日签到';
COMMENT ON FUNCTION get_checkin_calendar IS '获取签到日历（最近7天）';
