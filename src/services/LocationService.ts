import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

let totalMeters = 0;
let lastCoords: { latitude: number; longitude: number } | null = null;

// 🌟 辅助方法：计算两个 GPS 坐标之间的物理距离（单位：米）
function calculateDistance(
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

// 🌟 注册后台定位任务
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: any) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;

    // 🐛 [修复 1] 必须循环遍历 locations！因为 iOS 退后台唤醒时会批量打包推送多个坐标点
    if (locations && locations.length > 0) {
      for (const location of locations) {
        if (!location || !location.coords) continue;
        const { latitude, longitude } = location.coords;

        if (lastCoords) {
          const dist = calculateDistance(
            lastCoords.latitude,
            lastCoords.longitude,
            latitude,
            longitude
          );

          // 过滤小于 5 米的微小抖动
          if (dist > 5) {
            totalMeters += dist;
            console.log(
              `📍 iOS 后台新坐标: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}] | 增加: ${dist.toFixed(1)}m | 总里程: ${(totalMeters / 1000).toFixed(2)}km`
            );
            lastCoords = { latitude, longitude };
          }
        } else {
          lastCoords = { latitude, longitude };
        }
      }
    }
  }
});

// 🌟 导出 LocationService 对象
export const LocationService = {
  // 1. 开始追踪
  startTracking: async (): Promise<boolean> => {
    // 1️⃣ 请求前台权限
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    totalMeters = 0;
    lastCoords = null;

    // 2️⃣ 尝试请求后台权限（不管成功与否都继续，依靠 iOS 蓝条维持）
    await Location.requestBackgroundPermissionsAsync();

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // 启动 iOS 原生后台定位
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 5,
      
      // 🍎 iOS 专属保活 3 大核心参数：
      showsBackgroundLocationIndicator: true, // 1. 显示 iOS 顶栏蓝色定位指示气泡
      pausesUpdatesAutomatically: false,      // 🐛 [修复 2] 强制写死 false！禁止 iOS 在等红灯时彻底终止定位
      activityType: Location.ActivityType.AutomotiveNavigation, // 🐛 [修复 3] 告知 iOS 这是车载导航模式

      foregroundService: {
        notificationTitle: 'Mileage Tracker Active',
        notificationBody: 'Tracking your drive...',
      },
    });

    return true;
  },

  // 2. 停止追踪并返回总行驶米数
  stopTracking: async (): Promise<number> => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    const recordedMeters = totalMeters;
    totalMeters = 0;
    lastCoords = null;
    return recordedMeters;
  },

  // 3. 将当前 GPS 坐标转换为人类可读的真实街道地址
  getReadableAddress: async (): Promise<string> => {
    try {
      let location = await Location.getLastKnownPositionAsync();
      
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, 
        });
      }

      if (!location) return 'Unknown Location';

      const [place] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (place) {
        const street = place.streetNumber
          ? `${place.streetNumber} ${place.street || ''}`
          : place.street || place.name || '';
        const city = place.city || place.subregion || '';

        const addressStr = [street, city].filter(Boolean).join(', ');
        return addressStr || 'Unknown Address';
      }
    } catch (error) {
      console.log('Reverse geocoding error:', error);
    }
    return 'Location Pin';
  },
};