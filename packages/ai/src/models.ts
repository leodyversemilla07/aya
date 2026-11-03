import {
  type AiClient,
  type AiMessage,
  type AiProviderConfig,
  type AiRequestOptions,
  type AiResponse,
  type ProviderId,
  createAiClient,
  getProviderConfig,
} from './index.js';

export interface AiModel {
  readonly id: string;
  readonly provider: ProviderId;
  readonly name?: string;
  readonly contextWindow?: number;
  readonly maxOutputTokens?: number;
}

export interface AiProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly models: readonly AiModel[];
  complete(model: AiModel, messages: AiMessage[], options?: AiRequestOptions): Promise<AiResponse>;
}

export interface CreateModelsOptions {
  providers?: readonly AiProvider[];
  config?: AiProviderConfig;
}

export class ConfiguredProvider implements AiProvider {
  readonly models: readonly AiModel[];
  private readonly client: AiClient;

  constructor(
    readonly id: ProviderId,
    readonly name: string,
    config: AiProviderConfig,
  ) {
    this.client = createAiClient(config);
    this.models = [
      {
        id: config.model,
        provider: config.provider,
        name: config.model,
      },
    ];
  }

  complete(model: AiModel, messages: AiMessage[], options?: AiRequestOptions) {
    if (model.provider !== this.id || !this.models.some((candidate) => candidate.id === model.id)) {
      throw new Error(
        `Model "${model.provider}/${model.id}" is not registered with provider "${this.id}".`,
      );
    }
    return this.client.complete(messages, options);
  }
}

export function createProvider(
  config: AiProviderConfig,
  name: string = config.provider,
): AiProvider {
  return new ConfiguredProvider(config.provider, name, config);
}

export class Models {
  private readonly providers = new Map<ProviderId, AiProvider>();

  constructor(options: CreateModelsOptions = {}) {
    for (const provider of options.providers ?? []) this.setProvider(provider);
    if (!options.providers?.length) {
      const config = options.config ?? getProviderConfig();
      this.setProvider(createProvider(config));
    }
  }

  setProvider(provider: AiProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  deleteProvider(provider: ProviderId): boolean {
    return this.providers.delete(provider);
  }

  getProviders(): readonly AiProvider[] {
    return [...this.providers.values()];
  }

  getProvider(provider: ProviderId): AiProvider | undefined {
    return this.providers.get(provider);
  }

  getModels(provider?: ProviderId): readonly AiModel[] {
    if (provider) return this.providers.get(provider)?.models ?? [];
    return this.getProviders().flatMap((entry) => entry.models);
  }

  getModel(provider: ProviderId, modelId: string): AiModel | undefined {
    return this.getProvider(provider)?.models.find((model) => model.id === modelId);
  }

  async complete(
    model: AiModel,
    messages: AiMessage[],
    options?: AiRequestOptions,
  ): Promise<AiResponse> {
    const provider = this.getProvider(model.provider);
    if (!provider) throw new Error(`AI provider "${model.provider}" is not registered.`);
    return provider.complete(model, messages, options);
  }
}

export function createModels(options: CreateModelsOptions = {}): Models {
  return new Models(options);
}
