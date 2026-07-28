import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 🌟 根据你截图里的实际路径直接引入 3 大页面
import { LogScreen } from './src/screens/LogScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';

// 🌟 引入刷脸验证服务
import { AuthService } from './src/utils/AuthService';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const checkAuth = async () => {
    const success = await AuthService.authenticate();
    setIsUnlocked(success);
  };

  useEffect(() => {
    // 1. 打开 App 启动解锁
    checkAuth();

    // 2. 切到后台自动锁定，再切回前台要求刷脸
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkAuth();
      } else if (nextAppState === 'background') {
        setIsUnlocked(false);
      }
    });

    return () => subscription.remove();
  }, []);

  // 🔒 未通过生物识别时展示黑色保护遮罩屏
  if (!isUnlocked) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockText}>TaxMiles is Locked</Text>
      </View>
    );
  }

  // 🔓 验证通过后渲染完整的底部 Tabs 导航栏
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: () => {
              let icon = '🚗';
              if (route.name === 'Tracker') icon = '🟢';
              if (route.name === 'Log') icon = '📋';
              if (route.name === 'Reports') icon = '⚙️';
              return <Text style={{ fontSize: 18 }}>{icon}</Text>;
            },
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8e8e93',
          })}
        >
          <Tab.Screen name="Tracker" component={TrackerScreen} options={{ title: 'Tracker' }} />
          <Tab.Screen name="Log" component={LogScreen} options={{ title: 'Logs' }} />
          <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Settings' }} />
        </Tab.Navigator>
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
  lockText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});