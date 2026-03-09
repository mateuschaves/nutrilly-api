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

const SYSTEM_PROMPT = `You are a nutrition expert. You must analyze meals and estimate their nutritional content.
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
Be as accurate as possible with your estimates. Always return at least one item.`;

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
              text: 'Analyze this meal photo and estimate the nutritional content of each food item visible.',
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
          content: `Analyze the following meal description and estimate the nutritional content of each food item:\n\n"${description}"`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    return JSON.parse(content) as InferredMeal;
  }
}
