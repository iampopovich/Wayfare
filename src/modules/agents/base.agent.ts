import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

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

  /**
   * Setup the LLM chain with agent-specific prompt
   * Should be overridden by subclasses
   */
  protected _setupChain(): void {
    const prompt = this.getPromptTemplate();

    this.chain = new LLMChain({
      llm: this.llm as any,
      prompt: PromptTemplate.fromTemplate(prompt),
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
      if (!this.chain) {
        throw new Error('LLM chain not initialized');
      }

      const { text } = await this.chain.call(input);
      
      return {
        success: true,
        data: text,
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

    try {
      // Extract JSON from the response
      const jsonMatch = (response.data as string).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in agent response');
    } catch (error) {
      this.logger.error(`Failed to parse agent JSON response: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get agent name
   */
  getAgentName(): string {
    return this.constructor.name.replace('Agent', '');
  }
}
