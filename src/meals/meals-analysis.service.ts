import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AnalyzeMealDto } from './dto/analyze-meal.dto';
import { CorrectMealDto } from './dto/correct-meal.dto';

export interface FoodAnalysis {
  name: string;
  portion: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string;
}

const SHARED_FIELDS = `- name: string (meal name)
- portion: string (portion description, e.g. "1 plate (~350g)")
- kcal: integer (total calories)
- proteinG: number (protein in grams, one decimal)
- carbsG: number (carbohydrates in grams, one decimal)
- fatG: number (fat in grams, one decimal)
- notes: string (brief observation or empty string)`;

const ANALYZE_SYSTEM_PROMPT = `You are a nutrition expert. Analyze the meal and return a JSON object with these exact fields:\n${SHARED_FIELDS}\n\nReturn ONLY the JSON object, no markdown, no extra text.`;

const CORRECT_SYSTEM_PROMPT = `You are a nutrition expert. You will receive a meal analysis and a correction instruction. Apply the correction and return a JSON object with these exact fields:\n${SHARED_FIELDS}\n\nReturn ONLY the JSON object, no markdown, no extra text.`;

@Injectable()
export class MealsAnalysisService {
  private readonly openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get('OPENAI_API_KEY') });
  }

  async analyze(dto: AnalyzeMealDto): Promise<FoodAnalysis> {
    const hasPhoto = !!dto.photoBase64;
    const hasDescription = !!dto.description;

    if (hasPhoto && hasDescription) {
      throw new BadRequestException('Provide either photoBase64 or description, not both');
    }
    if (!hasPhoto && !hasDescription) {
      throw new BadRequestException('Provide either photoBase64 or description');
    }

    const content = hasPhoto
      ? await this.analyzeFromPhoto(dto.photoBase64!)
      : await this.analyzeFromDescription(dto.description!);

    return content;
  }

  async correct(dto: CorrectMealDto): Promise<FoodAnalysis> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: CORRECT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Current analysis:\n${JSON.stringify(dto.current)}\n\nCorrection: ${dto.correction}`,
        },
      ],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    return this.parseResponse(response.choices[0].message.content);
  }

  private async analyzeFromPhoto(photoBase64: string): Promise<FoodAnalysis> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${photoBase64}`,
                detail: 'auto',
              },
            },
            { type: 'text', text: 'Analyze this meal and provide nutritional information.' },
          ],
        },
      ],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    return this.parseResponse(response.choices[0].message.content);
  }

  private async analyzeFromDescription(description: string): Promise<FoodAnalysis> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        { role: 'user', content: description },
      ],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    return this.parseResponse(response.choices[0].message.content);
  }

  private parseResponse(content: string | null): FoodAnalysis {
    if (!content) throw new InternalServerErrorException('AI returned empty response');
    try {
      const data = JSON.parse(content);
      return {
        name: String(data.name),
        portion: String(data.portion),
        kcal: Math.round(Number(data.kcal)),
        proteinG: Math.round(Number(data.proteinG) * 10) / 10,
        carbsG: Math.round(Number(data.carbsG) * 10) / 10,
        fatG: Math.round(Number(data.fatG) * 10) / 10,
        notes: String(data.notes ?? ''),
      };
    } catch {
      throw new InternalServerErrorException('Failed to parse AI response');
    }
  }
}
