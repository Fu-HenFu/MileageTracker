import * as LocalAuthentication from 'expo-local-authentication';

export const AuthService = {
  // 1. 检查设备是否支持生物识别（Face ID / Touch ID / 密码）
  async isBiometricAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  },

  // 2. 调起系统原生 Face ID / Touch ID 验证
  async authenticate(): Promise<boolean> {
    try {
      const isAvailable = await this.isBiometricAvailable();
      if (!isAvailable) return true; // 如果设备没设密码/刷脸，默认直接通过

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