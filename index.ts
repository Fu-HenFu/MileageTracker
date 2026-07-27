import { registerRootComponent } from 'expo';
// 🌟 核心：引入后台定位服务，确保系统在启动应用的第一时间注册 TaskManager
import './src/services/LocationService';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
