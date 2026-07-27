// services/LocationService.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// 1. 定义全局后台任务名称
export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_MILEAGE_TRACKER_TASK';

// 模块级内存变量：记录上一次位置和实时累加距离
let lastKnownCoords: { latitude: number; longitude: number } | null = null;
let currentTripMeters = 0;

/**
 * 🧮 辅助函数：Haversine 算法（根据两点经纬度计算真实物理距离，单位：米）
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 🌟 核心：定义 TaskManager 后台任务
 * ⚠️ 必须在模块最外层执行，确保入口文件加载时即可向 iOS/Android 系统注册！
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.error('❌ 后台定位异常:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (!location) return;

    const { latitude, longitude, accuracy } = location.coords;

    // 🛡️ 过滤精度极差的无用信号（如精度差于 30 米的点弃用）
    if (accuracy && accuracy > 30) return;

    if (lastKnownCoords) {
      const deltaMeters = calculateHaversineDistance(
        lastKnownCoords.latitude,
        lastKnownCoords.longitude,
        latitude,
        longitude
      );

      // 🛡️ 防抖动过滤：如果移动小于 3 米（比如等红灯时 GPS 漂移），不计入里程
      if (deltaMeters > 3) {
        currentTripMeters += deltaMeters;
        console.log(
          `📍 后台新坐标: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}] | 增加: ${deltaMeters.toFixed(1)}m | 总里程: ${(currentTripMeters / 1000).toFixed(2)}km`
        );
      }
    }

    // 更新最后记录点
    lastKnownCoords = { latitude, longitude };
  }
});

/**
 * 🛠️ 定位服务对外导出的 API 封装
 */
export const LocationService = {
  /**
   * 1. 申请前台+后台定位权限
   */
  async requestPermissions(): Promise<boolean> {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    return bgStatus === 'granted';
  },

  /**
   * 2. 开启后台行程追踪
   */
  async startTracking(): Promise<boolean> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('⚠️ 缺少后台定位权限');
      return false;
    }

    // 重置本次行程计数
    currentTripMeters = 0;
    lastKnownCoords = null;

    // 获取一次当前初始位置
    const currentLoc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    lastKnownCoords = {
      latitude: currentLoc.coords.latitude,
      longitude: currentLoc.coords.longitude,
    };

    // 启动原生后台 GPS 定位监听
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation, // 导航级最高精度
      distanceInterval: 10,                           // 每移动 10 米触发一次更新
      timeInterval: 3000,                             // 或每 3 秒更新一次
      showsBackgroundLocationIndicator: true,         // iOS 顶部显示蓝色定位状态条（苹果合规必填）
      foregroundService: {                            // Android 适配通知栏
        notificationTitle: 'Mileage Tracker Active',
        notificationBody: 'Recording your tax deductible trip...',
      },
    });

    console.log('🟢 后台 GPS 追踪已成功启动');
    return true;
  },

  /**
   * 3. 停止后台行程追踪，并返回本次累加的实际总米数
   */
  async stopTracking(): Promise<number> {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('🔴 后台 GPS 追踪已停止');
    }

    const finalMeters = currentTripMeters;

    // 清空状态
    currentTripMeters = 0;
    lastKnownCoords = null;

    return finalMeters;
  },

  /**
   * 4. 查询当前是否正在后台追踪中
   */
  async isTracking(): Promise<boolean> {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  },

  /**
   * 5. 获取实时已行驶的公里数（供 UI 轮询刷新展示）
   */
  getCurrentDistanceMeters(): number {
    return currentTripMeters;
  },
};