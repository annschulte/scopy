import { app } from "electron";
import { join } from "path";
import { writeFileSync, readFileSync, existsSync } from "fs";

export interface scopyyConfig {
  filtering: {
    enableSmartFiltering: boolean;
    sensitivityLevel: "low" | "medium" | "high";
    minContentLength: number;
    maxContentLength: number;
  };
  hotkey: {
    combination: string;
  };
  ui: {
    showNotifications: boolean;
    autoHideDelay: number;
  };
}

const DEFAULT_CONFIG: scopyyConfig = {
  filtering: {
    enableSmartFiltering: true,
    sensitivityLevel: "medium",
    minContentLength: 20,
    maxContentLength: 50000,
  },
  hotkey: {
    combination: "CommandOrControl+Alt+C",
  },
  ui: {
    showNotifications: true,
    autoHideDelay: 3000,
  },
};

export class ConfigManager {
  private configPath: string;
  private config: scopyyConfig;

  constructor() {
    this.configPath = join(app.getPath("userData"), "scopy-config.json");
    this.config = this.loadConfig();
  }

  private loadConfig(): scopyyConfig {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, "utf-8");
        const loadedConfig = JSON.parse(configData);
        // Merge with defaults to handle new config keys
        return { ...DEFAULT_CONFIG, ...loadedConfig };
      }
    } catch (error) {
      console.log("Config load failed, using defaults:", error);
    }

    // Save default config
    this.saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  private saveConfig(config: scopyyConfig): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  }

  getConfig(): scopyyConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<scopyyConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  // Specific getters for common use cases
  getFilteringConfig() {
    return this.config.filtering;
  }

  getHotkeyConfig() {
    return this.config.hotkey;
  }

  isSmartFilteringEnabled(): boolean {
    return this.config.filtering.enableSmartFiltering;
  }

  getSensitivityLevel(): "low" | "medium" | "high" {
    return this.config.filtering.sensitivityLevel;
  }

  getContentLengthLimits(): { min: number; max: number } {
    return {
      min: this.config.filtering.minContentLength,
      max: this.config.filtering.maxContentLength,
    };
  }
}
