import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { CountryCode } from '../utils/TaxEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideData {
    id: string;
    emoji: string;
    title: string;
    subtitle: string;
}

const SLIDES: SlideData[] = [
    {
        id: '1',
        emoji: '🚗',
        title: 'Auto GPS Tracking',
        subtitle: 'Track your driving miles automatically in the background and maximize your tax deductions effortless.',
    },
    {
        id: '2',
        emoji: '📄',
        title: 'Audit-Ready Reports',
        subtitle: 'Generate IRS/CRA/ATO compliant PDF and CSV logs with business purposes ready for your tax filing.',
    },
    {
        id: '3',
        emoji: '🌍',
        title: 'Select Tax Country',
        subtitle: 'Choose your default country profile to automatically calculate official standard mileage rates.',
    },
    {
        id: '4',
        emoji: '🛡️',
        title: 'Location & Privacy',
        subtitle: 'We need "Always Allow" location access to track drives. Your data is 100% saved locally on your phone.',
    },
];

interface OnboardingScreenProps {
    onFinish: () => void; // 引导完成后的回调（切换主界面）
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US');
    const flatListRef = useRef<FlatList>(null);

    // 监听滑动更新当前页码
    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
            setCurrentIndex(index);
        }
    };

    // 点击 Next 切换下一页
    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        }
    };

    // 点击完成引导：申请定位权限 + 标记完成
    // 点击完成引导：仅仅申请定位权限 + 标记完成
    const handleCompleteOnboarding = async () => {
        try {
            // 🌟 第一步：先请求前台定位权限（iOS 必须先给前台，才能给后台）
            const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();

            // 🌟 第二步：如果前台通过了，再请求后台权限
            if (fgStatus === 'granted') {
                await Location.requestBackgroundPermissionsAsync();
            } else {
                Alert.alert(
                    'Permission Recommended',
                    'You can still manually log trips, but location access is required for automatic background tracking.'
                );
            }
        } catch (e) {
            console.warn('Permission request error:', e);
        }

        // 保存当前选中的国家偏好
        await AsyncStorage.setItem('@taxmiles_selected_country', selectedCountry);
        // 标记已完成新手引导
        await AsyncStorage.setItem('@taxmiles_onboarding_completed', 'true');

        // 触发主界面切换
        onFinish();
    };

    // 渲染单个 Slide
    const renderSlide = ({ item, index }: { item: SlideData; index: number }) => {
        return (
            <View style={styles.slide}>
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>

                {/* Slide 3 特有：国家选择器 */}
                {index === 2 && (
                    <View style={styles.countryPickerRow}>
                        {(['US', 'CA', 'AU'] as CountryCode[]).map((country) => (
                            <TouchableOpacity
                                key={country}
                                style={[
                                    styles.countryCard,
                                    selectedCountry === country && styles.activeCountryCard,
                                ]}
                                onPress={() => setSelectedCountry(country)}
                            >
                                <Text style={styles.flagText}>
                                    {country === 'US' ? '🇺🇸' : country === 'CA' ? '🇨🇦' : '🇦🇺'}
                                </Text>
                                <Text
                                    style={[
                                        styles.countryText,
                                        selectedCountry === country && styles.activeCountryText,
                                    ]}
                                >
                                    {country}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Slide 4 特有：隐私承诺标签 */}
                {index === 3 && (
                    <View style={styles.privacyBadge}>
                        <Text style={styles.privacyText}>🔒 100% On-Device SQLite Storage</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* 顶部 Skip 按钮 */}
            <View style={styles.header}>
                {currentIndex < SLIDES.length - 1 ? (
                    <TouchableOpacity onPress={() => flatListRef.current?.scrollToIndex({ index: 3 })}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                ) : (
                    <View />
                )}
            </View>

            {/* 原生 FlatList 横向滑动列表 */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                decelerationRate="fast"
            />

            {/* 底部控制区：分页点 + 动作按钮 */}
            <View style={styles.footer}>
                {/* 🌟 动态分页点 Indicators */}
                <View style={styles.dotsContainer}>
                    {SLIDES.map((_, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.dot,
                                currentIndex === idx ? styles.activeDot : styles.inactiveDot,
                            ]}
                        />
                    ))}
                </View>

                {/* 下一步 / 开始使用按钮 */}
                {currentIndex === SLIDES.length - 1 ? (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleCompleteOnboarding}
                    >
                        <Text style={styles.actionBtnText}>Enable Tracking & Start 🚀</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.actionBtn} onPress={handleNext}>
                        <Text style={styles.actionBtnText}>Next ➔</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f4f6' },
    header: {
        height: 44,
        paddingHorizontal: 20,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    skipText: { fontSize: 15, color: '#8e8e93', fontWeight: '600' },

    slide: {
        width: SCREEN_WIDTH,
        paddingHorizontal: 30,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    emoji: { fontSize: 80, marginBottom: 24 },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1c1c1e',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: '#8e8e93',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 10,
    },

    // 国家选择样式
    countryPickerRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 25,
    },
    countryCard: {
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e5ea',
    },
    activeCountryCard: {
        borderColor: '#007AFF',
        backgroundColor: '#e3f2fd',
    },
    flagText: { fontSize: 24, marginBottom: 4 },
    countryText: { fontSize: 14, fontWeight: 'bold', color: '#8e8e93' },
    activeCountryText: { color: '#007AFF' },

    privacyBadge: {
        backgroundColor: '#e5e5ea',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginTop: 25,
    },
    privacyText: { fontSize: 12, color: '#666', fontWeight: '600' },

    footer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        alignItems: 'center',
    },

    // 🌟 动态分页点样式
    dotsContainer: {
        flexDirection: 'row',
        height: 10,
        alignItems: 'center',
        marginBottom: 25,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    activeDot: {
        width: 22, // 激活时变宽为椭圆
        backgroundColor: '#007AFF',
    },
    inactiveDot: {
        width: 8, // 非激活时为小圆点
        backgroundColor: '#c7c7cc',
    },

    actionBtn: {
        backgroundColor: '#34c759',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
    },
});