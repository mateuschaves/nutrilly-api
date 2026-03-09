import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface InferredMealItem {
  name: string;
  grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

export interface InferredMeal {
  items: InferredMealItem[];
}

export interface ModerationResult {
  flagged: boolean;
  reason: string;
  categories: string[];
}

const SYSTEM_PROMPT = `You are a nutrition expert. You must analyze meals and estimate their nutritional content.
Identify EVERY distinct food item present in the meal. If there are multiple foods (e.g. rice, beans, meat, salad, sauce), list EACH one as a separate item in the array with its own estimated weight and macros.
Return ONLY a valid JSON response with the following structure (no extra text):
{
  "items": [
    {
      "name": "food item name",
      "grams": <estimated weight in grams>,
      "calories_per_100g": <calories per 100g>,
      "protein_per_100g": <protein in grams per 100g>,
      "carbs_per_100g": <carbs in grams per 100g>,
      "fat_per_100g": <fat in grams per 100g>
    }
  ]
}
Be as accurate as possible with your estimates. Always return at least one item. Never group different foods into a single item — each food must be its own entry.`;

@Injectable()
export class OpenAIService {
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async inferMacrosFromPhoto(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<InferredMeal> {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this meal photo carefully. Identify every distinct food item visible on the plate or in the image. Return each food as a separate item in the array with its estimated weight in grams and nutritional macros per 100g.',
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }
    return JSON.parse(content) as InferredMeal;
  }

  async inferMacrosFromDescription(
    description: string,
  ): Promise<InferredMeal> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze the following meal description carefully. Identify every distinct food item mentioned. Return each food as a separate item in the array with its estimated weight in grams and nutritional macros per 100g.\n\n"${description}"`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }
    return JSON.parse(content) as InferredMeal;
  }

  async moderatePhoto(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ModerationResult> {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await this.client.moderations.create({
      model: 'omni-moderation-latest',
      input: [
        {
          type: 'image_url',
          image_url: { url: dataUrl },
        },
      ],
    });

    const result = response.results[0];
    if (!result) {
      return { flagged: false, reason: '', categories: [] };
    }

    const flaggedCategories = Object.entries(result.categories)
      .filter(([, value]) => value === true)
      .map(([key]) => key);

    return {
      flagged: result.flagged,
      reason: flaggedCategories.length > 0
        ? `Content flagged for: ${flaggedCategories.join(', ')}`
        : '',
      categories: flaggedCategories,
    };
  }
}
