import { Test, TestingModule } from '@nestjs/testing';
import { SmartCaService } from './smart-ca.service';

describe('SmartCaService', () => {
  let service: SmartCaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmartCaService],
    }).compile();

    service = module.get<SmartCaService>(SmartCaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
