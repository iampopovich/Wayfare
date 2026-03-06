import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

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
  protected parserChain: LLMChain;

  constructor(
    protected readonly configService: ConfigService,
    apiKey?: string,
    modelName: string = 'gpt-3.5-turbo',
  ) {
    const openAiKey = apiKey || this.configService.get<string>('OPENAI_API_KEY');
    
    if (openAiKey) {
      this.llm = new ChatOpenAI({
        openAIApiKey: openAiKey,
        modelName,
        temperature: 0.7,
      });
      this._setupChains();
    }
  }

  protected _setupChains(): void {
    this.parserChain = new LLMChain({
      llm: this.llm as any,
      prompt: PromptTemplate.fromTemplate(`
        Parse the following content into a structured JSON format:
        {content}

        Extract key details like names, addresses, prices, ratings, and amenities.
        Return ONLY a valid JSON object, no additional text.
      `),
    });
  }

  /**
   * Parse unstructured text into structured data using LLM
   */
  protected async parseWithLLM<T>(content: string): Promise<T> {
    if (!this.parserChain) {
      throw new Error('LLM chain not initialized');
    }

    const { text } = await this.parserChain.call({ content });
    
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error('No JSON found in LLM response');
    } catch (error) {
      this.logger.error(`Failed to parse LLM response: ${error.message}`);
      throw error;
    }
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
