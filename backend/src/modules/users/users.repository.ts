import { prisma } from '@/database/prisma';
import { User, UserAddress, AccountStatus } from '@prisma/client';
import { UpdateProfileDto, CreateAddressDto } from './dto/user.dto';

export class UsersRepository {
  async findById(userId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async findAddresses(userId: string): Promise<UserAddress[]> {
    return prisma.userAddress.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async createAddress(userId: string, data: CreateAddressDto): Promise<UserAddress> {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        // Demote existing default address
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.create({
        data: {
          ...data,
          userId,
        },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const result = await prisma.userAddress.deleteMany({
      where: { id: addressId, userId },
    });
    return result.count > 0;
  }

  async softDeleteUser(userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.DELETED,
          deletedAt: new Date(),
        },
      });

      await tx.userSession.updateMany({
        where: { userId },
        data: { isValid: false },
      });
    });
  }
}
