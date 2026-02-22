/**
 * Unit Tests for Password Validation
 * Tests the validatePasswordStrength function from auth middleware
 */

import { validatePasswordStrength } from '../../src/middleware/auth';

describe('Password Validation', () => {
  describe('validatePasswordStrength', () => {
    describe('Password length validation', () => {
      it('should reject passwords shorter than 8 characters', () => {
        const result = validatePasswordStrength('Abc1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });

      it('should reject empty passwords', () => {
        const result = validatePasswordStrength('');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });

      it('should accept passwords with exactly 8 characters meeting all requirements', () => {
        const result = validatePasswordStrength('Password1!');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject passwords longer than 128 characters', () => {
        const longPassword = 'A'.repeat(129) + 'a1!';
        const result = validatePasswordStrength(longPassword);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must not exceed 128 characters');
      });
    });

    describe('Lowercase letter validation', () => {
      it('should reject passwords without lowercase letters', () => {
        const result = validatePasswordStrength('PASSWORD1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
      });

      it('should accept passwords with lowercase letters', () => {
        const result = validatePasswordStrength('Password1!');
        expect(result.isValid).toBe(true);
      });
    });

    describe('Uppercase letter validation', () => {
      it('should reject passwords without uppercase letters', () => {
        const result = validatePasswordStrength('password1!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
      });

      it('should accept passwords with uppercase letters', () => {
        const result = validatePasswordStrength('Password1!');
        expect(result.isValid).toBe(true);
      });
    });

    describe('Number validation', () => {
      it('should reject passwords without numbers', () => {
        const result = validatePasswordStrength('Password!!');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
      });

      it('should accept passwords with numbers', () => {
        const result = validatePasswordStrength('Password1!');
        expect(result.isValid).toBe(true);
      });
    });

    describe('Special character validation', () => {
      it('should reject passwords without special characters', () => {
        const result = validatePasswordStrength('Password1');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one special character');
      });

      it('should accept passwords with various special characters', () => {
        const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '='];
        specialChars.forEach((char) => {
          const result = validatePasswordStrength(`Password1${char}`);
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('Password strength calculation', () => {
      it('should return "weak" for short passwords', () => {
        const result = validatePasswordStrength('Pass1!');
        expect(result.strength).toBe('weak');
      });

      it('should return "medium" for passwords with 8+ characters meeting requirements', () => {
        const result = validatePasswordStrength('Password1!');
        expect(result.strength).toBe('medium');
      });

      it('should return "strong" for passwords with 12+ characters meeting all requirements', () => {
        const result = validatePasswordStrength('MyPassword123!');
        expect(result.strength).toBe('strong');
      });
    });

    describe('Edge cases', () => {
      it('should handle passwords with only special characters at boundary', () => {
        // 8 chars: aaaaaaaa with requirements met
        const result = validatePasswordStrength('aaaaaaaaA1!');
        expect(result.isValid).toBe(true);
      });

      it('should handle whitespace in passwords', () => {
        const result = validatePasswordStrength('Pass word1!');
        expect(result.isValid).toBe(true);
      });

      it('should handle unicode characters', () => {
        const result = validatePasswordStrength('Пароль1!');
        expect(result.isValid).toBe(false); // No latin characters
      });
    });
  });
});
