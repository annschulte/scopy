import activeWindow from "active-win";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface WindowInfo {
  title: string;
  app: string;
  url: string;
}

// Pure functions for context detection
export const isLinkedInProfile = (windowInfo: WindowInfo): boolean =>
  windowInfo.url?.includes("linkedin.com") ||
  windowInfo.title?.toLowerCase().includes("linkedin");

export const isCodeEditor = (windowInfo: WindowInfo): boolean => {
  const codeApps = [
    "code",
    "vscode",
    "sublime",
    "atom",
    "webstorm",
    "intellij",
    "cursor",
    "vim",
    "neovim",
    "emacs"
  ];
  return codeApps.some((app) =>
    windowInfo.app?.toLowerCase().includes(app.toLowerCase())
  );
};

export const isNewsArticle = (windowInfo: WindowInfo): boolean => {
  const newsPatterns = [
    "news",
    "article",
    "blog",
    "post",
    "medium.com",
    "substack.com",
    "techcrunch",
    "verge",
    "ycombinator",
    "reddit.com",
    "hacker news",
    "hackernews"
  ];

  const textToCheck = `${windowInfo.title} ${windowInfo.url}`.toLowerCase();
  return newsPatterns.some((pattern) => textToCheck.includes(pattern));
};

export const isBrowser = (windowInfo: WindowInfo): boolean => {
  const browsers = ["safari", "chrome", "firefox", "edge", "arc"];
  return browsers.some((browser) =>
    windowInfo.app?.toLowerCase().includes(browser)
  );
};

export const isDocumentEditor = (windowInfo: WindowInfo): boolean => {
  const docApps = ["word", "pages", "google docs", "notion", "obsidian", "roam"];
  return docApps.some((app) =>
    windowInfo.app?.toLowerCase().includes(app.toLowerCase()) ||
    windowInfo.title?.toLowerCase().includes(app.toLowerCase())
  );
};

// URL extraction utility
export const extractUrlFromTitle = (title: string): string => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = title.match(urlRegex);
  return match ? match[0] : "";
};

// Get active window information using AppleScript (no screen recording permission needed)
export const getActiveWindowInfoAppleScript = async (): Promise<WindowInfo> => {
  try {
    // Use AppleScript to get the frontmost application and window
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        try
          set frontWindow to name of window 1 of application process frontApp
        on error
          set frontWindow to "Unknown"
        end try
      end tell
      return frontApp & "|||" & frontWindow
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const [app, title] = stdout.trim().split('|||');
    
    return {
      title: title || "Unknown",
      app: app || "Unknown", 
      url: extractUrlFromTitle(title || ""),
    };
  } catch (error) {
    console.log('AppleScript method failed, falling back to active-win');
    // Fallback to active-win if AppleScript fails
    try {
      const window = await activeWindow();
      return {
        title: window?.title || "Unknown",
        app: window?.owner?.name || "Unknown",
        url: extractUrlFromTitle(window?.title || ""),
      };
    } catch (fallbackError) {
      return {
        title: "Unknown",
        app: "Unknown",
        url: "",
      };
    }
  }
};

// Get active window information (uses AppleScript first, then falls back to active-win)
export const getActiveWindowInfo = async (): Promise<WindowInfo> => {
  if (process.platform === 'darwin') {
    return getActiveWindowInfoAppleScript();
  } else {
    // Use active-win on other platforms
    try {
      const window = await activeWindow();
      return {
        title: window?.title || "Unknown",
        app: window?.owner?.name || "Unknown", 
        url: extractUrlFromTitle(window?.title || ""),
      };
    } catch (error) {
      return {
        title: "Unknown",
        app: "Unknown",
        url: "",
      };
    }
  }
};

// Context extractors
export const extractLinkedInContext = (
  selectedText: string,
  windowInfo: WindowInfo
): string => {
  let context = `**Context Type:** LinkedIn Profile\n\n`;

  if (selectedText && selectedText.length > 10) {
    // Extract key information from LinkedIn profile
    const cleanedContent = cleanLinkedInProfile(selectedText);
    context += `**Selected Content:**\n${cleanedContent}\n\n`;
  }

  context += `**Suggested AI Prompts:**\n`;
  context += `• "Analyze this LinkedIn profile and suggest networking talking points"\n`;
  context += `• "What questions should I ask this person in a coffee chat?"\n`;
  context += `• "How does their background relate to my work in [your field]?"\n`;
  context += `• "Write a personalized connection request message"\n`;
  context += `• "What mutual connections or interests might we have?"\n`;

  return context;
};

