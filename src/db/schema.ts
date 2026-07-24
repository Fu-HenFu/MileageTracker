-- 1. 行程表 (Trips)
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time TEXT NOT NULL,          -- 开始时间 (ISO String)
  end_time TEXT NOT NULL,            -- 结束时间 (ISO String)
  distance_meters REAL NOT NULL,     -- 存储底层标准单位：米
  category TEXT DEFAULT 'business',  -- 'business' (商业) 或 'personal' (个人)
  country_code TEXT DEFAULT 'US',    -- 'US', 'CA', 或 'AU'
  deduction_amount REAL NOT NULL,    -- 自动计算出的抵税金额 (如 $24.50)
  start_address TEXT,                -- 起点地址 (可选)
  end_address TEXT,                  -- 终点地址 (可选)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. 系统设置表 (Settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);