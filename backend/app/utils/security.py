import re
import bleach

ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".pptx", ".md", ".txt", ".html", ".htm", ".webm", ".wav", ".mp3", ".ogg", ".m4a", ".flac"}
ALLOWED_MARKDOWN_TAGS = [
    "p", "pre", "code", "blockquote", "ul", "ol", "li", "strong", "em", "a",
    "h1", "h2", "h3", "h4", "h5", "h6", "hr", "br",
]

def sanitize_content_for_prompt(content: str) -> str:
    """
    Cleans untrusted content to prevent prompt injection.
    Removes common delimiters used in prompt attacks and instructions.
    """
    if not content:
        return ""
    
    # Remove common prompt injection delimiters and potential instruction triggers
    # We want to be careful not to strip too much, but enough to break injection attempts
    sanitized = content.replace("[[", " [ ").replace("]]", " ] ")
    sanitized = sanitized.replace("---", " - ")
    sanitized = sanitized.replace("###", " # ")
    
    # Remove phrases commonly used in jailbreaking or instruction overriding
    # But keep it lightweight to avoid destroying valid content
    patterns_to_remove = [
        r"(?i)ignore (all )?previous instructions",
        r"(?i)system prompt",
        r"(?i)you are now",
        r"(?i)stop what you are doing",
        r"(?i)new directive",
    ]
    
    for pattern in patterns_to_remove:
        sanitized = re.sub(pattern, "[STRIPPED]", sanitized)
        
    return sanitized.strip()


def sanitize_markdown(content: str) -> str:
    if not content:
        return ""
    return bleach.clean(content, tags=ALLOWED_MARKDOWN_TAGS, attributes={"a": ["href", "title"]}, strip=True)


def validate_upload_filename(filename: str) -> bool:
    match = re.search(r"(\.[a-z0-9]+)$", (filename or "").lower())
    return bool(match and match.group(1) in ALLOWED_UPLOAD_EXTENSIONS)
