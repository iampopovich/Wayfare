import { SetMetadata } from '@nestjs/common';

/**
 * Public Decorator
 * Marks a route handler as public, bypassing authentication guards
 * 
 * Usage:
 * @Public()
 * @Get('public-endpoint')
 * getPublicData() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
