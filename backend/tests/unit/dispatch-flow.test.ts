import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DispatchService } from '@/modules/dispatch/dispatch.service';
import { DispatchRepository } from '@/modules/dispatch/dispatch.repository';
import { AssignmentStatus, BookingStatus } from '@/common/enums';
import * as redisClient from '@/infra/redis/redis.client';
import * as queueManager from '@/infra/queue/queue.manager';

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

describe('Dispatch Engine - Radius Expansion, Ranking & Auto-Redispatch (Unit)', () => {
  let dispatchService: DispatchService;
  let mockRepo: Partial<DispatchRepository>;
  let mockQueueAdd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd = vi.fn();
    vi.spyOn(queueManager, 'getQueue').mockReturnValue({
      add: mockQueueAdd,
      getJob: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    } as any);

    mockRepo = {
      findBookingForDispatch: vi.fn(),
      findCandidateProviders: vi.fn(),
      createAssignment: vi.fn(),
      findPendingAssignmentForProvider: vi.fn(),
      findAssignmentById: vi.fn(),
      acceptAssignment: vi.fn(),
      updateAssignmentStatus: vi.fn(),
    };

    dispatchService = new DispatchService(mockRepo as DispatchRepository);
  });

  describe('Radius Expansion (3km -> 10km)', () => {
    it('should expand search radius from 3km to 10km when candidates < 2', async () => {
      mockRepo.findBookingForDispatch = vi.fn().mockResolvedValue({
        id: 'bk-expand',
        status: BookingStatus.MATCHING,
        addressLine: 'Dhanmondi 27',
        city: 'Dhaka',
        latitude: 23.75,
        longitude: 90.37,
        service: { id: 'srv-1', categoryId: 'cat-1', name: 'Plumbing' },
        assignments: [],
      });

      // First call (3km) returns only 1 candidate
      // Second call (10km) returns 2 candidates
      mockRepo.findCandidateProviders = vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'prov-close',
            userId: 'u1',
            fullName: 'Close Pro',
            rating: 5.0,
            completedJobs: 20,
            distanceMeters: 1500,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'prov-close',
            userId: 'u1',
            fullName: 'Close Pro',
            rating: 5.0,
            completedJobs: 20,
            distanceMeters: 1500,
          },
          {
            id: 'prov-further',
            userId: 'u2',
            fullName: 'Far Pro',
            rating: 4.8,
            completedJobs: 80,
            distanceMeters: 6000,
          },
        ]);

      mockRepo.createAssignment = vi.fn().mockResolvedValue({
        id: 'asgn-1',
        bookingId: 'bk-expand',
        providerId: 'prov-close',
        status: AssignmentStatus.PENDING,
      });

      await dispatchService.dispatchBooking('bk-expand');

      expect(mockRepo.findCandidateProviders).toHaveBeenCalledTimes(2);
      expect(mockRepo.findCandidateProviders).toHaveBeenNthCalledWith(1, 'cat-1', 90.37, 23.75, 3000, []);
      expect(mockRepo.findCandidateProviders).toHaveBeenNthCalledWith(2, 'cat-1', 90.37, 23.75, 10000, []);
    });
  });

  describe('Provider Ranking Scoring Formula', () => {
    it('should rank higher rating and closer proximity ahead of far low-rated candidates', async () => {
      mockRepo.findBookingForDispatch = vi.fn().mockResolvedValue({
        id: 'bk-rank',
        status: BookingStatus.MATCHING,
        latitude: 23.75,
        longitude: 90.37,
        service: { id: 'srv-1', categoryId: 'cat-1', name: 'Electrician' },
        assignments: [],
      });

      mockRepo.findCandidateProviders = vi.fn().mockResolvedValue([
        {
          id: 'prov-low',
          userId: 'u1',
          fullName: 'Low Rated Far',
          rating: 3.5,
          completedJobs: 5,
          distanceMeters: 2800,
        },
        {
          id: 'prov-top',
          userId: 'u2',
          fullName: 'Top Rated Close',
          rating: 4.95,
          completedJobs: 95,
          distanceMeters: 400,
        },
      ]);

      mockRepo.createAssignment = vi.fn().mockResolvedValue({
        id: 'asgn-top',
        bookingId: 'bk-rank',
        providerId: 'prov-top',
        status: AssignmentStatus.PENDING,
      });

      const result = await dispatchService.dispatchBooking('bk-rank');
      expect(result?.providerId).toBe('prov-top');
      expect(mockRepo.createAssignment).toHaveBeenCalledWith('bk-rank', 'prov-top', 400);
    });
  });

  describe('45-Second Delayed Job Scheduling', () => {
    it('should enqueue a 45-second delayed job in BullMQ dispatch queue', async () => {
      mockRepo.findBookingForDispatch = vi.fn().mockResolvedValue({
        id: 'bk-timer',
        status: BookingStatus.MATCHING,
        latitude: 23.75,
        longitude: 90.37,
        service: { id: 'srv-1', categoryId: 'cat-1', name: 'Cleaner' },
        assignments: [],
      });

      mockRepo.findCandidateProviders = vi.fn().mockResolvedValue([
        {
          id: 'prov-1',
          userId: 'u1',
          fullName: 'Pro 1',
          rating: 4.8,
          completedJobs: 30,
          distanceMeters: 1000,
        },
        {
          id: 'prov-2',
          userId: 'u2',
          fullName: 'Pro 2',
          rating: 4.6,
          completedJobs: 25,
          distanceMeters: 1500,
        },
      ]);

      mockRepo.createAssignment = vi.fn().mockResolvedValue({
        id: 'asgn-timer-1',
        bookingId: 'bk-timer',
        providerId: 'prov-1',
        status: AssignmentStatus.PENDING,
      });

      await dispatchService.dispatchBooking('bk-timer');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'dispatch-timeout',
        {
          bookingId: 'bk-timer',
          assignmentId: 'asgn-timer-1',
          providerId: 'prov-1',
        },
        {
          delay: 45000, // 45 seconds (BR-02)
          jobId: 'dispatch-timeout:asgn-timer-1',
          removeOnComplete: true,
        }
      );
    });
  });

  describe('Auto-Redispatch on Rejection & Timeout', () => {
    it('should mark assignment REJECTED and auto-redispatch when provider rejects', async () => {
      mockRepo.findPendingAssignmentForProvider = vi.fn().mockResolvedValue({
        id: 'asgn-reject',
        bookingId: 'bk-rejected',
        providerId: 'prov-rejecting',
        status: AssignmentStatus.PENDING,
      });

      const dispatchSpy = vi.spyOn(dispatchService, 'dispatchBooking').mockResolvedValue(null);

      const res = await dispatchService.rejectAssignment(
        'bk-rejected',
        'prov-rejecting',
        'Too busy right now'
      );

      expect(res.success).toBe(true);
      expect(mockRepo.updateAssignmentStatus).toHaveBeenCalledWith(
        'asgn-reject',
        AssignmentStatus.REJECTED
      );
      expect(dispatchSpy).toHaveBeenCalledWith('bk-rejected');
    });

    it('should mark assignment TIMEOUT and auto-redispatch to next candidate upon 45s timer expiry', async () => {
      mockRepo.findAssignmentById = vi.fn().mockResolvedValue({
        id: 'asgn-timeout',
        bookingId: 'bk-timeout',
        providerId: 'prov-slow',
        status: AssignmentStatus.PENDING,
      });

      const dispatchSpy = vi.spyOn(dispatchService, 'dispatchBooking').mockResolvedValue(null);

      await dispatchService.handleAssignmentTimeout('bk-timeout', 'asgn-timeout');

      expect(mockRepo.updateAssignmentStatus).toHaveBeenCalledWith(
        'asgn-timeout',
        AssignmentStatus.TIMEOUT
      );
      expect(dispatchSpy).toHaveBeenCalledWith('bk-timeout');
    });
  });
});
