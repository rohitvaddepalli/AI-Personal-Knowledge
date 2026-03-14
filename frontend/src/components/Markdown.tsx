import { CSSProperties, ComponentType, useEffect, useState } from 'react';

type MarkdownModule = typeof import('@uiw/react-md-editor');

let markdownModulePromise: Promise<MarkdownModule> | null = null;

function loadMarkdownModule() {
  if (!markdownModulePromise) {
    markdownModulePromise = import('@uiw/react-md-editor');
  }

  return markdownModulePromise;
}

function useMarkdownModule() {
  const [module, setModule] = useState<MarkdownModule | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadMarkdownModule()
      .then((loadedModule) => {
        if (!cancelled) {
          setModule(loadedModule);
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  return module;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value?: string) => void;
  height?: number;
}

export function MarkdownEditor({ value, onChange, height = 500 }: MarkdownEditorProps) {
  const module = useMarkdownModule();

  if (!module) {
    return (
      <textarea
        className="textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight: `${height}px`, resize: 'vertical' }}
      />
    );
  }

  const Editor = module.default as ComponentType<MarkdownEditorProps>;

  return <Editor value={value} onChange={onChange} height={height} />;
}

interface MarkdownPreviewProps {
  source: string;
  skipHtml?: boolean;
  style?: CSSProperties;
  fallbackClassName?: string;
}

export function MarkdownPreview({
  source,
  skipHtml = true,
  style,
  fallbackClassName,
}: MarkdownPreviewProps) {
  const module = useMarkdownModule();

  if (!module) {
    return (
      <div className={fallbackClassName} style={style}>
        {source}
      </div>
    );
  }

  const Preview = module.default.Markdown;

  return <Preview source={source} skipHtml={skipHtml} style={style} />;
}
