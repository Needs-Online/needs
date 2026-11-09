export interface ProviderLocationUpdate {
  providerId: string;
  latitude: number;
  longitude: number;
  city: string;
}

export interface NearbyProviderItem {
  providerId: string;
  fullName: string | null;
  phone: string;
  rating: number;
  distanceMeters: number;
  latitude: number;
  longitude: number;
}
