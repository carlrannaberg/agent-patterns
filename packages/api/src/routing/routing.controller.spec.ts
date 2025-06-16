import { Test, TestingModule } from '@nestjs/testing';
import { RoutingController } from './routing.controller';

describe('RoutingController', () => {
  let controller: RoutingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutingController],
    }).compile();

    controller = module.get<RoutingController>(RoutingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
