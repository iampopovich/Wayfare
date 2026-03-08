import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

export interface ISearchOptions {
  query: string;
  location?: { latitude: number; longitude: number; address?: string };
  filters?: Record<string, any>;
}

export interface ISearchResult<T = any> {
  items: T[];
  totalCount: number;
  page?: number;
  hasMore?: boolean;
  metadata?: Record<string, any>;
}

export interface ILocation {
  latitude: number;
  longitude: number;
  address?: string;
  placeId?: string;
}

/**
 * Base repository for all data access layers
 * Provides common LangChain functionality for parsing responses
 */
@Injectable()
export abstract class BaseRepository {
  protected readonly logger = new Logger('BaseRepository');
  protected llm: ChatOpenAI;

  constructor(
    protected readonly configService: ConfigService,
    apiKey?: string,
    modelName: string = 'deepseek-chat',
  ) {
    const deepSeekKey = apiKey || this.configService.get<string>('DEEPSEEK_API_KEY');

    if (deepSeekKey) {
      this.llm = new ChatOpenAI({
        openAIApiKey: deepSeekKey,
        modelName,
        temperature: 0.7,
        configuration: {
          baseURL: 'https://api.deepseek.com',
        },
      });
    }
  }

  /**
   * Parse unstructured text into structured data using LLM
   */
  protected async parseWithLLM<T>(content: string): Promise<T> {
    const prompt = `Parse the following content into a structured JSON format:\n${content}\n\nExtract key details like names, addresses, prices, ratings, and amenities. Return ONLY a valid JSON object, no additional text.`;

    this.logger.debug(`Repository LLM Request: ${prompt}`);

    const response = await this.llm.invoke([
      ['human', prompt]
    ]);

    this.logger.debug(`Repository LLM Response: ${response.content}`);

    const aiContent = response.content as string;

    // Extract JSON from markdown code blocks if present
    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonContent = jsonMatch ? jsonMatch[1].trim() : aiContent;

    return JSON.parse(jsonContent) as T;
  }

  /**
   * Search for items based on query and optional location/filters
   */
  abstract search(options: ISearchOptions): Promise<ISearchResult>;

  /**
   * Get detailed information for a specific item
   */
  abstract getDetails(itemId: string): Promise<any>;
}
