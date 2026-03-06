import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from '../../src/services/search.service';
import { GoogleMapsRepository } from '../../src/modules/repositories/maps/google-maps.repository';
import { OSMRepository } from '../../src/modules/repositories/maps/osm.repository';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        SearchService,
        {
          provide: GoogleMapsRepository,
          useValue: {
            searchPlaces: jest.fn(),
            getPlaceDetails: jest.fn(),
            geocode: jest.fn(),
          },
        },
        {
          provide: OSMRepository,
          useValue: {
            searchPlaces: jest.fn(),
            getPlaceDetails: jest.fn(),
            geocode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchPlaces', () => {
    it('should search with google when source is google', async () => {
      // Test implementation
    });

    it('should search all providers when source is all', async () => {
      // Test implementation
    });
  });
});
