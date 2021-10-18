class VbaGraphics {

  constructor(emscriptenModule, canvas) {
    this.emscriptenModule = emscriptenModule;
    this.canvas = canvas;
    this.pixelCount = this.GBA_WIDTH * this.GBA_HEIGHT;
  }

  GBA_WIDTH = 240;
  GBA_HEIGHT = 160;

  initScreen() {
    const { GBA_WIDTH, GBA_HEIGHT } = this;
    this.canvas.width = GBA_WIDTH;
    this.canvas.height = GBA_HEIGHT;
    this.context = this.canvas.getContext("2d");
    this.image = this.context.getImageData(0, 0, GBA_WIDTH, GBA_HEIGHT);
    this.imageData = this.image.data;
    for (var i = 0; i < (this.pixelCount * 4);) {
      this.imageData[i++] = 0xFF;
      this.imageData[i++] = 0xFF;
      this.imageData[i++] = 0xFF;
      this.imageData[i++] = 0xFF;
    }
    return true;
  };

  drawGBAFrame(gbaPointer8) {
    if (!this.context) return;

    var gbaPointer16 = gbaPointer8 / 2;
    var gbaHeap16 = this.emscriptenModule.HEAP16;
    for (var i = 0, j = 0; i < (this.pixelCount * 4);) {
      var c = gbaHeap16[gbaPointer16 + j++];
      this.imageData[i++] = ((((c >> 11) & 0x1f) / 31) * 255) | 0;
      this.imageData[i++] = ((((c >> 6) & 0x1f) / 31) * 255) | 0;
      this.imageData[i++] = ((((c >> 1) & 0x1f) / 31) * 255) | 0;
      i++;
    }
    this.context.putImageData(this.image, 0, 0);
  };

  onResize(/*windowWidth, windowHeight*/) {
    return;
  };
};

export { VbaGraphics };
