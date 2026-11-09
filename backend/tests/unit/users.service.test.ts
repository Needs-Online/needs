import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '@/modules/users/users.service';
import { UsersRepository } from '@/modules/users/users.repository';
import { NotFoundError } from '@/common/errors/app-error';
import { Role } from '@/common/enums';

describe('UsersService (Unit)', () => {
  let usersService: UsersService;
  let mockRepo: Partial<UsersRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      updateProfile: vi.fn(),
      findAddresses: vi.fn(),
      createAddress: vi.fn(),
      deleteAddress: vi.fn(),
      softDeleteUser: vi.fn(),
    };

    usersService = new UsersService(mockRepo as UsersRepository);
  });

  it('should return profile for valid user', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'usr-123',
      fullName: 'Alice Smith',
      phone: '+8801700000000',
      role: Role.CUSTOMER,
    });

    const profile = await usersService.getProfile('usr-123');
    expect(profile.id).toBe('usr-123');
    expect(profile.fullName).toBe('Alice Smith');
  });

  it('should throw NotFoundError if user not found', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(usersService.getProfile('invalid-id')).rejects.toThrow(NotFoundError);
  });

  it('should delete address and return success', async () => {
    mockRepo.deleteAddress = vi.fn().mockResolvedValue(true);

    const result = await usersService.deleteAddress('usr-123', 'addr-1');
    expect(result.success).toBe(true);
  });

  it('should throw NotFoundError when deleting non-existent address', async () => {
    mockRepo.deleteAddress = vi.fn().mockResolvedValue(false);

    await expect(usersService.deleteAddress('usr-123', 'non-existent')).rejects.toThrow(NotFoundError);
  });
});
