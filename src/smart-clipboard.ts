import clipboardy from "clipboardy";
import { getActiveWindowInfo } from "./smart-context.js";
import { ConfigManager } from "./config.js";
import { BrowserWindow } from "electron";

interface ClipboardWatchConfig {
  enabled: boolean;
  minLength: number;
  maxLength: number;
  enhanceFromApps: string[];
  silentMode: boolean;
  autoPrompt: boolean;
}

export class SmartClipboard {
  private configManager: ConfigManager;
  private config: ClipboardWatchConfig;
  private mainWindow: BrowserWindow | null = null;
  private lastCopiedContent: string = "";
  private lastWindowInfo: any = null;

  constructor(mainWindow?: BrowserWindow) {
    this.configManager = new ConfigManager();
    this.config = this.loadConfig();
    this.mainWindow = mainWindow || null;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private loadConfig(): ClipboardWatchConfig {
    const filteringConfig = this.configManager.getFilteringConfig();
    const limits = this.configManager.getContentLengthLimits();

    return {
      enabled: false, // Default to manual mode for better UX
      minLength: limits.min,
      maxLength: limits.max,
      enhanceFromApps: [
        "slack",
        "discord",
        "telegram",
        "mail",
        "outlook",
        "gmail",
        "linkedin",
        "twitter",
        "facebook",
        "safari",
        "chrome",
        "firefox",
        "arc",
        "notion",
        "obsidian",
        "bear",
        "code",
        "vscode",
        "github",
      ],
      silentMode: false,
      autoPrompt: false,
    };
  }

  initialize(): void {
    console.log("🎯 Smart Clipboard initialized - hotkey-only mode");
  }

  // Manual trigger for smart formatting highlighted text
  async manualTrigger(): Promise<void> {
    try {
      console.log("🎯 Manual trigger called!");
      
      // First, copy the selected text to clipboard
      await this.copySelectedText();
      
      // Longer delay to ensure clipboard is updated
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const selectedText = await clipboardy.read();
      console.log("📋 Clipboard content:", selectedText?.substring(0, 100) + "...");
      
      if (!selectedText || !selectedText.trim()) {
        console.log("📋 No text selected to format");
        return;
      }

      console.log("🎯 Manual trigger activated for selected text");
      await this.handleHotkeyClipboardContent(selectedText);
    } catch (error) {
      console.error("❌ Manual trigger failed:", error);
    }
  }

  // Copy selected text using system copy command
  private async copySelectedText(): Promise<void> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      if (process.platform === 'darwin') {
        // Use AppleScript to copy selected text on macOS
        await execAsync(`osascript -e 'tell application "System Events" to key code 8 using command down'`);
      } else {
        // Use ctrl+c on other platforms
        await execAsync('xdotool key ctrl+c');
      }
    } catch (error) {
      console.error("❌ Failed to copy selected text:", error);
      throw error;
    }
  }

  private async handleNewClipboardContent(content: string): Promise<void> {
    try {
      // Check if content meets basic criteria
      if (!this.shouldEnhanceContent(content)) {
        return;
      }

      // Get current app context
      const windowInfo = await getActiveWindowInfo();

      console.log(
        `📋 Copy detected from ${windowInfo.app}: ${content.length} chars`
      );

      // Automatically format the content
      const formattedContent = await this.enhanceContent(content, windowInfo);

      // Store both contents and show UI
      this.lastCopiedContent = content;
      this.lastWindowInfo = windowInfo;
      this.openSmartCopyUI();
    } catch (error) {
      console.error("❌ Content handling failed:", error);
    }
  }

  // Handle hotkey-triggered clipboard content with UI
  private async handleHotkeyClipboardContent(content: string): Promise<void> {
    try {
      // Get current app context
      const windowInfo = await getActiveWindowInfo();

      console.log(
        `⌨️ Hotkey triggered from ${windowInfo.app}: ${content.length} chars`
      );

      // Format the content
      const formattedContent = await this.enhanceContent(content, windowInfo);

      // Store both contents for later use
      this.lastCopiedContent = content;
      this.lastWindowInfo = windowInfo;

      // Directly show the UI instead of notifications
      this.openSmartCopyUI();
      
      console.log("✨ UI opened directly from hotkey");
    } catch (error) {
      console.error("❌ Hotkey content handling failed:", error);
      // Fallback: keep original content in clipboard
    }
  }

  private shouldEnhanceContent(content: string): boolean {
    // Check if smart filtering is enabled
    if (!this.configManager.isSmartFilteringEnabled()) {
      return false;
    }

    // Length checks
    if (
      content.length < this.config.minLength ||
      content.length > this.config.maxLength
    ) {
      return false;
    }

    const sensitivityLevel = this.configManager.getSensitivityLevel();

    // Advanced pattern recognition for sensitive data
    if (this.isSensitiveData(content)) {
      return false;
    }

    // Content quality analysis with sensitivity adjustment
    if (!this.hasQualityContent(content, sensitivityLevel)) {
      return false;
    }

    // Context-aware filtering with sensitivity adjustment
    if (this.isLowValueContent(content, sensitivityLevel)) {
      return false;
    }

    return true;
  }

  private isSensitiveData(content: string): boolean {
    const sensitivePatterns = [
      // Authentication
      /password|passw0rd|passwd/i,
      /token|auth|bearer|oauth/i,
      /secret|private.*key|api.*key/i,
      /credential|cert|certificate/i,

      // Encoded data
      /^[a-zA-Z0-9+/]{20,}={0,2}$/, // Base64
      /^[a-f0-9]{32,}$/, // Hex tokens (MD5/SHA)
      /^[a-f0-9]{40}$/, // SHA-1
      /^[a-f0-9]{64}$/, // SHA-256
      /^\$[a-zA-Z0-9./]{50,}$/, // Hashed passwords

      // Personal identifiers
      /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b[A-Z]{2}\d{6,8}[A-Z]?\b/, // Passport-like

      // File paths that might contain sensitive info
      /\/\.ssh\/|\/\.aws\/|\/\.env/,
      /config\.json|credentials\.json|keyfile/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(content));
  }

  private hasQualityContent(
    content: string,
    sensitivityLevel: "low" | "medium" | "high"
  ): boolean {
    const words = content.trim().split(/\s+/);

    // Adjust minimum word count based on sensitivity
    const minWordCount =
      sensitivityLevel === "low" ? 2 : sensitivityLevel === "medium" ? 3 : 5;
    if (words.length < minWordCount) {
      return false;
    }

    // Check for meaningful content vs UI noise
    const uiNoisePatterns = [
      /^(ok|cancel|apply|close|save|open|copy|paste|cut|undo|redo|submit|back|next|previous|forward)$/i,
      /^(menu|file|edit|view|window|help|home|about|contact|search|login|cart|profile)$/i,
      /^\d+\s*(notification|like|comment|share|view|follower|following)s?$/i,
      /^(loading|please wait|processing)\.{0,3}$/i,
      /^(more|show more|see more|view all|expand|collapse)$/i,
    ];

    const meaningfulWords = words.filter(
      (word) =>
        word.length > 2 &&
        !uiNoisePatterns.some((pattern) => pattern.test(word))
    );

    // Adjust quality threshold based on sensitivity
    const qualityThreshold =
      sensitivityLevel === "low"
        ? 0.4
        : sensitivityLevel === "medium"
        ? 0.6
        : 0.8;
    return meaningfulWords.length / words.length >= qualityThreshold;
  }

  private isLowValueContent(
    content: string,
    sensitivityLevel: "low" | "medium" | "high"
  ): boolean {
    // Single URLs without context (always filter unless low sensitivity)
    if (/^https?:\/\/\S+$/.test(content.trim()) && sensitivityLevel !== "low") {
      return true;
    }

    // File paths only (filter on medium/high sensitivity)
    if (
      /^[\/\\][\w\-_\/\\\.]+$/.test(content.trim()) &&
      sensitivityLevel !== "low"
    ) {
      return true;
    }

    // Email addresses only (filter on high sensitivity)
    if (
      /^[\w\.-]+@[\w\.-]+\.\w+$/.test(content.trim()) &&
      sensitivityLevel === "high"
    ) {
      return true;
    }

    // Phone numbers only (filter on medium/high sensitivity)
    if (
      /^[\+\d\s\-\(\)]+$/.test(content.trim()) &&
      content.length < 20 &&
      sensitivityLevel !== "low"
    ) {
      return true;
    }

    // Repetitive content (same word/phrase repeated)
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionThreshold =
      sensitivityLevel === "low"
        ? 0.2
        : sensitivityLevel === "medium"
        ? 0.3
        : 0.4;
    if (
      words.length > 10 &&
      uniqueWords.size / words.length < repetitionThreshold
    ) {
      return true;
    }

    // Navigation breadcrumbs (filter on medium/high sensitivity)
    if (
      /^[\w\s]+>\s*[\w\s]+>\s*[\w\s]+/.test(content.trim()) &&
      sensitivityLevel !== "low"
    ) {
      return true;
    }

    // Short numeric sequences (filter on high sensitivity)
    if (
      /^\d+$/.test(content.trim()) &&
      content.length < 10 &&
      sensitivityLevel === "high"
    ) {
      return true;
    }

    return false;
  }

  // Removed app filtering - now detects copies from all apps

  private async enhanceContent(
    content: string,
    windowInfo: any
  ): Promise<string> {
    const contentType = this.detectContentType(content, windowInfo);
    return this.createTemplateEnhancement(content, contentType);
  }

  private detectContentType(content: string, windowInfo: any): string {
    const app = windowInfo.app?.toLowerCase() || "";
    const title = windowInfo.title?.toLowerCase() || "";
    const url = windowInfo.url?.toLowerCase() || "";

    // Use advanced pattern recognition for content type detection
    const contentType = this.analyzeContentPattern(content, app, title, url);
    return contentType;
  }

  private analyzeContentPattern(
    content: string,
    app: string,
    title: string,
    url: string
  ): string {
    const context = `${app} ${title} ${url}`.toLowerCase();

    // Slack detection first (more specific than general chat)
    if (context.includes("slack") || this.isSlackContent(content)) {
      return "slack";
    }

    // LinkedIn detection with advanced patterns
    if (this.isLinkedInContent(content, context)) {
      return "linkedin";
    }

    // Email detection with comprehensive patterns
    if (this.isEmailContent(content, context)) {
      return "email";
    }

    // Code detection with language-specific patterns
    if (this.isCodeContent(content, context)) {
      return "code";
    }

    // Chat/messaging detection
    if (this.isChatContent(content, context)) {
      return "chat";
    }

    // Documentation detection
    if (this.isDocumentationContent(content, context)) {
      return "documentation";
    }

    // Article/news detection
    if (this.isArticleContent(content, context)) {
      return "article";
    }

    // Meeting/calendar content
    if (this.isMeetingContent(content, context)) {
      return "meeting";
    }

    // Shopping/e-commerce content
    if (this.isShoppingContent(content, context)) {
      return "shopping";
    }

    return "general";
  }

  private isLinkedInContent(content: string, context: string): boolean {
    const linkedinPatterns = [
      // Context indicators
      /linkedin\.com|linkedin/,
      // Content indicators
      /years? of experience|skills|connect|endorsement|recommendation/i,
      /view.*profile|professional network|career/i,
      /sent the following|shared a post|commented on/i,
      /\b(ceo|cto|manager|director|engineer|developer|analyst)\s+at\s+/i,
      /(graduated|studied)\s+at\s+/i,
      /\d+\s+(connection|follower)s?/i,
      /premium\s+member|open\s+to\s+work/i,
    ];

    return linkedinPatterns.some(
      (pattern) => pattern.test(content) || pattern.test(context)
    );
  }

  private isEmailContent(content: string, context: string): boolean {
    const emailPatterns = [
      // Context indicators
      /mail|email|outlook|gmail|thunderbird|yahoo.*mail|protonmail/,
      // Content structure
      /^(from|to|subject|cc|bcc):\s*/im,
      /^(dear|hello|hi)\s+[a-z]+,/im,
      /(best regards|sincerely|thanks|cheers),?\s*$/im,
      /^on\s+\w+,.*wrote:/im,
      // Email thread patterns
      /\w+\s+\<[\w\.-]+@[\w\.-]+\>/,
      /^[\w\s]+<[\w\.-]+@[\w\.-]+>\s*$/m,
      /^\w+,\s+\w+\s+\d+,?\s+\d+:\d+\s*(AM|PM)/m,
      // Email signature patterns
      /sent from my (iphone|android|mobile)/i,
      /this email was sent to/i,
      /unsubscribe|opt.?out/i,
      /attachments?/i,
      /scanned by gmail/i,
      // Multi-email thread patterns
      /(wed|tue|mon|thu|fri|sat|sun),?\s+\w+\s+\d+,?\s+\d+:\d+\s*(AM|PM)/i,
      /^[A-Z][a-z]+\s+[A-Z][a-z]+\s*$/m, // Names that appear in emails
    ];

    // Additional heuristic: check for email-like structure
    const hasEmailStructure =
      content.includes("@") &&
      (content.includes("wrote:") ||
        content.includes("to ") ||
        /\w+,\s+\w+\s+\d+/.test(content));

    return (
      emailPatterns.some(
        (pattern) => pattern.test(content) || pattern.test(context)
      ) || hasEmailStructure
    );
  }

  private isCodeContent(content: string, context: string): boolean {
    const codePatterns = [
      // Context indicators
      /code|github|gitlab|vscode|webstorm|sublime|atom|vim|neovim/,
      // Language keywords
      /(function|class|interface|type|enum)\s+\w+/,
      /(import|export|require|from)\s+/,
      /(const|let|var|def|fun|func)\s+\w+/,
      /(public|private|protected|static)\s+/,
      // Common code patterns
      /\{[\s\S]*\}/,
      /\w+\s*\([^)]*\)\s*[{:]/,
      /\/\/|\/\*|\#|<!--/,
      // File extensions in content
      /\.(js|ts|py|java|cpp|c|php|rb|go|rs|swift|kt)(\s|$)/i,
      // Command line patterns
      /^\$\s+\w+|npm\s+|pip\s+|git\s+/m,
    ];

    return codePatterns.some(
      (pattern) => pattern.test(content) || pattern.test(context)
    );
  }

  private isChatContent(content: string, context: string): boolean {
    const chatPatterns = [
      // Context indicators
      /slack|discord|telegram|whatsapp|teams|zoom|messages|imessage|sms|chat/i,
      // Chat patterns
      /^@\w+|#\w+/m,
      /joined the (channel|room|conversation)/i,
      /(dm|direct message)/i,
      /^\w+:\s+/m, // Username: message format
      /^[A-Z][a-z]+ [A-Z][a-z]+\s*$/m, // Full names (common in chat apps)
      /\bemoji\b|:\w+:|[\u{1F600}-\u{1F64F}]/u, // Emoji patterns
      /thread|reply to this message|replied to/i,
      /status:\s+(online|offline|away|busy)/i,
      // Conversation indicators
      /(yesterday|today|now|\d{1,2}:\d{2})\s*(am|pm)?/i, // Time stamps
      /^(you|me):\s+/im, // You: Me: patterns
      /\b(said|says|wrote|replied|responded)\b/i,
      // Multi-person conversation patterns
      /^\w+\s+\d{1,2}:\d{2}/m, // Name timestamp format
      /^>\s+/m, // Quoted text (common in replies)
      // Message threading
      /in reply to|replying to|thread started/i,
      // Group chat patterns
      /has left the|has joined|added.*to|removed.*from/i,
      // Chat app specific
      /forwarded message|forwarded from/i,
      /(call|video|voice)\s+(started|ended|missed)/i,
    ];

    // Additional heuristics for conversation detection
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    // Check for conversation-like structure
    const hasMultipleSpeakers =
      lines.filter(
        (line) => /^\w+:\s+/.test(line) || /^\w+\s+\d{1,2}:\d{2}/.test(line)
      ).length >= 2;

    const hasBackAndForth =
      lines.length >= 4 &&
      lines.some((line) => /^(you|me):/i.test(line)) &&
      lines.some((line) => /^\w+:/.test(line) && !/^(you|me):/i.test(line));

    return (
      chatPatterns.some(
        (pattern) => pattern.test(content) || pattern.test(context)
      ) ||
      hasMultipleSpeakers ||
      hasBackAndForth
    );
  }

  private isDocumentationContent(content: string, context: string): boolean {
    const docPatterns = [
      // Context indicators
      /docs?|documentation|wiki|readme|manual|guide/,
      // Structure patterns
      /^#{1,6}\s+\w+/m, // Markdown headers
      /\*\*\w+\*\*|\*\w+\*/, // Bold/italic markdown
      /\[.*\]\(.*\)/, // Markdown links
      /```|`\w+`/, // Code blocks
      /^\s*\d+\.\s+/m, // Numbered lists
      /^\s*[-*+]\s+/m, // Bullet lists
      /(api|endpoint|parameter|example|usage)/i,
      /getting started|installation|setup/i,
    ];

    return docPatterns.some(
      (pattern) => pattern.test(content) || pattern.test(context)
    );
  }

  private isArticleContent(content: string, context: string): boolean {
    const articlePatterns = [
      // Context indicators
      /news|article|blog|medium|substack|techcrunch|verge|reddit/,
      // Content structure
      /(published|author|written by|posted on)/i,
      /(read more|continue reading|breaking|exclusive)/i,
      /^\d+\s+(min|minute)s?\s+read/i,
      // News patterns
      /(according to|sources say|reported|announced)/i,
      /\b(update|breaking|developing)\b.*:/i,
    ];

    // Length-based heuristic for articles
    const isLongForm = content.split(/\s+/).length > 200;
    const hasArticlePatterns = articlePatterns.some(
      (pattern) => pattern.test(content) || pattern.test(context)
    );

    return hasArticlePatterns || isLongForm;
  }

  private isMeetingContent(content: string, context: string): boolean {
    const meetingPatterns = [
      // Context indicators
      /calendar|meeting|zoom|teams|webex|event/,
      // Meeting content
      /(meeting|call|conference)\s+(scheduled|starts|ends)/i,
      /join.*meeting|meeting.*id/i,
      /(agenda|notes|action items|follow.?up)/i,
      /\b\d{1,2}:\d{2}\s*(am|pm)\b/i, // Time patterns
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /attendees?|participants?|organizer/i,
    ];

    return meetingPatterns.some(
      (pattern) => pattern.test(content) || pattern.test(context)
    );
  }

  private isShoppingContent(content: string, context: string): boolean {
    const shoppingPatterns = [
      // Context indicators
      /amazon|ebay|shop|store|cart|checkout|product/,
      // Shopping content
      /\$\d+\.\d{2}|price|cost|sale|discount|offer/i,
      /(add to cart|buy now|checkout|purchase)/i,
      /(shipping|delivery|returns?)/i,
      /(in stock|out of stock|available)/i,
      /\d+\s+stars?|\d+\/5|review/i,
      /(brand|model|size|color|quantity)/i,
    ];

    return shoppingPatterns.some(
      (pattern) => pattern.test(content) || pattern.test(context)
    );
  }

  private createTemplateEnhancement(
    content: string,
    contentType: string
  ): string {
    const cleanedContent = this.cleanAndFormatContent(content, contentType);

    // For chat content (especially Slack), return a cleaner format
    if (contentType === "chat" || contentType === "slack") {
      return cleanedContent;
    }

    return `${cleanedContent}`;
  }

  private cleanAndFormatContent(content: string, contentType: string): string {
    let cleaned = content.trim();

    // Apply content-type specific cleaning
    switch (contentType) {
      case "linkedin":
        cleaned = this.cleanLinkedInContent(cleaned);
        break;
      case "email":
        cleaned = this.cleanEmailContent(cleaned);
        break;
      case "code":
        cleaned = this.cleanCodeContent(cleaned);
        break;
      case "slack":
      case "chat":
        cleaned = this.cleanChatContent(cleaned);
        break;
      case "article":
        cleaned = this.cleanArticleContent(cleaned);
        break;
      case "documentation":
        cleaned = this.cleanDocumentationContent(cleaned);
        break;
      default:
        cleaned = this.cleanGeneralContent(cleaned);
    }

    return cleaned;
  }

  private cleanLinkedInContent(content: string): string {
    return content
      .replace(/^\d+,?\d*\s*(followers?|connections?)/gm, "")
      .replace(/Contact info|View.*profile|Show all \d+/g, "")
      .replace(/^\d+(st|nd|rd|th)\s+degree.*/gm, "")
      .replace(/Followed by.*and \d+ other.*/g, "")
      .replace(/You are on the messaging overlay.*/g, "")
      .replace(/• \d+\w+.*Premium.*\d+\w+.*/g, "")
      .replace(/^\d+h • .*hours? ago.*LinkedIn.*/gm, "")
      .split("\n")
      .filter((line) => line.trim().length > 5)
      .join("\n")
      .trim();
  }

  private cleanEmailContent(content: string): string {
    const lines = content.split("\n");
    const cleanedLines: string[] = [];
    let currentEmail: {
      sender?: string;
      timestamp?: string;
      content: string[];
    } = { content: [] };
    let emails: Array<{
      sender?: string;
      timestamp?: string;
      content: string[];
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Skip completely empty lines
      if (!line) {
        if (currentEmail.content.length > 0) {
          currentEmail.content.push("");
        }
        continue;
      }

      // Remove common email artifacts
      if (
        line.match(/^>+\s*$/) || // Empty quote lines
        line.match(/^-{3,}.*$/) || // Dividers
        line.match(/This email was sent to/i) ||
        line.match(/Unsubscribe|Privacy Policy/i) ||
        line.match(/Sent from my (iPhone|Android|Mobile)/i) ||
        line.match(/^\d+\s+Attachments?$/i) ||
        line.match(/Scanned by Gmail/i) ||
        line.match(/^\s*Attachments?\s*$/i) ||
        line.match(/^•\s*$/i) ||
        line.match(/^\s*\d+\s*(attachment|file)s?\s*$/i)
      ) {
        continue;
      }

      // Detect new email in thread (sender with timestamp)
      const emailHeaderMatch = line.match(/^([^<]+(?:<[^>]+>)?)\s*$/);
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
      const timestampMatch =
        nextLine.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Yesterday|Today).*/i) ||
        nextLine.match(/^\w+,\s+\w+\s+\d+,?\s+\d+:\d+\s*(AM|PM)/i);

      if (emailHeaderMatch && timestampMatch) {
        // Save previous email if it has content
        if (currentEmail.content.length > 0) {
          emails.push({ ...currentEmail });
        }

        // Start new email
        currentEmail = {
          sender: emailHeaderMatch[1].trim(),
          timestamp: timestampMatch[0],
          content: [],
        };

        i++; // Skip the timestamp line since we've processed it
        continue;
      }

      // Remove email quote markers but preserve structure
      line = line.replace(/^>+\s*/, "");

      // Skip lines that are just "to" lines without meaningful content after sender detection
      if (line.match(/^to\s+\w+\s*$/i) && currentEmail.sender) {
        continue;
      }

      // Clean up common patterns
      line = line.replace(/^\s*\•\s*/, ""); // Remove bullet points from attachments

      // Add meaningful content
      if (line.length > 0) {
        currentEmail.content.push(line);
      }
    }

    // Add the last email
    if (currentEmail.content.length > 0) {
      emails.push(currentEmail);
    }

    // Format the cleaned emails
    return this.formatEmailThread(emails);
  }

  private formatEmailThread(
    emails: Array<{ sender?: string; timestamp?: string; content: string[] }>
  ): string {
    if (emails.length === 0) {
      return "";
    }

    const formattedEmails = emails
      .map((email, index) => {
        let emailText = "";

        // Add sender and timestamp header
        if (email.sender && email.timestamp) {
          emailText += `### ${email.sender}\n`;
          emailText += `*${email.timestamp}*\n\n`;
        } else if (email.sender) {
          emailText += `### ${email.sender}\n\n`;
        }

        // Clean and format email content
        const cleanContent = email.content
          .join("\n")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => {
            // Filter out remaining noise
            return (
              line.length > 0 &&
              !line.match(
                /^(Best,?|Best regards,?|Thanks,?|Thank you,?|Sincerely,?|Cheers,?)$/i
              ) &&
              !line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s*$/) && // Just names
              !line.match(/^\w+@\w+\.\w+\s*$/) && // Just email addresses
              !line.match(/^Pitch Link\s*$/)
            ); // Remove "Pitch Link" artifacts
          })
          .join("\n")
          .trim();

        // Add the main content
        if (cleanContent) {
          emailText += cleanContent;

          // Add signature/closing if it exists and is meaningful
          const lastLines = email.content.slice(-3).join(" ").trim();
          const closingMatch = lastLines.match(
            /(Best regards?|Thanks?|Thank you|Sincerely|Cheers),?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/i
          );
          if (closingMatch && !cleanContent.includes(closingMatch[0])) {
            emailText += `\n\n${closingMatch[1]},\n${closingMatch[2]}`;
          }
        }

        return emailText;
      })
      .filter((email) => email.trim().length > 0);

    return formattedEmails.join("\n\n---\n\n");
  }

  private cleanChatContent(content: string): string {
    const lines = content.split("\n");
    const context = this.lastWindowInfo?.app?.toLowerCase() || "";

    // Use specialized Slack cleaning if detected
    if (context.includes("slack") || this.isSlackContent(content)) {
      return this.cleanSlackContent(lines);
    }

    // Generic chat cleaning for other platforms
    return this.cleanGenericChatContent(lines);
  }

  private isSlackContent(content: string): boolean {
    return /joined #[\w-]+\.|:\w+:|^\w+\s+\d{1,2}:\d{2}\s+(AM|PM)|:white_check_mark:|:raised_hands:/m.test(
      content
    );
  }

  private cleanSlackContent(lines: string[]): string {
    const messages: Array<{
      user: string;
      content: string[];
      timestamp?: string;
      reactions?: string[];
    }> = [];

    let currentMessage: any = null;
    let i = 0;

    while (i < lines.length) {
      let line = lines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      // Skip system messages and noise, but be more selective about timestamps
      if (line.match(/^(joined|left) #[\w-]+\.?$/i) || 
          line.match(/^\s*\d+\s*$/) || // Pure numbers (reaction counts)
          line.match(/^:\w+:$/) || // Standalone emoji codes
          line.match(/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]+\s*$/u) || // Pure emoji
          line.match(/^(AM|PM)$/i) || // Standalone time indicators
          line.match(/^#[\w-]+$/)) { // Channel names only
        i++;
        continue;
      }
      
      // Only skip standalone timestamps if they're not part of a message structure
      if (line.match(/^\d{1,2}:\d{2}\s*(AM|PM)?$/i)) {
        // Check if this might be a timestamp for the next message
        const nextLineIndex = i + 1;
        const hasContentAfter = nextLineIndex < lines.length && 
                               lines[nextLineIndex].trim().length > 0 &&
                               !lines[nextLineIndex].trim().match(/^[a-zA-Z][a-zA-Z0-9._-]*\d*$/) &&
                               !lines[nextLineIndex].trim().match(/^\d{1,2}:\d{2}\s*(AM|PM)?$/i);
        
        // Only skip if it's truly standalone (no meaningful content follows)
        if (!hasContentAfter) {
          i++;
          continue;
        }
      }

      // Detect new message with username and timestamp pattern
      const userTimestampMatch = line.match(
        /^([a-zA-Z][a-zA-Z0-9._-]*\d*)\s+(\d{1,2}:\d{2}\s*(AM|PM))$/i
      );
      if (userTimestampMatch) {
        // Save previous message if exists
        if (currentMessage && currentMessage.content.length > 0) {
          messages.push(currentMessage);
        }

        // Start new message
        currentMessage = {
          user: userTimestampMatch[1],
          timestamp: userTimestampMatch[2],
          content: [],
          reactions: [],
        };
        i++;
        continue;
      }

      // Detect standalone username (for cases where timestamp is separate or different format)
      const usernameMatch = line.match(/^([a-zA-Z][a-zA-Z0-9._-]*\d*)$/);
      if (usernameMatch) {
        let timestamp = undefined;
        let skipLines = 1;
        
        // Look ahead for timestamp and message content
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const timeMatch = nextLine.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i);
          
          if (timeMatch) {
            timestamp = timeMatch[0];
            skipLines = 2;
          }
          
          // Check if there's content after the timestamp or directly after username
          const contentLineIndex = timestamp ? i + 2 : i + 1;
          const hasContent = contentLineIndex < lines.length && 
                           lines[contentLineIndex].trim().length > 0 &&
                           !lines[contentLineIndex].trim().match(/^[a-zA-Z][a-zA-Z0-9._-]*\d*$/) &&
                           !lines[contentLineIndex].trim().match(/^\d{1,2}:\d{2}\s*(AM|PM)?$/i);
          
          if (hasContent || timestamp) {
            // Save previous message if exists
            if (currentMessage && currentMessage.content.length > 0) {
              messages.push(currentMessage);
            }

            // Start new message
            currentMessage = {
              user: usernameMatch[1],
              timestamp: timestamp,
              content: [],
              reactions: [],
            };
            i += skipLines;
            continue;
          }
        }
      }

      // Handle reactions (emoji patterns and counts)
      const reactionMatch = line.match(/^:[\w_]+:\s*\d*$/);
      if (reactionMatch && currentMessage) {
        const cleanReaction = line.replace(/\s*\d+$/, "").trim();
        if (cleanReaction.length > 0) {
          currentMessage.reactions.push(cleanReaction);
        }
        i++;
        continue;
      }

      // Handle emoji reactions with counts
      if (
        line.match(
          /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]+\s*\d*$/u
        )
      ) {
        if (currentMessage) {
          currentMessage.reactions.push(line.replace(/\s*\d+$/, "").trim());
        }
        i++;
        continue;
      }

      // Regular message content
      if (currentMessage) {
        // Only strip leading timestamps if the line starts with a timestamp followed by more content
        const timestampAtStart = line.match(/^(\d{1,2}:\d{2}\s*(AM|PM)?)\s+(.+)$/i);
        if (timestampAtStart && timestampAtStart[3]) {
          // Only remove if we already have a timestamp for this message
          if (currentMessage.timestamp) {
            line = timestampAtStart[3];
          }
        }

        if (line.length > 0) {
          currentMessage.content.push(line);
        }
      } else {
        // Create message for unattributed content if it looks substantial
        if (
          line.length > 5 &&
          !line.match(/^(typing|online|offline|away|busy)$/i) &&
          !line.match(/^[a-zA-Z][a-zA-Z0-9._-]*\d*$/) // Not just a username
        ) {
          currentMessage = {
            user: "",
            content: [line],
            reactions: [],
          };
        }
      }

      i++;
    }

    // Add final message
    if (currentMessage && currentMessage.content.length > 0) {
      messages.push(currentMessage);
    }

    return this.formatSlackMessages(messages);
  }

  private formatSlackMessages(
    messages: Array<{
      user: string;
      content: string[];
      timestamp?: string;
      reactions?: string[];
    }>
  ): string {
    const formatted = messages
      .map((msg) => {
        let result = "";

        // Add user header with timestamp if available
        if (msg.user) {
          if (msg.timestamp) {
            result += `${msg.user} ${msg.timestamp}: `;
          } else {
            result += `${msg.user}: `;
          }
        }

        // Add message content on same line
        const content = msg.content.join(" ").replace(/\s+/g, " ").trim();
        if (content) {
          result += content;
        }

        // Add reactions on same line if any (simplified format)
        if (msg.reactions && msg.reactions.length > 0) {
          const uniqueReactions = [...new Set(msg.reactions)];
          const cleanReactions = uniqueReactions
            .map(reaction => reaction.replace(/^:/, '').replace(/:$/, ''))
            .filter(reaction => reaction.length > 0 && reaction !== 'white_check_mark' && reaction !== 'raised_hands')
            .slice(0, 2); // Limit to 2 reactions max
          
          if (cleanReactions.length > 0) {
            result += ` (${cleanReactions.join(', ')})`;
          }
        }

        return result;
      })
      .filter((msg) => msg.trim().length > 0);

    return formatted.join("\n");
  }

  private cleanGenericChatContent(lines: string[]): string {
    const cleanedLines: string[] = [];
    let lastSpeaker = "";

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Skip empty lines and common chat noise
      if (
        !line ||
        // System messages
        line.match(/^(joined|left) the (chat|channel|room|conversation)/i) ||
        line.match(/^(added|removed) .* (to|from) the/i) ||
        line.match(/^(call|video|voice) (started|ended|missed)/i) ||
        line.match(/^.* (is|was) (online|offline|away|busy)/i) ||
        // UI elements
        line.match(/^(typing|online|offline|last seen)/i) ||
        line.match(/^(read|delivered|sent)$/i) ||
        line.match(/^(react|reply|forward|delete)$/i) ||
        // Timestamps only
        line.match(/^\d{1,2}:\d{2}\s*(am|pm)?$/i) ||
        line.match(/^(yesterday|today|now)$/i) ||
        // Navigation/UI
        line.match(/^(back|close|menu|settings)$/i) ||
        // Empty reactions
        line.match(/^[👍👎❤️😂😮😢😡]+$/) ||
        // Status indicators
        line.match(/^\d+\s*(unread|new)/) ||
        // Common duplicated elements
        line.match(/^(forwarded message|forwarded from)/i)
      ) {
        continue;
      }

      // Clean up message formatting
      // Remove timestamp patterns from messages
      line = line.replace(/^\d{1,2}:\d{2}\s*(am|pm)?\s*/i, "");
      line = line.replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?$/, "");

      // Remove "You:" or "Me:" patterns and normalize
      line = line.replace(/^(you|me):\s*/i, "You: ");

      // Detect speaker changes and format appropriately
      const speakerMatch = line.match(/^(\w+(?:\s+\w+)?):\s*/);
      if (speakerMatch) {
        const currentSpeaker = speakerMatch[1];
        const message = line.substring(speakerMatch[0].length).trim();

        // Only include the speaker name if it's different from the last one
        if (currentSpeaker !== lastSpeaker && message.length > 0) {
          cleanedLines.push(`${currentSpeaker}: ${message}`);
          lastSpeaker = currentSpeaker;
        } else if (message.length > 0) {
          // Continue previous speaker's message
          cleanedLines.push(`   ${message}`);
        }
      } else if (line.length > 0) {
        // No speaker detected, but has content
        if (lastSpeaker) {
          // Continue previous speaker's message
          cleanedLines.push(`   ${line}`);
        } else {
          // Standalone message
          cleanedLines.push(line);
        }
      }
    }

    // Post-processing: merge consecutive lines from the same speaker
    const finalLines: string[] = [];
    for (let i = 0; i < cleanedLines.length; i++) {
      const line = cleanedLines[i];

      // If this line starts with spaces (continuation), try to merge with previous
      if (line.startsWith("   ") && finalLines.length > 0) {
        const content = line.substring(3);
        if (content.length > 0) {
          finalLines[finalLines.length - 1] += ` ${content}`;
        }
      } else {
        finalLines.push(line);
      }
    }

    return finalLines
      .filter((line) => line.trim().length > 2) // Remove very short lines
      .join("\n")
      .trim();
  }

  private cleanCodeContent(content: string): string {
    // Keep code formatting but remove excessive whitespace
    return content
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "") // Remove trailing whitespace
      .trim();
  }

  private cleanArticleContent(content: string): string {
    return content
      .replace(/^Share this article.*/gim, "")
      .replace(/^Subscribe to.*/gim, "")
      .replace(/^\d+\s+(min|minute)s?\s+read.*/gim, "")
      .replace(/^Tags?:.*/gim, "")
      .replace(/^Categories?:.*/gim, "")
      .trim();
  }

  private cleanDocumentationContent(content: string): string {
    // Preserve markdown formatting but clean up navigation
    return content
      .replace(/^Table of Contents.*/gim, "")
      .replace(/^Edit this page.*/gim, "")
      .replace(/^Last updated:.*/gim, "")
      .trim();
  }

  private cleanGeneralContent(content: string): string {
    const lines = content.split("\n");
    const cleanedLines: string[] = [];

    for (let line of lines) {
      line = line.trim();

      // Skip empty lines and common UI noise
      if (
        !line ||
        // UI button text
        line.match(
          /^(OK|Cancel|Apply|Close|Save|Open|Copy|Paste|Submit|Back|Next|Done|Finish)$/i
        ) ||
        // Loading/status messages
        line.match(/^(Loading|Please wait|Processing)\.{0,3}$/i) ||
        // Social media noise
        line.match(
          /^\s*\d+\s*(likes?|comments?|shares?|views?|followers?|following)\s*$/i
        ) ||
        line.match(/^(like|comment|share|follow|unfollow)$/i) ||
        // Navigation elements
        line.match(
          /^(home|profile|settings|notifications|messages|search)$/i
        ) ||
        // Time-only stamps
        line.match(/^\d{1,2}:\d{2}\s*(am|pm)?$/i) ||
        line.match(/^(yesterday|today|now|\d+[hmsdw]\s+ago)$/i) ||
        // Generic single words that are likely UI
        line.match(
          /^(more|less|show|hide|expand|collapse|edit|delete|remove)$/i
        ) ||
        // Placeholder text
        line.match(/^(untitled|unnamed|no title|click here|tap here)$/i) ||
        // Status indicators
        line.match(/^(online|offline|away|busy|active|inactive)$/i) ||
        // Very short or nonsensical content
        line.length < 3 ||
        // Repetitive characters (likely formatting)
        line.match(/^(.)\1{4,}$/) ||
        // Common error messages
        line.match(/^(error|failed|success|done|complete)$/i)
      ) {
        continue;
      }

      // Clean up remaining content
      // Remove excessive punctuation
      line = line.replace(/\.{3,}/g, "...");
      line = line.replace(/!{2,}/g, "!");
      line = line.replace(/\?{2,}/g, "?");

      // Remove standalone timestamps within content
      line = line.replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?\s*$/, "");
      line = line.replace(/^\d{1,2}:\d{2}\s*(am|pm)?\s+/, "");

      // Remove common social media artifacts
      line = line.replace(/\b(via|RT|retweet|retweeted)\b/gi, "");

      // If line still has meaningful content, keep it
      if (line.trim().length > 2) {
        cleanedLines.push(line.trim());
      }
    }

    // Remove duplicate consecutive lines
    const deduplicatedLines: string[] = [];
    for (let i = 0; i < cleanedLines.length; i++) {
      if (i === 0 || cleanedLines[i] !== cleanedLines[i - 1]) {
        deduplicatedLines.push(cleanedLines[i]);
      }
    }

    return deduplicatedLines.join("\n").trim();
  }

  private assessContentQuality(content: string): string {
    const words = content.split(/\s+/).length;
    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 10).length;
    const avgWordsPerSentence = sentences > 0 ? words / sentences : words;

    // Check if it's an email thread
    const emailCount = (content.match(/###\s+[\w\s]+\n\*/g) || []).length;

    if (emailCount > 1) {
      return `Email Thread (${emailCount} messages)`;
    }

    if (words < 10) return "Brief";
    if (words < 50) return "Short";
    if (words < 200) return "Medium";
    if (avgWordsPerSentence > 25) return "Complex";
    return "Detailed";
  }



  private async openSmartCopyUI(): Promise<void> {
    if (!this.mainWindow) {
      console.log("⚠️ Cannot open UI - main window not available");
      return;
    }

    if (!this.lastCopiedContent || !this.lastWindowInfo) {
      console.log("⚠️ Cannot open UI - missing content data");
      return;
    }

    // Show and focus the main window
    this.mainWindow.show();
    this.mainWindow.focus();
    this.mainWindow.moveTop();

    // Generate formatted content
    const formattedContent = await this.enhanceContent(this.lastCopiedContent, this.lastWindowInfo);

    // Send both options to the UI
    this.mainWindow.webContents.send("show-content-options", {
      source: `${this.lastWindowInfo.app} - ${this.lastWindowInfo.title}`,
      contentType: this.detectContentType(this.lastCopiedContent, this.lastWindowInfo),
      original: {
        content: this.lastCopiedContent,
        length: this.lastCopiedContent.length,
        preview:
          this.lastCopiedContent.substring(0, 150) +
          (this.lastCopiedContent.length > 150 ? "..." : ""),
      },
      formatted: {
        content: formattedContent,
        length: formattedContent.length,
        preview: this.extractPreviewFromFormatted(formattedContent),
      },
    });

    console.log("🎨 Smart copy UI opened from hotkey");
  }

  private extractPreviewFromFormatted(formattedContent: string): string {
    // Extract the cleaned content section for preview
    const contentMatch = formattedContent.match(
      /## Smart-Filtered Content:\n([\s\S]*?)(?=\n## |$)/
    );
    if (contentMatch && contentMatch[1]) {
      const cleanedContent = contentMatch[1].trim();
      return (
        cleanedContent.substring(0, 150) +
        (cleanedContent.length > 150 ? "..." : "")
      );
    }
    return (
      formattedContent.substring(0, 150) +
      (formattedContent.length > 150 ? "..." : "")
    );
  }


  // Configuration methods
  updateConfig(newConfig: Partial<ClipboardWatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ClipboardWatchConfig {
    return { ...this.config };
  }

  // Handle user choice from UI
  async handleContentChoice(
    choice: "original" | "formatted" | "both"
  ): Promise<void> {
    try {
      if (!this.lastCopiedContent || !this.lastWindowInfo) {
        throw new Error("No content available");
      }

      switch (choice) {
        case "original":
          // Original is already in clipboard, just acknowledge
          console.log("👤 User chose original content");
          break;

        case "formatted":
          const formattedContent = await this.enhanceContent(
            this.lastCopiedContent,
            this.lastWindowInfo
          );
          await clipboardy.write(formattedContent);
          console.log("✨ User chose formatted content");
          break;

        case "both":
          const formattedForBoth = await this.enhanceContent(
            this.lastCopiedContent,
            this.lastWindowInfo
          );
          const combined = `${this.lastCopiedContent}\n\n---\n\n${formattedForBoth}`;
          await clipboardy.write(combined);
          console.log("📋 User chose both contents combined");
          break;
      }

      // Hide the main window after choice
      if (this.mainWindow) {
        this.mainWindow.hide();
      }
    } catch (error) {
      console.error("❌ Failed to handle content choice:", error);
    }
  }

  // Hide the main window (utility method)
  hideWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }
}
