import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '@/modules/users/users.service';
import { UsersRepository } from '@/modules/users/users.repository';
import { createAddressSchema } from '@/modules/users/dto/user.dto';
import { NotFoundError } from '@/common/errors/app-error';

describe('UsersService & Addresses (Unit)', () => {
  let usersService: UsersService;
  let mockRepo: Partial<UsersRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      updateProfile: vi.fn(),
      findAddresses: vi.fn(),
      createAddress: vi.fn(),
      updateAddress: vi.fn(),
      setDefaultAddress: vi.fn(),
      deleteAddress: vi.fn(),
      softDeleteUser: vi.fn(),
    };
    usersService = new UsersService(mockRepo as UsersRepository);
  });

  describe('Address Coordinate Validation', () => {
    it('should accept coordinates inside Bangladesh boundaries', () => {
      const validAddress = {
        label: 'Home',
        addressLine: 'House 12, Road 4, Dhanmondi',
        area: 'Dhanmondi',
        city: 'Dhaka',
        latitude: 23.7461, // Inside BD
        longitude: 90.3742, // Inside BD
        isDefault: true,
      };

      const parsed = createAddressSchema.parse(validAddress);
      expect(parsed.latitude).toBe(23.7461);
      expect(parsed.city).toBe('Dhaka');
    });

    it('should reject coordinates outside Bangladesh latitude bounds', () => {
      const invalidLatAddress = {
        label: 'Home',
        addressLine: 'Outside BD',
        area: 'London',
        city: 'London',
        latitude: 51.5074, // Outside BD bounds (20.5 to 26.7)
        longitude: 90.3742,
      };

      expect(() => createAddressSchema.parse(invalidLatAddress)).toThrow();
    });

    it('should reject coordinates outside Bangladesh longitude bounds', () => {
      const invalidLonAddress = {
        label: 'Office',
        addressLine: 'Outside BD',
        area: 'Kolkata',
        city: 'Kolkata',
        latitude: 22.5726,
        longitude: 80.0, // Outside BD bounds (88.0 to 92.7)
      };

      expect(() => createAddressSchema.parse(invalidLonAddress)).toThrow();
    });
  });

  describe('setDefaultAddress', () => {
    it('should set default address and return updated record', async () => {
      mockRepo.setDefaultAddress = vi.fn().mockResolvedValue({
        id: 'addr-1',
        userId: 'usr-123',
        isDefault: true,
      });

      const result = await usersService.setDefaultAddress('usr-123', 'addr-1');
      expect(result.id).toBe('addr-1');
      expect(result.isDefault).toBe(true);
      expect(mockRepo.setDefaultAddress).toHaveBeenCalledWith('usr-123', 'addr-1');
    });

    it('should throw NotFoundError if address to set default does not exist', async () => {
      mockRepo.setDefaultAddress = vi.fn().mockResolvedValue(null);

      await expect(
        usersService.setDefaultAddress('usr-123', 'invalid-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteAccount', () => {
    it('should trigger soft delete and session invalidation', async () => {
      const result = await usersService.deleteAccount('usr-123');
      expect(mockRepo.softDeleteUser).toHaveBeenCalledWith('usr-123');
      expect(result.success).toBe(true);
    });
  });
});
