export type CountryCode = 'US' | 'CA' | 'AU';
export type DistanceUnit = 'miles' | 'km';

// 底层转换常量
const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;

export interface TaxCalculationResult {
  formattedDistance: string; // 格式化后的距离，如 "12.50 mi" 或 "20.10 km"
  deductionAmount: number;   // 抵税金额，如 9.06
  formattedDeduction: string;// 格式化后的金额，如 "$9.06"
  currency: string;          // 货币符号
  unit: DistanceUnit;
}

/**
 * 将底层的“米”转换为美/加/澳对应的抵税金额和展示字符串
 */
export const calculateTaxDeduction = (
  meters: number,
  country: CountryCode
): TaxCalculationResult => {
  switch (country) {
    case 'US': {
      const miles = meters / METERS_PER_MILE;
      const rate = 0.725;
      const deduction = miles * rate;
      return {
        formattedDistance: `${miles.toFixed(2)} mi`,
        deductionAmount: Number(deduction.toFixed(2)),
        formattedDeduction: `US$ ${deduction.toFixed(2)}`, // 👈 明确写 US$
        currency: 'US$',
        unit: 'miles',
      };
    }
    case 'CA': {
      const km = meters / METERS_PER_KM;
      let deduction = 0;
      if (km <= 5000) {
        deduction = km * 0.73;
      } else {
        deduction = 5000 * 0.73 + (km - 5000) * 0.67;
      }
      return {
        formattedDistance: `${km.toFixed(2)} km`,
        deductionAmount: Number(deduction.toFixed(2)),
        formattedDeduction: `CA$ ${deduction.toFixed(2)}`, // 👈 明确写 CA$
        currency: 'CA$',
        unit: 'km',
      };
    }
    case 'AU': {
      const km = meters / METERS_PER_KM;
      const claimableKm = Math.min(km, 5000);
      const deduction = claimableKm * 0.88;
      return {
        formattedDistance: `${km.toFixed(2)} km`,
        deductionAmount: Number(deduction.toFixed(2)),
        formattedDeduction: `A$ ${deduction.toFixed(2)}`, // 👈 明确写 A$
        currency: 'A$',
        unit: 'km',
      };
    }
  }
};