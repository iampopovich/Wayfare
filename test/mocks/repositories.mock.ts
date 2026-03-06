/**
 * Repository Mocks for Testing
 */

export const mockGoogleMapsRepository = {
  geocode: jest.fn(),
  getDirections: jest.fn(),
  searchPlaces: jest.fn(),
  getPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(),
};

export const mockOSMRepository = {
  geocode: jest.fn(),
  getDirections: jest.fn(),
  searchPlaces: jest.fn(),
  getPlaceDetails: jest.fn(),
  reverseGeocode: jest.fn(),
};

export const mockOpenWeatherRepository = {
  getCurrentWeather: jest.fn(),
  getForecast: jest.fn(),
  search: jest.fn(),
  getDetails: jest.fn(),
};

export const mockBookingRepository = {
  searchAccommodations: jest.fn(),
  getAccommodationDetails: jest.fn(),
};

export const mockTripRepository = {
  search: jest.fn(),
  getDetails: jest.fn(),
  searchLocations: jest.fn(),
};

/**
 * Create mock repository with default implementations
 */
export function createMockRepository<T>(overrides?: Partial<T>): T {
  const defaultMock: any = {
    search: jest.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
    getDetails: jest.fn().mockResolvedValue({}),
  };

  if (overrides) {
    Object.assign(defaultMock, overrides);
  }

  return defaultMock as T;
}
