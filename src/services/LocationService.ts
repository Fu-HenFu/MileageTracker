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
    const location = locations[0];
    if (location) {
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
            `📍 后台新坐标: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}] | 增加: ${dist.toFixed(1)}m | 总里程: ${(totalMeters / 1000).toFixed(2)}km`
          );
          lastCoords = { latitude, longitude };
        }
      } else {
        lastCoords = { latitude, longitude };
      }
    }
  }
});

// 🌟 导出 LocationService 对象
export const LocationService = {
  // 1. 开始追踪
  startTracking: async (): Promise<boolean> => {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') return false;

    totalMeters = 0;
    lastCoords = null;

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 5,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Mileage Tracker Active',
        notificationBody: 'Tracking your drive in background...',
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
      // 🌟 优化 1：优先尝试获取最后已知位置（瞬间返回，不会因为模拟器卡死而超时）
      let location = await Location.getLastKnownPositionAsync();
      
      // 🌟 优化 2：如果没有缓存位置，再请求当前位置，并把精度降为 Balanced（避免模拟器报错）
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, 
        });
      }

      if (!location) return 'Unknown Location';

      // 🌟 逆向地理编码：经纬度 -> 真实地址
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
    return 'Location Pin'; // 如果全失败了，才显示这个保底文案
  },
};