// Clean LinkedIn profile content to focus on key information
const cleanLinkedInProfile = (text: string): string => {
  if (!text) return '';
  
  const lines = text.split('\n');
  const meaningfulLines: string[] = [];
  let inPost = false;
  let postLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and UI noise
    if (!line || 
        line.match(/^\d+,?\d*\s*(followers?|connections?)/) ||
        line.match(/Contact info|View.*profile|Show all \d+/) ||
        line.match(/^\d+(st|nd|rd|th)\s+degree/) ||
        line.match(/^(She|He|They)\/(Her|Him|Them)/) ||
        line.match(/Followed by.*and \d+ other/) ||
        line.match(/You are on the messaging overlay/) ||
        line.match(/Messaging You are on the messaging overlay/) ||
        line.match(/View.*graphic link/) ||
        line.match(/• \d+\w+.*Premium.*\d+\w+/) ||
        line.match(/^\d+h • .*hours? ago.*LinkedIn/) ||
        line.match(/From.*company/) ||
        line.match(/^\d+$/) || // Like counts
        line.match(/^\w+\.\w+$/) // Domain references
    ) {
      continue;
    }
    
    // Detect start of a post (usually contains emojis or starts with 🚨)
    if (line.match(/^[🚨💡⚡🔥📢🎉]/) || 
        (line.length > 50 && line.includes('update') && line.includes(':'))) {
      if (postLines.length > 0) {
        // Save previous post
        const post = postLines.join('\n').trim();
        if (post.length > 100) { // Only include substantial posts
          meaningfulLines.push(`**Recent Post:**\n${post}\n`);
        }
      }
      inPost = true;
      postLines = [line];
      continue;
    }
    
    // If we're in a post, collect lines until we hit job/education info
    if (inPost) {
      if (line.match(/^\w+\s+\d{4}\s*-\s*(Present|\w+\s+\d{4})/) || // Job dates
          line.match(/^(Experience|Education|Licenses|Honors)/) ||
          line.match(/Bachelor|Master|PhD|University|College/)) {
        // End of post, start of profile sections
        const post = postLines.join('\n').trim();
        if (post.length > 100) {
          meaningfulLines.push(`**Recent Post:**\n${post}\n`);
        }
        inPost = false;
        postLines = [];
        // Don't skip this line, it's profile info
      } else {
        postLines.push(line);
        continue;
      }
    }
    
    // Include job titles and companies
    if (line.match(/^[A-Z][^a-z]*@/) || // Job title @ Company
        line.match(/^\w+.*\d{4}\s*-\s*(Present|\w+\s+\d{4})/) || // Date ranges
        line.match(/(Director|Manager|Engineer|Developer|Designer|Analyst|Consultant|VP|CEO|CTO|CMO)/) ||
        line.match(/(Bachelor|Master|PhD|University|College)/)) {
      meaningfulLines.push(line);
    }
    
    // Include substantial content (longer than 30 chars, not UI elements)
    else if (line.length > 30 && 
             !line.match(/^\w+\s+profile picture/) &&
             !line.match(/^·\s+\d+\w+.*degree/) &&
             !line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/) &&
             !line.match(/^\d+\s+\w+\s+ago/)) {
      meaningfulLines.push(line);
    }
  }
  
  // Add any remaining post
  if (inPost && postLines.length > 0) {
    const post = postLines.join('\n').trim();
    if (post.length > 100) {
      meaningfulLines.push(`**Recent Post:**\n${post}\n`);
    }
  }
  
  return meaningfulLines.join('\n').trim();
};

export const extractCodeContext = (
  selectedText: string,
  windowInfo: WindowInfo
): string => {
  let context = `**Context Type:** Code Editor\n\n`;

  if (selectedText && selectedText.length > 10) {
    context += `**Selected Code:**\n\`\`\`\n${selectedText}\n\`\`\`\n\n`;
  }

  context += `**File:** ${windowInfo.title}\n\n`;
  context += `**Suggested AI Prompts:**\n`;
  context += `• "Explain what this code does step by step"\n`;
  context += `• "Are there any bugs or potential improvements?"\n`;
  context += `• "Write unit tests for this function"\n`;
  context += `• "Refactor this code for better readability"\n`;
  context += `• "Add TypeScript types to this code"\n`;
  context += `• "What design patterns are being used here?"\n`;

  return context;
};

