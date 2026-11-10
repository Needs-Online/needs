export interface OtpProvider {
  /**
   * Dispatches an OTP code to the recipient's phone number.
   * Returns true on successful dispatch, or throws an error.
   */
  sendOtp(phone: string, otp: string): Promise<boolean>;

  /**
   * Returns provider identifier (e.g. "mock", "sms-bd").
   */
  getName(): string;
}
