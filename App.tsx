import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDatabase } from './src/db/database';
import { LogScreen } from './src/screens/LogScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SplashScreen } from './src/screens/SplashScreen'; // 🌟 1. 引入开屏动画组件
import { TrackerScreen } from './src/screens/TrackerScreen';
import { AuthService } from './src/utils/AuthService';
import { Ionicons } from '@expo/vector-icons'; // 🌟 引入 Expo/iOS 标准图标库
import * as Haptics from 'expo-haptics';         // 🌟 引入 iOS 原生震动反馈（可选）

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// 📱 封装 3 个底部 Tab 作为一个主架构组件
// 📱 封装 3 个底部 Tab 作为一个主架构组件 (已加入高强对比度 UI)
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // 🌟 1. 图标固定不变，颜色随选中/未选中精准切换
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'car';

          if (route.name === 'Tracker') iconName = 'car-sport';
          if (route.name === 'Log') iconName = 'document-text';
          if (route.name === 'Reports') iconName = 'settings';

          return (
            <Ionicons
              name={iconName}
              size={23}
              color={color} // 👈 继承系统的 color，选中时#007AFF，未选中时#8E8E93
            />
          );
        },

        // 🌟 2. 匹配 iOS 官方标准颜色
        tabBarActiveTintColor: '#007AFF',   // iOS System Blue (亮蓝)
        tabBarInactiveTintColor: '#8E8E93', // iOS System Gray (高级灰)

        // 🌟 3. iOS 字体与间距规范
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: -2,
          paddingBottom: 4,
        },

        // 🌟 4. iOS 经典半透明磨砂风格 TabBar
        tabBarStyle: {
          height: 84, // 适配 iOS 底部 SafeArea
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(60, 60, 67, 0.29)', // iOS 标准分隔线颜色
        },
      })}
      // 🌟 点击切换 Tab 时触发 iOS 原生轻微震动（极佳的手感！）
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
    >
      <Tab.Screen name="Tracker" component={TrackerScreen} options={{ title: 'Tracker' }} />
      <Tab.Screen name="Log" component={LogScreen} options={{ title: 'Logs' }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);
  
  // 🌟 2. 控制开屏欢迎动画的展示 State
  const [showSplash, setShowSplash] = useState(true);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isAuthenticating = useRef<boolean>(false);

  const checkAuth = async (isManual = false) => {
    if (isManual) {
      isAuthenticating.current = false;
    } else if (isAuthenticating.current) {
      return;
    }

    try {
      const isEnabled = await AuthService.isFaceIdEnabled();
      if (!isEnabled) {
        setIsUnlocked(true);
        return;
      }

      isAuthenticating.current = true;
      const success = await AuthService.authenticate();
      setIsUnlocked(success);
    } catch (error) {
      console.error('CheckAuth Error:', error);
      setIsUnlocked(false);
    } finally {
      setTimeout(() => {
        isAuthenticating.current = false;
      }, 300);
    }
  };

  useEffect(() => {
    try {
      initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    AsyncStorage.getItem('@taxmiles_onboarding_completed').then((val) => {
      setIsOnboardingCompleted(val === 'true');
    });

    checkAuth();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current === 'background' &&
        nextAppState === 'active' &&
        !isAuthenticating.current
      ) {
        AuthService.isFaceIdEnabled().then((isEnabled) => {
          if (isEnabled) {
            setIsUnlocked(false);
            setTimeout(() => checkAuth(), 400);
          }
        });
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // 1️⃣ 未通过 Face ID 解锁，展示锁屏页面
  if (!isUnlocked) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockText}>TaxMiles is Locked</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={() => checkAuth(true)}>
          <Text style={styles.unlockBtnText}>Unlock App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2️⃣ 状态读取中
  if (isOnboardingCompleted === null) {
    return null;
  }

  // 3️⃣ 首次使用，展示新手引导页
  if (!isOnboardingCompleted) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen onFinish={() => setIsOnboardingCompleted(true)} />
      </SafeAreaProvider>
    );
  }

  // 🌟 4️⃣ 解锁且完成引导后，先播放开屏动画品牌过渡页
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // 🌟 5️⃣ 动画结束后自然滑入主程序导航（Tabs + Paywall Modal）
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ presentation: 'modal' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: { fontSize: 50, marginBottom: 15 },
  lockText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 25 },
  unlockBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 22,
  },
  unlockBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});