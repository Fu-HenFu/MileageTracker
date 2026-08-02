import * as SQLite from 'expo-sqlite';

export interface TripRecord {
  id?: number;
  start_time: string;
  end_time: string;
  distance_meters: number;
  category: 'business' | 'personal';
  country_code: 'US' | 'CA' | 'AU';
  deduction_amount: number;
  start_address?: string;
  end_address?: string;
  // 🌟 防稽查字段：商业目的、照片存证与仪表盘读数
  notes?: string;               // 商业目的 / 备注（如：Client Meeting with ABC）
  photo_uri?: string;           // 🌟 存储收据或仪表盘照片路径
  odometer_start?: number;      // 起始仪表盘读数
  odometer_end?: number;        // 终点仪表盘读数
}

// 打开/创建本地数据库文件
const db = SQLite.openDatabaseSync('mileage_tracker.db');

/**
 * 初始化数据库表结构（智能检查字段，无报错隐患）
 */
export const initDatabase = () => {
  // 1. 创建基础表结构（新安装用户一步到位）
  db.execSync(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      distance_meters REAL NOT NULL,
      category TEXT DEFAULT 'business',
      country_code TEXT DEFAULT 'US',
      deduction_amount REAL NOT NULL,
      start_address TEXT,
      end_address TEXT,
      notes TEXT,
      photo_uri TEXT,
      odometer_start REAL,
      odometer_end REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. 动态获取 trips 表当前所有的字段名列表
  const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(trips)');
  const existingColumnNames = columns.map((col) => col.name);

  // 3. 只有当旧设备的表里不存在对应字段时，才优雅补充（老设备平滑升级）
  if (!existingColumnNames.includes('notes')) {
    db.execSync('ALTER TABLE trips ADD COLUMN notes TEXT;');
  }

  if (!existingColumnNames.includes('photo_uri')) {
    db.execSync('ALTER TABLE trips ADD COLUMN photo_uri TEXT;');
  }

  if (!existingColumnNames.includes('odometer_start')) {
    db.execSync('ALTER TABLE trips ADD COLUMN odometer_start REAL;');
  }

  if (!existingColumnNames.includes('odometer_end')) {
    db.execSync('ALTER TABLE trips ADD COLUMN odometer_end REAL;');
  }
};

/**
 * 插入一条新行程（含防稽查字段与照片存证）
 */
export const insertTrip = (trip: TripRecord) => {
  // 🌟 修复：SQL 语句中补齐 photo_uri 字段与 $photo_uri 占位符
  const statement = db.prepareSync(`
    INSERT INTO trips (
      start_time, end_time, distance_meters, category, country_code,
      deduction_amount, start_address, end_address, notes, photo_uri, odometer_start, odometer_end
    )
    VALUES (
      $start_time, $end_time, $distance_meters, $category, $country_code,
      $deduction_amount, $start_address, $end_address, $notes, $photo_uri, $odometer_start, $odometer_end
    )
  `);

  return statement.executeSync({
    $start_time: trip.start_time,
    $end_time: trip.end_time,
    $distance_meters: trip.distance_meters,
    $category: trip.category,
    $country_code: trip.country_code,
    $deduction_amount: trip.deduction_amount,
    $start_address: trip.start_address || '',
    $end_address: trip.end_address || '',
    $notes: trip.notes || '',
    $photo_uri: trip.photo_uri || '', // 🌟 正确绑定保存照片路径
    $odometer_start: trip.odometer_start ?? null,
    $odometer_end: trip.odometer_end ?? null,
  });
};

/**
 * 获取所有行程记录
 */
export const getAllTrips = (): TripRecord[] => {
  return db.getAllSync<TripRecord>('SELECT * FROM trips ORDER BY start_time DESC');
};

/**
 * 根据 ID 删除单条行程记录
 */
export const deleteTrip = (id: number) => {
  const statement = db.prepareSync('DELETE FROM trips WHERE id = $id');
  return statement.executeSync({ $id: id });
};

/**
 * 清空所有行程记录
 */
export const clearAllTrips = () => {
  db.execSync('DELETE FROM trips');
};

/**
 * 修改已有行程的分类并自动重算更新抵税金额
 */
export const updateTripCategory = (
  id: number,
  category: 'business' | 'personal',
  deduction_amount: number
) => {
  const statement = db.prepareSync(
    'UPDATE trips SET category = $category, deduction_amount = $deduction_amount WHERE id = $id'
  );
  return statement.executeSync({
    $category: category,
    $deduction_amount: deduction_amount,
    $id: id,
  });
};