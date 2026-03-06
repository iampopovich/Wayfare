import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

/**
 * Base service for all business logic services
 * Provides common LangChain functionality and shared utilities
 */
@Injectable()
export abstract class BaseService {
  protected logger = new Logger('BaseService');
  protected llm: ChatOpenAI;
  protected chain: LLMChain;

  constructor(
    protected readonly configService: ConfigService,
    modelName: string = 'gpt-3.5-turbo',
    temperature: number = 0.7,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName,
      temperature,
    });

    this._setupChain();
  }

  protected _setupChain(): void {
    // Default chain setup - can be overridden by subclasses
    this.chain = new LLMChain({
      llm: this.llm as any,
      prompt: PromptTemplate.fromTemplate(`
        You are a helpful travel planning assistant.

        Question: {question}

        Answer:
      `),
    });
  }

  /**
   * Execute a prompt with the LLM
   */
  protected async executePrompt(prompt: string, variables: Record<string, any> = {}): Promise<string> {
    if (!this.chain) {
      throw new Error('LLM chain not initialized');
    }

    try {
      const { text } = await this.chain.call(variables);
      return text.trim();
    } catch (error) {
      this.logger.error(`LLM execution error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse JSON response from LLM
   */
  protected async executeAndParseJSON(prompt: string, variables: Record<string, any> = {}): Promise<any> {
    const response = await this.executePrompt(prompt, variables);
    
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in LLM response');
    } catch (error) {
      this.logger.error(`Failed to parse LLM JSON response: ${error.message}`);
      throw error;
    }
  }
}
