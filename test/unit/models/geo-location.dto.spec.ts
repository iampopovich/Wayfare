import { GeoLocationDto } from '../../src/models/base/geo-location.dto';
import { validate } from 'class-validator';

describe('GeoLocationDto', () => {
  it('should validate correct coordinates', async () => {
    const dto = new GeoLocationDto();
    dto.latitude = 40.7128;
    dto.longitude = -74.006;
    dto.address = 'New York, NY';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject invalid latitude', async () => {
    const dto = new GeoLocationDto();
    dto.latitude = 100; // Invalid: > 90
    dto.longitude = -74.006;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid longitude', async () => {
    const dto = new GeoLocationDto();
    dto.latitude = 40.7128;
    dto.longitude = -200; // Invalid: < -180

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept optional address', async () => {
    const dto = new GeoLocationDto();
    dto.latitude = 40.7128;
    dto.longitude = -74.006;
    // address is optional

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
