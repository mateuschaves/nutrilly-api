import { Test, TestingModule } from '@nestjs/testing';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';

describe('FoodsController', () => {
  let controller: FoodsController;

  const mockFoodsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoodsController],
      providers: [{ provide: FoodsService, useValue: mockFoodsService }],
    }).compile();

    controller = module.get<FoodsController>(FoodsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() should call foodsService.create with dto', async () => {
    const dto = { name: 'Apple', calories_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 14, fat_per_100g: 0.2 };
    const created = { id: 'food-1', ...dto };
    mockFoodsService.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(mockFoodsService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('findAll() should call foodsService.findAll without search', async () => {
    const foods = [{ id: 'food-1', name: 'Apple' }];
    mockFoodsService.findAll.mockResolvedValue(foods);

    const result = await controller.findAll(undefined);

    expect(mockFoodsService.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual(foods);
  });

  it('findAll() should call foodsService.findAll with search term', async () => {
    const foods = [{ id: 'food-1', name: 'Apple' }];
    mockFoodsService.findAll.mockResolvedValue(foods);

    const result = await controller.findAll('apple');

    expect(mockFoodsService.findAll).toHaveBeenCalledWith('apple');
    expect(result).toEqual(foods);
  });

  it('findOne() should call foodsService.findById with id', async () => {
    const food = { id: 'food-1', name: 'Apple' };
    mockFoodsService.findById.mockResolvedValue(food);

    const result = await controller.findOne('food-1');

    expect(mockFoodsService.findById).toHaveBeenCalledWith('food-1');
    expect(result).toEqual(food);
  });
});
