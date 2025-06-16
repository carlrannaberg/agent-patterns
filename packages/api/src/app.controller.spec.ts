import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const mockAppService = {
    getHello: jest.fn().mockReturnValue('Hello World!'),
  } as unknown as AppService;

  beforeEach(() => {
    // Manually inject the service to bypass DI issues
    appController = new AppController(mockAppService);
    appService = mockAppService;
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
      expect(appService.getHello).toHaveBeenCalled();
    });
  });
});
