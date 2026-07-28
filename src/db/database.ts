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
}

// 打开/创建本地数据库文件
const db = SQLite.openDatabaseSync('mileage_tracker.db');

/**
 * 初始化数据库表结构
 */
export const initDatabase = () => {
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

/**
 * 插入一条新行程
 */
export const insertTrip = (trip: TripRecord) => {
  const statement = db.prepareSync(`
    INSERT INTO trips (start_time, end_time, distance_meters, category, country_code, deduction_amount, start_address, end_address)
    VALUES ($start_time, $end_time, $distance_meters, $category, $country_code, $deduction_amount, $start_address, $end_address)
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
  });
};

/**
 * 获取所有行程记录
 */
export const getAllTrips = (): TripRecord[] => {
  return db.getAllSync<TripRecord>('SELECT * FROM trips ORDER BY id DESC');
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
 * 🌟 修改已有行程的分类并自动重算更新抵税金额
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