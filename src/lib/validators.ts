export function validatePhone(phone: string): { valid: boolean; message?: string } {
  const cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 91 and is 12 digits, it's likely a +91 number
  if (phone.startsWith('+91') || (phone.startsWith('91') && phone.length === 12)) {
    const localPart = phone.startsWith('+91') ? cleaned.slice(2) : cleaned.slice(2);
    if (localPart.length !== 10) {
      return { valid: false, message: 'Indian phone numbers must be 10 digits' };
    }
  }

  const regex = /^\d{7,15}$/;
  if (!regex.test(cleaned)) {
    return { valid: false, message: 'Invalid phone number format' };
  }
  return { valid: true };
}

export function validateEmail(email: string): { valid: boolean; message?: string } {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  return { valid: true };
}

export function validateOTP(code: string): { valid: boolean; message?: string } {
  if (!/^\d{6}$/.test(code)) {
    return { valid: false, message: 'OTP must be 6 digits' };
  }
  return { valid: true };
}

export function validatePrice(price: number): { valid: boolean; message?: string } {
  if (isNaN(price) || price < 0.01) {
    return { valid: false, message: 'Price must be at least 0.01' };
  }
  return { valid: true };
}

export function validateStock(quantity: number): { valid: boolean; message?: string } {
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { valid: false, message: 'Stock quantity must be a non-negative integer' };
  }
  return { valid: true };
}

export function sanitizeText(text: string): string {
  return text.trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function calculateProductStatus(stock: number, buffer: number): string {
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= buffer) return 'LOW_STOCK';
  return 'AVAILABLE';
}
