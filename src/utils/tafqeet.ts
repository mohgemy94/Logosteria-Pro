/**
 * Utility to convert numeric monetary amounts into formal Arabic words (Tafqeet)
 * for Promissory Notes, Bills of Exchange, and Accounting Vouchers.
 */

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const HUNDREDS = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function convertGroup(num: number): string {
  let result = '';
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;

  if (hundreds > 0) {
    result += HUNDREDS[hundreds];
  }

  if (remainder > 0) {
    if (result) result += ' و';
    if (remainder >= 10 && remainder < 20) {
      result += TEENS[remainder - 10];
    } else {
      if (ones > 0) {
        result += ONES[ones];
        if (tens > 0) result += ' و' + TENS[tens];
      } else if (tens > 0) {
        result += TENS[tens];
      }
    }
  }

  return result;
}

export function tafqeetArabic(amount: number, currencyName = 'ريال سعودي', subunitName = 'هللة'): string {
  if (amount === 0) return `صفر ${currencyName} فقط لا غير`;
  if (amount < 0) return `سالب ` + tafqeetArabic(Math.abs(amount), currencyName, subunitName);

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let parts: string[] = [];

  // Billions
  const billions = Math.floor(integerPart / 1_000_000_000);
  let rem = integerPart % 1_000_000_000;

  // Millions
  const millions = Math.floor(rem / 1_000_000);
  rem = rem % 1_000_000;

  // Thousands
  const thousands = Math.floor(rem / 1000);
  const ones = rem % 1000;

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else parts.push(`${convertGroup(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  if (ones > 0) {
    parts.push(convertGroup(ones));
  }

  let text = parts.join(' و');
  if (!text) text = 'صفر';

  let result = `فقط ${text} ${currencyName}`;

  if (decimalPart > 0) {
    result += ` و${convertGroup(decimalPart)} ${subunitName}`;
  }

  return `${result} لا غير`;
}

const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const EN_TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertGroupEn(num: number): string {
  let result = '';
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;

  if (hundreds > 0) {
    result += `${EN_ONES[hundreds]} Hundred`;
  }

  if (remainder > 0) {
    if (result) result += ' ';
    if (remainder >= 10 && remainder < 20) {
      result += EN_TEENS[remainder - 10];
    } else {
      if (tens >= 2) {
        result += EN_TENS[tens];
        if (ones > 0) result += `-${EN_ONES[ones]}`;
      } else if (ones > 0) {
        result += EN_ONES[ones];
      }
    }
  }

  return result;
}

export function tafqeetEnglish(amount: number, currencyName = 'Saudi Riyals', subunitName = 'Halalas'): string {
  if (amount === 0) return `Zero ${currencyName} Only`;
  if (amount < 0) return `Negative ` + tafqeetEnglish(Math.abs(amount), currencyName, subunitName);

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let parts: string[] = [];

  const billions = Math.floor(integerPart / 1_000_000_000);
  let rem = integerPart % 1_000_000_000;
  const millions = Math.floor(rem / 1_000_000);
  rem = rem % 1_000_000;
  const thousands = Math.floor(rem / 1000);
  const ones = rem % 1000;

  if (billions > 0) parts.push(`${convertGroupEn(billions)} Billion`);
  if (millions > 0) parts.push(`${convertGroupEn(millions)} Million`);
  if (thousands > 0) parts.push(`${convertGroupEn(thousands)} Thousand`);
  if (ones > 0) parts.push(convertGroupEn(ones));

  let text = parts.join(' ');
  if (!text) text = 'Zero';

  let result = `${text} ${currencyName}`;
  if (decimalPart > 0) {
    result += ` and ${convertGroupEn(decimalPart)} ${subunitName}`;
  }

  return `${result} Only`;
}
