export interface RankedProviderCandidate {
  providerId: string;
  userId: string;
  fullName: string | null;
  phone: string;
  rating: number;
  completedJobs: number;
  distanceMeters: number;
  score: number;
}

export interface DispatchTimeoutJobPayload {
  bookingId: string;
  assignmentId: string;
  providerId: string;
  candidateIndex?: number;
}
