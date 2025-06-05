declare module 'screenshot-desktop' {
  interface ScreenshotOptions {
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }
  
  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  export = screenshot;
}