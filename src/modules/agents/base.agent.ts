import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Base response interface for all agents
 */
export interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Base agent class for all AI-powered agents
 * Provides common LangChain functionality and response formatting
 */
@Injectable()
export abstract class BaseAgent {
  protected readonly logger = new Logger(BaseAgent.name);
  protected llm: ChatOpenAI;

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

    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName,
      temperature,
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    });
  }

  /**
   * Get the prompt template for this agent
   * Should be overridden by subclasses
   */
  protected abstract getPromptTemplate(): string;

  /**
   * Execute the agent with given input
   */
  async execute(input: any): Promise<AgentResponse> {
    try {
      const prompt = this.getPromptTemplate();
      const fullPrompt = `${prompt}\n\nInput: ${JSON.stringify(input)}`;

      this.logger.debug(`Agent Request: ${fullPrompt}`);

      const response = await this.llm.invoke([
        ['human', fullPrompt]
      ]);

      this.logger.debug(`Agent Response: ${response.content}`);

      return {
        success: true,
        data: response.content,
        metadata: {
          agentName: this.constructor.name,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Agent execution error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        metadata: {
          agentName: this.constructor.name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Execute and parse JSON response
   */
  protected async executeAndParseJSON(input: any): Promise<any> {
    const response = await this.execute(input);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Agent execution failed');
    }

    const content = response.data as string;

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonContent = jsonMatch ? jsonMatch[1].trim() : content;

    return JSON.parse(jsonContent);
  }

  /**
   * Get agent name
   */
  getAgentName(): string {
    return this.constructor.name.replace('Agent', '');
  }
}
