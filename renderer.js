const { ipcRenderer } = require("electron");

class scopyyRenderer {
  constructor() {
    this.statusIndicator = document.getElementById("statusIndicator");
    this.statusText = this.statusIndicator?.querySelector(".status-text");
    this.statusDot = this.statusIndicator?.querySelector(".status-dot");

    // Log missing elements for debugging
    if (!this.statusIndicator)
      console.warn("Status indicator element not found");
    if (!this.statusText) console.warn("Status text element not found");
    if (!this.statusDot) console.warn("Status dot element not found");

    // Main content elements
    this.originalContent = document.getElementById("originalContent");
    this.formattedContent = document.getElementById("formattedContent");
    this.originalStats = document.getElementById("originalStats");
    this.formattedStats = document.getElementById("formattedStats");
    this.copyOriginalBtn = document.getElementById("copyOriginalBtn");
    this.copyFormattedBtn = document.getElementById("copyFormattedBtn");

    this.initializeEventListeners();
    this.updateStatus("Ready", "success");
  }

  initializeEventListeners() {
    // Handle clipboard processing results
    ipcRenderer.on("clipboard-processed", (_, data) => {
      this.showContent(data);
    });

    // Handle content options from smart clipboard
    ipcRenderer.on("show-content-options", (_, data) => {
      this.showContentOptions(data);
    });

    // Handle capture errors
    ipcRenderer.on("capture-error", (_, data) => {
      this.handleCaptureError(data);
    });

    // Copy button handlers
    if (this.copyOriginalBtn) {
      this.copyOriginalBtn.addEventListener("click", async () => {
        try {
          const originalText = this.originalContent?.textContent || "";
          await navigator.clipboard.writeText(originalText);
          this.copyOriginalBtn.textContent = "Copied!";
          setTimeout(() => {
            this.copyOriginalBtn.innerHTML =
              '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" /></svg>Copy';
          }, 2000);
        } catch (error) {
          console.error("Failed to copy original:", error);
        }
      });
    }

    if (this.copyFormattedBtn) {
      this.copyFormattedBtn.addEventListener("click", async () => {
        try {
          const formattedText = this.formattedContent?.textContent || "";
          await navigator.clipboard.writeText(formattedText);
          this.copyFormattedBtn.textContent = "Copied!";
          setTimeout(() => {
            this.copyFormattedBtn.innerHTML =
              '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" /></svg>Copy';
          }, 2000);
        } catch (error) {
          console.error("Failed to copy formatted:", error);
        }
      });
    }

    // ESC key to hide window
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideWindow();
      }
    });

    // Click outside to hide (optional)
    document.addEventListener("click", (e) => {
      if (e.target === document.body) {
        this.hideWindow();
      }
    });
  }

  showContent(data) {
    // Clear empty states and show content
    if (this.originalContent && data.original) {
      this.originalContent.textContent = data.original;
    }

    if (this.formattedContent && data.formatted) {
      this.formattedContent.textContent = data.formatted;
    }

    // Update stats
    if (this.originalStats && data.original) {
      this.originalStats.textContent = `${data.original.length} chars`;
    }

    if (this.formattedStats && data.formatted) {
      this.formattedStats.textContent = `${data.formatted.length} chars`;
    }

    this.updateStatus("Content ready", "success");
  }

  showContentOptions(data) {
    // Clear empty states and show content from smart clipboard format
    if (this.originalContent && data.original) {
      this.originalContent.textContent = data.original.content;
      // Remove empty state
      const emptyState = this.originalContent.querySelector(".empty-state");
      if (emptyState) {
        emptyState.style.display = "none";
      }
    }

    if (this.formattedContent && data.formatted) {
      this.formattedContent.textContent = data.formatted.content;
      // Remove empty state
      const emptyState = this.formattedContent.querySelector(".empty-state");
      if (emptyState) {
        emptyState.style.display = "none";
      }
    }

    // Update stats
    if (this.originalStats && data.original) {
      this.originalStats.textContent = `${data.original.length} chars`;
    }

    if (this.formattedStats && data.formatted) {
      this.formattedStats.textContent = `${data.formatted.length} chars`;
    }

    this.updateStatus(`Content from ${data.source}`, "success");
  }

  handleCaptureError(data) {
    this.updateStatus("Error", "error");

    // Show error briefly then return to ready state
    setTimeout(() => {
      this.updateStatus("Ready", "success");
    }, 3000);
  }

  updateStatus(text, type = "success") {
    if (this.statusText) {
      this.statusText.textContent = text;
    }

    if (this.statusDot) {
      this.statusDot.className = "status-dot";
      if (type === "success") {
        this.statusDot.style.background = "var(--accent-green)";
      } else if (type === "warning") {
        this.statusDot.style.background = "var(--accent-yellow)";
      } else if (type === "error") {
        this.statusDot.style.background = "var(--accent-red)";
      }
    }
  }

  async hideWindow() {
    try {
      this.updateStatus("Ready", "success");
      await ipcRenderer.invoke("hide-window");
    } catch (error) {
      console.error("Failed to hide window:", error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new scopyyRenderer();
});
