# Ask Brain — AI Chat Interface

Ask Brain is your conversational interface to your knowledge base. It uses RAG (Retrieval-Augmented Generation) to answer questions grounded in your notes.

## How It Works

```
Your question → Semantic search → Top N relevant note chunks → LLM context window → Answer with citations
```

1. Your question is embedded and compared against all note embeddings
2. The most relevant note chunks are retrieved from ChromaDB
3. These chunks are injected into the LLM prompt as context
4. The LLM generates an answer grounded only in your notes

## Asking Good Questions

| Question Type | Example |
|--------------|---------|
| Factual | "What did I learn about machine learning last month?" |
| Synthesis | "What are the common themes across my book notes?" |
| Recall | "What was the main argument in [author]'s book?" |
| Task | "What tasks did I note for the Q4 project?" |

## Conversation History

Ask Brain maintains session history. You can:
- Ask follow-up questions naturally
- Request more detail: "expand on the third point"
- Change topic: the context resets after 10 messages

## Model Selection

Change the model used for Ask Brain in **Settings → AI Models → Chat Model**. Larger models give better synthesis but are slower.

## Limitations

- Only searches notes that have been **indexed** (embedding generated)
- Very new notes may not appear until the embedding pipeline runs
- Maximum context: depends on model's context window (usually 4k–32k tokens)

> [!TIP]
> Re-index all notes from **Settings → Database → Re-index Embeddings** if answers seem stale.
