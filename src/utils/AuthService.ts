import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

const FACE_ID_SETTING_KEY = '@taxmiles_face_id_enabled';

export const AuthService = {
  // 1. 读取开关设置
  async isFaceIdEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(FACE_ID_SETTING_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  },

  // 2. 保存开关设置
  async setFaceIdEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(FACE_ID_SETTING_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving Face ID setting:', error);
    }
  },

  // 🌟 3. 调起 Face ID 认证（带静默失败拦截）
  async authenticate(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Face ID Required',
          'Please set up Face ID in your iPhone Settings first.'
        );
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock TaxMiles using Face ID',
        disableDeviceFallback: true, // 保持纯刷脸
        cancelLabel: 'Cancel',
      });

      // 🌟 如果扫脸失败/被取消，给出日志提示，防止静默卡死
      if (!result.success) {
        console.log('❌ Face ID failed/cancelled:', result.error);
      }

      return result.success;
    } catch (error: any) {
      console.error('Authentication Error:', error);
      return false;
    }
  },
};