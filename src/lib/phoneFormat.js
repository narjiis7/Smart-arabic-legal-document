/**
 * تحويل رقم عراقي: 07701234567 → +9647701234567
 * @param {string} phoneNumber
 * @returns {string | null}
 */
export function formatIraqPhoneE164(phoneNumber) {
  const s = (phoneNumber || '').replace(/\s/g, '');
  if (!s.startsWith('0') || s.length < 11) return null;
  return '+964' + s.slice(1);
}
