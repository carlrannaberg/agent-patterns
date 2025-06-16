import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const mockAppService = {
    getHello: vi.fn().mockReturnValue('Hello World!'),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
      expect(appService.getHello).toHaveBeenCalled();
    });
  });
});
