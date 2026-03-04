import { Test, TestingModule } from '@nestjs/testing';
import { SmartCaController } from './smart-ca.controller';

describe('SmartCaController', () => {
  let controller: SmartCaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmartCaController],
    }).compile();

    controller = module.get<SmartCaController>(SmartCaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
