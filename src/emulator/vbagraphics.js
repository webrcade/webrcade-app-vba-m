class VbaGraphics {

  constructor(isGba, emscriptenModule, canvas, gbBorder) {
    this.isGba = isGba;    
    this.GBA_WIDTH = isGba ? 240 : 
      gbBorder ? 258 : 162; 
    this.GBA_HEIGHT = isGba ? 160 : 
      gbBorder ? 225 : 145;   
    this.gbBorder = gbBorder;

    this.emscriptenModule = emscriptenModule;
    this.canvas = canvas;
    this.pixelCount = this.GBA_WIDTH * this.GBA_HEIGHT;  

    if (gbBorder) {
      this.setGbBorderClass();
    }

    this.display = true;  
  }

  setGbBorderClass() {
    const screen = document.getElementById("screen");
    screen.classList.remove("screen-gb");
    screen.classList.add("screen-gb-border");
  }

  setGbBorderOn() {
    this.display = false;
    this.clearImageData(
      this.image, this.imageData, this.pixelCount, true);    
    this.GBA_WIDTH = 258;
    this.GBA_HEIGHT = 225;
    this.pixelCount = this.GBA_WIDTH * this.GBA_HEIGHT;    
    this.initScreen();    
    setTimeout(() => {       
      this.clearImageData(
        this.image, this.imageData, this.pixelCount, false);      
      this.setGbBorderClass();
      this.display = true; 
    }, 100);
  }

  clearImageData(image, imageData, pixelCount, hidden = false) {
    for (var i = 0; i < (pixelCount * 4);) {
      imageData[i++] = 0x00;
      imageData[i++] = 0x00;
      imageData[i++] = 0x00;
      imageData[i++] = hidden ? 0x00 : 0xFF;
    }
    this.context.putImageData(image, 0, 0);
  }

  initScreen() {
    const { GBA_WIDTH, GBA_HEIGHT } = this;
    this.canvas.width = GBA_WIDTH;
    this.canvas.height = GBA_HEIGHT;

    if (!this.context) {
      this.context = this.canvas.getContext("2d");
    }
    this.image = this.context.getImageData(0, 0, GBA_WIDTH, GBA_HEIGHT);
    this.imageData = this.image.data;
    this.clearImageData(this.image, this.imageData, this.pixelCount, !this.display);

    return true;
  };

  drawGBAFrame(gbaPointer8) {
    if (!this.context || !this.display) return;

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
