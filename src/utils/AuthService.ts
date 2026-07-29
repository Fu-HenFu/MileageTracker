import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const FACE_ID_SETTING_KEY = '@taxmiles_face_id_enabled';

export const AuthService = {
  // 1. 检查设备生物识别支持
  async isBiometricAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  },

  // 🌟 2. 读取 Face ID 开关（必须有这个函数）
  async isFaceIdEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(FACE_ID_SETTING_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error reading Face ID setting:', error);
      return false;
    }
  },

  // 🌟 3. 保存 Face ID 开关（必须有这个函数）
  async setFaceIdEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(FACE_ID_SETTING_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving Face ID setting:', error);
    }
  },

  // 4. 调起系统原生验证
  async authenticate(): Promise<boolean> {
    try {
      const isAvailable = await this.isBiometricAvailable();
      if (!isAvailable) return true;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock TaxMiles to view your logs',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Authentication Error:', error);
      return false;
    }
  },
};