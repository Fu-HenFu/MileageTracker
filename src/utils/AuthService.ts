import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

const FACE_ID_SETTING_KEY = '@taxmiles_face_id_enabled';

export const AuthService = {
  // 1. 检查设备是否支持并开启了 Face ID
  async isBiometricAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    // 检查硬件类型中是否包含 Face ID (FACIAL_RECOGNITION = 2)
    const supportsFaceID = types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    );

    return hasHardware && isEnrolled && supportsFaceID;
  },

  // 2. 读取开关设置
  async isFaceIdEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(FACE_ID_SETTING_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  },

  // 3. 保存开关设置
  async setFaceIdEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(FACE_ID_SETTING_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving Face ID setting:', error);
    }
  },

  // 4. 调起系统原生 Face ID
  async authenticate(): Promise<boolean> {
    try {
      const isAvailable = await LocalAuthentication.isEnrolledAsync();
      if (!isAvailable) {
        Alert.alert('Notice', 'Please set up Face ID or Passcode in iPhone Settings.');
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock TaxMiles using Face ID',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Authentication Error:', error);
      return false;
    }
  },
};