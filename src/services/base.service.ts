import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatDeepSeek } from '@langchain/deepseek';

/**
 * Base service for all business logic services
 * Provides common LangChain functionality and shared utilities
 */
@Injectable()
export abstract class BaseService {
  protected logger = new Logger('BaseService');
  protected llm: ChatDeepSeek;

  constructor(
    protected readonly configService: ConfigService,
    modelName: string = 'deepseek-chat',
    temperature: number = 0.7,
  ) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');

    if (!apiKey) {
      this.logger.warn('DeepSeek API key not configured');
      return;
    }

    this.llm = new ChatDeepSeek({
      apiKey: apiKey,
      model: modelName,
      temperature,
    });
  }

  /**
   * Execute a prompt and parse JSON response
   */
  protected async executeAndParseJSON(prompt: string, variables: Record<string, any> = {}): Promise<any> {
    const fullPrompt = variables 
      ? `${prompt}\n\n${JSON.stringify(variables)}`
      : prompt;

    this.logger.debug(`LLM Request: ${fullPrompt}`);

    const response = await this.llm.invoke([
      ['system', 'You are a helpful assistant. Respond in JSON format.'],
      ['human', fullPrompt]
    ]);

    this.logger.debug(`LLM Response: ${response.content}`);

    const content = response.content as string;
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonContent = jsonMatch ? jsonMatch[1].trim() : content;
    
    return JSON.parse(jsonContent);
  }

  /**
   * Execute a simple prompt
   */
  protected async executePrompt(prompt: string): Promise<string> {
    this.logger.debug(`LLM Request: ${prompt}`);

    const response = await this.llm.invoke([
      ['human', prompt]
    ]);

    this.logger.debug(`LLM Response: ${response.content}`);

    return response.content as string;
  }
}
