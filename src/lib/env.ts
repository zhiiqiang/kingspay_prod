const authRequireOtpFlag = import.meta.env.VITE_AUTH_REQUIRE_OTP;

export const authRequireOtpEnabled = authRequireOtpFlag !== 'false' && authRequireOtpFlag !== '0';
