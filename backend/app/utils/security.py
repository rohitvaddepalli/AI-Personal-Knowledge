import re

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
