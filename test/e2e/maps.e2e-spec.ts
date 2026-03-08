import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MapsModule } from '../../wayfare/src/modules/maps/maps.module';
import { ConfigModule } from '@nestjs/config';

describe('Maps API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        MapsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/maps/search (GET)', () => {
    it('should return search results', () => {
      return request(app.getHttpServer())
        .get('/api/v1/maps/search')
        .query({ query: 'restaurant', latitude: 40.7128, longitude: -74.006 })
        .expect(200);
    });

    it('should require query parameter', () => {
      return request(app.getHttpServer())
        .get('/api/v1/maps/search')
        .expect(400);
    });
  });

  describe('/api/v1/maps/place/:placeId (GET)', () => {
    it('should return place details', () => {
      return request(app.getHttpServer())
        .get('/api/v1/maps/place/test-place-id')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('name');
        });
    });
  });

  describe('/api/v1/maps/directions (GET)', () => {
    it('should return directions', () => {
      return request(app.getHttpServer())
        .get('/api/v1/maps/directions')
        .query({ origin: 'New York', destination: 'Boston' })
        .expect(200);
    });

    it('should require origin and destination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/maps/directions')
        .expect(400);
    });
  });
});
