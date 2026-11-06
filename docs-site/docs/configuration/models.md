# AI Models Configuration

Second Brain uses a multi-provider LLM router that selects the best available model for each task.

## Default Provider: Ollama

Ollama runs all models locally. No data leaves your machine.

```bash
# List available models
ollama list

# Pull additional models
ollama pull llama3.2:3b       # Better reasoning
ollama pull qwen2.5:7b        # Stronger, needs 8GB+ RAM
ollama pull phi3.5:mini       # Fast, low RAM
ollama pull nomic-embed-text  # Required for embeddings
```

## Switching Models at Runtime

Go to **Settings → AI Models** to switch the default model without restarting. Changes apply immediately.

## Feature Routing

Different features can use different models. Edit `runtime-settings.yaml` in your data directory:

```yaml
llm:
  feature_routing:
    chat: qwen2.5:7b          # Conversational AI
    summarize: qwen2.5:0.5b   # Fast summarization
    embeddings: nomic-embed-text
  fallback_chain:
    - ollama
    - openai_compatible
```

## Cloud Providers (Opt-in)

Add API keys to `.env` to enable cloud fallback:

```dotenv
SECOND_BRAIN_OPENAI_API_KEY=sk-...
SECOND_BRAIN_ANTHROPIC_API_KEY=sk-ant-...
```

> [!NOTE]
> Cloud providers are only used if Ollama fails and `cloud_opt_in: true` is set in runtime-settings.yaml. By default, all AI runs locally.

## Model Recommendations

| Use Case | Model | VRAM |
|----------|-------|------|
| Light/fast | qwen2.5:0.5b | 1 GB |
| Balanced | llama3.2:3b | 3 GB |
| High quality | qwen2.5:7b | 6 GB |
| Embeddings | nomic-embed-text | 300 MB |
