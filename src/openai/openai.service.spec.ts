import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from './openai.service';

const mockCreate = jest.fn();
const mockModerationsCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      moderations: {
        create: mockModerationsCreate,
      },
    })),
  };
});

describe('OpenAIService', () => {
  let service: OpenAIService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-api-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OpenAIService>(OpenAIService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('inferMacrosFromPhoto', () => {
    it('should return inferred meal with multiple items from photo', async () => {
      const mockResponse = {
        items: [
          {
            name: 'Grilled Chicken',
            grams: 200,
            calories_per_100g: 165,
            protein_per_100g: 31,
            carbs_per_100g: 0,
            fat_per_100g: 3.6,
          },
          {
            name: 'White Rice',
            grams: 150,
            calories_per_100g: 130,
            protein_per_100g: 2.7,
            carbs_per_100g: 28,
            fat_per_100g: 0.3,
          },
          {
            name: 'Black Beans',
            grams: 100,
            calories_per_100g: 132,
            protein_per_100g: 8.9,
            carbs_per_100g: 23.7,
            fat_per_100g: 0.5,
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      });

      const result = await service.inferMacrosFromPhoto(
        Buffer.from('fake-image'),
        'image/jpeg',
      );

      expect(result).toEqual(mockResponse);
      expect(result.items).toHaveLength(3);
      expect(result.items[0].name).toBe('Grilled Chicken');
      expect(result.items[1].name).toBe('White Rice');
      expect(result.items[2].name).toBe('Black Beans');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({ type: 'image_url' }),
              ]),
            }),
          ]),
        }),
      );
    });
  });

  describe('inferMacrosFromDescription', () => {
    it('should return inferred meal from text description', async () => {
      const mockResponse = {
        items: [
          {
            name: 'Brown Rice',
            grams: 150,
            calories_per_100g: 112,
            protein_per_100g: 2.6,
            carbs_per_100g: 23.5,
            fat_per_100g: 0.9,
          },
          {
            name: 'Grilled Chicken',
            grams: 200,
            calories_per_100g: 165,
            protein_per_100g: 31,
            carbs_per_100g: 0,
            fat_per_100g: 3.6,
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      });

      const result = await service.inferMacrosFromDescription(
        '200g of grilled chicken with 150g of brown rice',
      );

      expect(result).toEqual(mockResponse);
      expect(result.items).toHaveLength(2);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
        }),
      );
    });
  });

  describe('moderatePhoto', () => {
    it('should return flagged=false for safe content', async () => {
      mockModerationsCreate.mockResolvedValue({
        results: [
          {
            flagged: false,
            categories: {
              sexual: false,
              hate: false,
              harassment: false,
              'self-harm': false,
              'sexual/minors': false,
              'hate/threatening': false,
              'violence/graphic': false,
              violence: false,
            },
          },
        ],
      });

      const result = await service.moderatePhoto(
        Buffer.from('safe-image'),
        'image/jpeg',
      );

      expect(result.flagged).toBe(false);
      expect(result.reason).toBe('');
      expect(result.categories).toEqual([]);
      expect(mockModerationsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'omni-moderation-latest',
          input: expect.arrayContaining([
            expect.objectContaining({ type: 'image_url' }),
          ]),
        }),
      );
    });

    it('should return flagged=true with categories for inappropriate content', async () => {
      mockModerationsCreate.mockResolvedValue({
        results: [
          {
            flagged: true,
            categories: {
              sexual: true,
              hate: false,
              harassment: false,
              'self-harm': false,
              'sexual/minors': false,
              'hate/threatening': false,
              'violence/graphic': true,
              violence: true,
            },
          },
        ],
      });

      const result = await service.moderatePhoto(
        Buffer.from('suspicious-image'),
        'image/jpeg',
      );

      expect(result.flagged).toBe(true);
      expect(result.categories).toContain('sexual');
      expect(result.categories).toContain('violence/graphic');
      expect(result.categories).toContain('violence');
      expect(result.reason).toContain('sexual');
      expect(result.reason).toContain('violence');
    });

    it('should return flagged=false when no results are returned', async () => {
      mockModerationsCreate.mockResolvedValue({
        results: [],
      });

      const result = await service.moderatePhoto(
        Buffer.from('image'),
        'image/png',
      );

      expect(result.flagged).toBe(false);
      expect(result.reason).toBe('');
      expect(result.categories).toEqual([]);
    });
  });
});