export const extractNewsContext = (
  selectedText: string,
  windowInfo: WindowInfo
): string => {
  let context = `**Context Type:** News/Article\n\n`;

  if (selectedText && selectedText.length > 10) {
    context += `**Selected Text:**\n${selectedText}\n\n`;
  }

  context += `**Article:** ${windowInfo.title}\n\n`;
  context += `**Suggested AI Prompts:**\n`;
  context += `• "Summarize the key points of this article"\n`;
  context += `• "What are the implications for [specific industry]?"\n`;
  context += `• "What counterarguments might exist to this viewpoint?"\n`;
  context += `• "How does this relate to recent trends in [topic]?"\n`;
  context += `• "What questions should I ask to think deeper about this?"\n`;

  return context;
};

export const extractDocumentContext = (
  selectedText: string,
  windowInfo: WindowInfo
): string => {
  let context = `**Context Type:** Document/Writing\n\n`;

  if (selectedText && selectedText.length > 10) {
    context += `**Selected Text:**\n${selectedText}\n\n`;
  }

  context += `**Document:** ${windowInfo.title}\n\n`;
  context += `**Suggested AI Prompts:**\n`;
  context += `• "Help me improve the clarity and flow of this writing"\n`;
  context += `• "Suggest alternative ways to phrase this content"\n`;
  context += `• "What questions does this content raise?"\n`;
  context += `• "How can I make this more engaging for readers?"\n`;
  context += `• "Check for grammar, style, and tone improvements"\n`;

  return context;
};

export const extractBrowserContext = (
  selectedText: string,
  windowInfo: WindowInfo
): string => {
  let context = `**Context Type:** Web Content\n\n`;

  if (selectedText && selectedText.length > 10) {
    context += `**Selected Content:**\n${selectedText}\n\n`;
  }

  if (windowInfo.url) {
    context += `**URL:** ${windowInfo.url}\n`;
  }
  context += `**Page:** ${windowInfo.title}\n\n`;
  
  context += `**Suggested AI Prompts:**\n`;
  context += `• "Summarize this web content in simple terms"\n`;
  context += `• "What are the key takeaways from this page?"\n`;
  context += `• "How reliable is this information source?"\n`;
  context += `• "What related topics should I explore?"\n`;
  context += `• "Extract actionable insights from this content"\n`;

  return context;
};

export const extractDefaultContext = (selectedText: string): string => {
  let context = `**Context Type:** General Content\n\n`;

  if (selectedText && selectedText.length > 10) {
    context += `**Content:**\n${selectedText}\n\n`;
  }

  context += `**Suggested AI Prompts:**\n`;
  context += `• "Explain this content in simple terms"\n`;
  context += `• "What are the key takeaways?"\n`;
  context += `• "What questions does this raise?"\n`;
  context += `• "How can I apply this information?"\n`;
  context += `• "What context am I missing to understand this better?"\n`;

  return context;
};

// Main context extraction function
export const extractSmartContext = (
  selectedText: string,
  windowInfo: WindowInfo
): string => {
  const timestamp = new Date().toLocaleString();

  let context = `# Smart Copy Context\n`;
  context += `**Timestamp:** ${timestamp}\n`;
  context += `**Application:** ${windowInfo.app}\n`;
  context += `**Window:** ${windowInfo.title}\n`;

  if (windowInfo.url) {
    context += `**URL:** ${windowInfo.url}\n`;
  }

  context += `\n---\n\n`;

  // Route to appropriate extractor
  if (isLinkedInProfile(windowInfo)) {
    context += extractLinkedInContext(selectedText, windowInfo);
  } else if (isCodeEditor(windowInfo)) {
    context += extractCodeContext(selectedText, windowInfo);
  } else if (isNewsArticle(windowInfo)) {
    context += extractNewsContext(selectedText, windowInfo);
  } else if (isDocumentEditor(windowInfo)) {
    context += extractDocumentContext(selectedText, windowInfo);
  } else if (isBrowser(windowInfo)) {
    context += extractBrowserContext(selectedText, windowInfo);
  } else {
    context += extractDefaultContext(selectedText);
  }

  return context;
};

// Get context type for display
export const getContextType = (windowInfo: WindowInfo): string => {
  if (isLinkedInProfile(windowInfo)) return "LinkedIn Profile";
  if (isCodeEditor(windowInfo)) return "Code Editor";
  if (isNewsArticle(windowInfo)) return "News/Article";
  if (isDocumentEditor(windowInfo)) return "Document/Writing";
  if (isBrowser(windowInfo)) return "Web Content";
  return "General Content";
};

// Show system notification
export const showNotification = async (title: string, message: string): Promise<void> => {
  try {
    await execAsync(
      `osascript -e 'display notification "${message}" with title "${title}"'`
    );
  } catch (error) {
    console.log(`📢 ${title}: ${message}`);
  }
};