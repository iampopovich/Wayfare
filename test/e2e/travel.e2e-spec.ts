import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TravelModule } from '../../wayfare/src/modules/travel/travel.module';
import { ConfigModule } from '@nestjs/config';

describe('Travel API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        TravelModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/travel/route (POST)', () => {
    it('should plan a travel route', () => {
      const travelRequest = {
        origin: 'New York, NY',
        destination: 'Boston, MA',
        transportationType: 'car',
        passengers: 2,
        carSpecifications: {
          fuelConsumption: 7.5,
          fuelType: 'gasoline',
        },
      };

      return request(app.getHttpServer())
        .post('/api/v1/travel/route')
        .send(travelRequest)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('route');
          expect(res.body).toHaveProperty('costs');
        });
    });

    it('should require origin and destination', () => {
      return request(app.getHttpServer())
        .post('/api/v1/travel/route')
        .send({ transportationType: 'car' })
        .expect(400);
    });

    it('should reject same origin and destination', () => {
      return request(app.getHttpServer())
        .post('/api/v1/travel/route')
        .send({
          origin: 'New York',
          destination: 'New York',
          transportationType: 'car',
        })
        .expect(400);
    });
  });
});
