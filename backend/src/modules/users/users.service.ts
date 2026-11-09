import { UsersRepository } from './users.repository';
import { UpdateProfileDto, CreateAddressDto } from './dto/user.dto';
import { NotFoundError } from '@/common/errors/app-error';

export class UsersService {
  constructor(private readonly usersRepo: UsersRepository = new UsersRepository()) {}

  async getProfile(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User profile not found');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId);
    return this.usersRepo.updateProfile(userId, dto);
  }

  async getAddresses(userId: string) {
    return this.usersRepo.findAddresses(userId);
  }

  async addAddress(userId: string, dto: CreateAddressDto) {
    return this.usersRepo.createAddress(userId, dto);
  }

  async deleteAddress(userId: string, addressId: string) {
    const deleted = await this.usersRepo.deleteAddress(userId, addressId);
    if (!deleted) {
      throw new NotFoundError('Address not found or already deleted');
    }
    return { success: true };
  }

  async deleteAccount(userId: string) {
    await this.usersRepo.softDeleteUser(userId);
    return {
      success: true,
      message: 'Account deleted and personal data scheduled for anonymization',
    };
  }
}
