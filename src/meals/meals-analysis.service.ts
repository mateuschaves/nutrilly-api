import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AnalyzeMealDto } from './dto/analyze-meal.dto';
import { CorrectMealDto } from './dto/correct-meal.dto';

export interface MealAnalysisResult {
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portion: string;
}

export interface FoodAnalysis {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}

const ANALYZE_SYSTEM_PROMPT = `You are a nutrition expert. Analyze the meal and return a JSON object with these exact fields:
- name: string (meal name)
- kcal: integer (total calories)
- proteinG: number (protein in grams, one decimal)
- carbsG: number (carbohydrates in grams, one decimal)
- fatG: number (fat in grams, one decimal)
- portion: string (portion description, e.g. "1 plate (~350g)")

Return ONLY the JSON object, no markdown, no extra text.`;

const CORRECT_SYSTEM_PROMPT = `You are a nutrition expert. You will receive a meal analysis and a correction instruction from the user. Update the analysis according to the instruction and return a JSON object with these exact fields:
- name: string (meal name)
- portion: string (portion description)
- calories: integer (total calories)
- protein: number (protein in grams, one decimal)
- carbs: number (carbohydrates in grams, one decimal)
- fat: number (fat in grams, one decimal)
- notes: string (brief note about the correction applied, or empty string)

Return ONLY the JSON object, no markdown, no extra text.`;

@Injectable()
export class MealsAnalysisService {
  private readonly openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get('OPENAI_API_KEY') });
  }

  async analyze(dto: AnalyzeMealDto): Promise<MealAnalysisResult> {
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

    return this.parseCorrectionResponse(response.choices[0].message.content);
  }

  private parseCorrectionResponse(content: string | null): FoodAnalysis {
    if (!content) throw new InternalServerErrorException('AI returned empty response');
    try {
      const data = JSON.parse(content);
      return {
        name: String(data.name),
        portion: String(data.portion),
        calories: Math.round(Number(data.calories)),
        protein: Math.round(Number(data.protein) * 10) / 10,
        carbs: Math.round(Number(data.carbs) * 10) / 10,
        fat: Math.round(Number(data.fat) * 10) / 10,
        notes: String(data.notes ?? ''),
      };
    } catch {
      throw new InternalServerErrorException('Failed to parse AI response');
    }
  }

  private async analyzeFromPhoto(photoBase64: string): Promise<MealAnalysisResult> {
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

  private async analyzeFromDescription(description: string): Promise<MealAnalysisResult> {
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

  private parseResponse(content: string | null): MealAnalysisResult {
    if (!content) throw new InternalServerErrorException('AI returned empty response');
    try {
      const data = JSON.parse(content);
      return {
        name: String(data.name),
        kcal: Math.round(Number(data.kcal)),
        proteinG: Math.round(Number(data.proteinG) * 10) / 10,
        carbsG: Math.round(Number(data.carbsG) * 10) / 10,
        fatG: Math.round(Number(data.fatG) * 10) / 10,
        portion: String(data.portion),
      };
    } catch {
      throw new InternalServerErrorException('Failed to parse AI response');
    }
  }
}
