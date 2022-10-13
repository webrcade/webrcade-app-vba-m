import { LOG } from '@webrcade/app-common';

class VbaInterface {
  constructor(
    rate,
    gbaninja,
    romBuffer8,
    vbaGraphics,
    inputCb,
    audioProcessor,
  ) {
    this.rate = rate;
    this.gbaninja = gbaninja;
    this.romBuffer8 = romBuffer8;
    this.vbaGraphics = vbaGraphics;
    this.inputCb = inputCb;
    this.audioProcessor = audioProcessor;
    this.audioChannels = new Array(2);
    this.saveBuffer = new Uint8Array(0);
    this.debug = false;

    const AUDIO_LENGTH = 8192;
    this.audioChannels[0] = new Array(AUDIO_LENGTH);
    this.audioChannels[1] = new Array(AUDIO_LENGTH);
  }

  setDebug(debug) {
    this.debug = debug;
    return this;
  }

  VBA_get_emulating() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_emulating();
  }

  VBA_start(
    isGba,
    flashSize = -1,
    saveType = -1,
    rtc = false,
    mirroring = false,
    gbHwType = 0,
    gbColors = 0,
    gbPalette,
    gbBorder = 0,
    disableLookup = false
  ) {
    const { gbaninja } = this;
    return gbaninja._VBA_start(
      isGba,
      flashSize,
      saveType,
      rtc ? 1 : 0,
      mirroring ? 1 : 0,
      gbHwType,
      gbColors,
      gbPalette,
      gbBorder,
      disableLookup
    );
  }

  VBA_do_cycles(cycles) {
    const { gbaninja } = this;
    return gbaninja._VBA_do_cycles(cycles);
  }

  VBA_stop() {
    const { gbaninja } = this;
    return gbaninja._VBA_stop();
  }

  VBA_get_bios() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_bios();
  }

  VBA_get_rom() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_rom();
  }

  VBA_get_internalRAM() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_internalRAM();
  }

  VBA_get_workRAM() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_workRAM();
  }

  VBA_get_paletteRAM() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_paletteRAM();
  }

  VBA_get_vram() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_vram();
  }

  VBA_get_pix() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_pix();
  }

  VBA_get_oam() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_oam();
  }

  VBA_get_ioMem() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_ioMem();
  }

  VBA_get_systemColorMap16() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_systemColorMap16();
  }

  VBA_get_systemColorMap32() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_systemColorMap32();
  }

  VBA_get_systemFrameSkip() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_systemFrameSkip();
  }

  VBA_set_systemFrameSkip(n) {
    const { gbaninja } = this;
    return gbaninja._VBA_set_systemFrameSkip(n);
  }

  VBA_get_systemSaveUpdateCounter() {
    const { gbaninja } = this;
    return gbaninja._VBA_get_systemSaveUpdateCounter();
  }

  VBA_reset_systemSaveUpdateCounter() {
    const { gbaninja } = this;
    return gbaninja._VBA_reset_systemSaveUpdateCounter();
  }

  VBA_emuWriteBattery() {
    const { gbaninja } = this;
    return gbaninja._VBA_emuWriteBattery();
  }

  VBA_agbPrintFlush() {
    const { gbaninja } = this;
    return gbaninja._VBA_agbPrintFlush();
  }

  // ------- VBA EXIT POINTS --------

  NYI(feature) {
    console.log('Feature is NYI: ', feature);
  }

  getAudioSampleRate() {
    const { audioProcessor } = this;
    return audioProcessor.getFrequency() * (this.rate / 60);
  }

  getRomSize(startPointer8) {
    const { romBuffer8 } = this;

    return romBuffer8.byteLength;
  }

  copyRomToMemory(startPointer8) {
    const { gbaninja, romBuffer8 } = this;

    var gbaHeap8 = gbaninja.HEAP8;
    var byteLength = romBuffer8.byteLength;
    for (var i = 0; i < byteLength; i++) {
      gbaHeap8[startPointer8 + i] = romBuffer8[i];
    }
  }

  renderFrame(pixPointer8) {
    const { vbaGraphics } = this;
    vbaGraphics.drawGBAFrame(pixPointer8);
  }

  initSound() {}

  pauseSound() {}

  resetSound() {
    //    window.vbaSound.resetSound();
  }

  resumeSound() {}

  start = Date.now();
  sum = 0;
  count = 0;

  hacksum = 0;
  HACKAT = 548;

  writeSound(pointer8, length16) {
    // Horrible hack to work around too many samples
    // coming from emulator.
    // TODO: Fix this the right way in the future.
    this.hacksum += length16 >> 1;
    if (this.hacksum >= this.HACKAT) {
      length16 -= 2;
      this.hacksum %= this.HACKAT;
    }

    if (this.debug) {
      this.sum += length16 >> 1;
      if (Date.now() - this.start > 1000.0) {
        if (this.count % 60 === 0) {
          LOG.info(this.sum / 60 + ', ' + this.count);
          this.sum = 0;
        }
        this.start = Date.now();
        this.count++;
      }
    }

    const { audioProcessor, gbaninja } = this;

    if (pointer8 % 2 === 1) {
      console.error('Audio pointer must be 16 bit aligned.');
      return;
    }
    if (length16 % 2 !== 0) {
      console.error('Number of audio samples must be even.');
      return;
    }

    audioProcessor.storeSoundCombinedInput(
      gbaninja.HEAP16,
      2,
      length16,
      pointer8 >> 1,
      0x4000,
    );
  }

  setThrottleSound(pointer8, length16) {}

  getSaveBuffer() {
    return this.saveBuffer;
  }

  setSaveBuffer(buffer) {
    this.saveBuffer = buffer;
  }

  softCommit(pointer8, size) {
    const { gbaninja } = this;

    var heapu8 = gbaninja.HEAPU8;
    var bufu8 = new Uint8Array(size);
    for (var i = 0; i < size; i++) {
      bufu8[i] = heapu8[pointer8 + i];
    }
    this.saveBuffer = bufu8;
  }

  getSaveSize() {
    return this.saveBuffer.length;
  }

  commitFlash(pointer8, size) {
    this.softCommit(pointer8, size);
  }

  commitEeprom(pointer8, size) {
    this.softCommit(pointer8, size);
  }

  restoreSaveMemory(pointer8, targetBufferSize) {
    const { gbaninja } = this;

    const save = this.saveBuffer;
    if (save.length !== targetBufferSize) {
      console.error('Incompatible save size');
      return false;
    }

    const heap8 = gbaninja.HEAPU8;
    for (let i = 0; i < targetBufferSize; i++) {
      heap8[pointer8 + i] = save[i];
    }

    return true;
  }

  getJoypad(joypadNum) {
    const { inputCb } = this;
    return inputCb();
  }

  dbgOutput(textPointer8, unknownPointer8) {
    return console.log('dbgOutput', textPointer8, unknownPointer8);
  }

  setGbBorderOn() {
    this.vbaGraphics.setGbBorderOn();
  }
}

export { VbaInterface };
