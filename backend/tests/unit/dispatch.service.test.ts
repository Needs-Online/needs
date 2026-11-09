import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DispatchService } from '@/modules/dispatch/dispatch.service';
import { DispatchRepository } from '@/modules/dispatch/dispatch.repository';
import { AssignmentStatus, BookingStatus } from '@/common/enums';
import { NotFoundError } from '@/common/errors/app-error';

vi.mock('@/infra/redis/redis.client', () => ({
  withDistributedLock: vi.fn().mockImplementation((_lock, _ttl, fn) => fn()),
  publishEvent: vi.fn(),
  REDIS_KEYS: {
    channel: (name: string) => `channel:${name}`,
  },
}));

vi.mock('@/infra/queue/queue.manager', () => ({
  getQueue: vi.fn().mockReturnValue({
    add: vi.fn(),
    getJob: vi.fn().mockResolvedValue({
      remove: vi.fn(),
    }),
  }),
  QUEUE_NAMES: {
    DISPATCH: 'dispatch',
  },
}));

describe('DispatchService (Unit)', () => {
  let dispatchService: DispatchService;
  let mockRepo: Partial<DispatchRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findBookingForDispatch: vi.fn(),
      findPendingAssignmentForProvider: vi.fn(),
      findAssignmentById: vi.fn(),
      createAssignment: vi.fn(),
      acceptAssignment: vi.fn(),
      updateAssignmentStatus: vi.fn(),
      findCandidateProviders: vi.fn(),
    };

    dispatchService = new DispatchService(mockRepo as DispatchRepository);
  });

  it('should rank candidates and create pending assignment for top candidate', async () => {
    mockRepo.findBookingForDispatch = vi.fn().mockResolvedValue({
      id: 'bk-100',
      status: BookingStatus.REQUESTED,
      addressLine: 'Gulshan 2',
      city: 'Dhaka',
      latitude: 23.79,
      longitude: 90.41,
      service: {
        id: 'srv-1',
        name: 'AC Servicing',
        categoryId: 'cat-ac',
      },
      assignments: [],
    });

    mockRepo.findCandidateProviders = vi.fn().mockResolvedValue([
      {
        id: 'prov-close',
        userId: 'u1',
        fullName: 'Provider One',
        phone: '+8801700000001',
        rating: 4.9,
        completedJobs: 50,
        distanceMeters: 800,
        latitude: 23.792,
        longitude: 90.412,
      },
      {
        id: 'prov-far',
        userId: 'u2',
        fullName: 'Provider Two',
        phone: '+8801700000002',
        rating: 4.2,
        completedJobs: 10,
        distanceMeters: 2500,
        latitude: 23.81,
        longitude: 90.43,
      },
    ]);

    mockRepo.createAssignment = vi.fn().mockResolvedValue({
      id: 'asgn-1',
      bookingId: 'bk-100',
      providerId: 'prov-close',
      status: AssignmentStatus.PENDING,
      distanceMeters: 800,
    });

    const result = await dispatchService.dispatchBooking('bk-100');

    expect(result).not.toBeNull();
    expect(result?.providerId).toBe('prov-close');
    expect(mockRepo.createAssignment).toHaveBeenCalledWith('bk-100', 'prov-close', 800);
  });

  it('should atomically accept assignment for matching provider', async () => {
    mockRepo.findPendingAssignmentForProvider = vi.fn().mockResolvedValue({
      id: 'asgn-1',
      bookingId: 'bk-100',
      providerId: 'prov-1',
      status: AssignmentStatus.PENDING,
    });

    mockRepo.acceptAssignment = vi.fn().mockResolvedValue({
      assignment: { id: 'asgn-1', status: AssignmentStatus.ACCEPTED },
      booking: { id: 'bk-100', status: BookingStatus.ASSIGNED, providerId: 'prov-1' },
    });

    const result = await dispatchService.acceptAssignment('bk-100', 'prov-1');

    expect(result.assignment.status).toBe(AssignmentStatus.ACCEPTED);
    expect(result.booking.status).toBe(BookingStatus.ASSIGNED);
    expect(mockRepo.acceptAssignment).toHaveBeenCalledWith('asgn-1', 'bk-100', 'prov-1');
  });

  it('should throw NotFoundError if provider has no pending assignment to accept', async () => {
    mockRepo.findPendingAssignmentForProvider = vi.fn().mockResolvedValue(null);

    await expect(
      dispatchService.acceptAssignment('bk-100', 'wrong-prov')
    ).rejects.toThrow(NotFoundError);
  });
});
