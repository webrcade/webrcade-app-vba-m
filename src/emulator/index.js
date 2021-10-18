import {
  AppWrapper,
  DisplayLoop,
  CIDS,
  LOG  
} from "@webrcade/app-common"

import { VbaGraphics } from "./vbagraphics"
import { VbaInterface } from './vbainterface'

export class Emulator extends AppWrapper {
  constructor(app, rotValue, debug = false, 
    flashSize = -1, saveType = -1, rtc = false, mirroring = false) {    
    super(app, debug);

    this.vba = null;
    this.romBytes = null;
    this.romMd5 = null;
    this.romName = null;
    this.vbaInterface = null;
    this.vbaGraphics = null;
    this.controllerState = 0;
    this.rotValue = rotValue;
    this.flashSize = flashSize;
    this.saveType = saveType;
    this.rtc = rtc;
    this.mirroring = mirroring;
    this.saveStatePath = null;
    this.checkSaves = false;
  }

  setRom(name, bytes, md5) {
    if (bytes.byteLength === 0) {
      throw new Error("The size is invalid (0 bytes).");
    }
    this.romName = name;
    this.romMd5 = md5;
    this.romBytes = new Uint8Array(bytes);    

    LOG.info('name: ' + this.romName);
    LOG.info('md5: ' + this.romMd5);
  }

  async onShowPauseMenu() {
    await this.saveState();
  }

  pollControls() {
    const { controllers, rotValue } = this;
    
    controllers.poll();

    if (controllers.isControlDown(0, CIDS.ESCAPE)) {
      if (this.pause(true)) {
        controllers.waitUntilControlReleased(0, CIDS.ESCAPE)
          .then(() => this.showPauseMenu());
        return;
      }
    }

    let input = 0;
    if (controllers.isControlDown(0, CIDS.UP)) {
      switch(rotValue) {
        case 0:
          input |= 64;
          break;
        case 1:
          input |= 32;
          break;
        case 2:
          input |= 128;
          break;
        case 3:
          input |= 16;
          break;
        default:
          break;
      }      
    }
    else if (controllers.isControlDown(0, CIDS.DOWN)) {
      switch(rotValue) {
        case 0:
          input |= 128;
          break;
        case 1:
          input |= 16;
          break;
        case 2:
          input |= 64;
          break;
        case 3:
          input |= 32;
          break;
        default:
          break;  
      }              
    }
    if (controllers.isControlDown(0, CIDS.RIGHT)) {
      switch(rotValue) {
        case 0:
          input |= 16;
          break;
        case 1:
          input |= 64;
          break;
        case 2:
          input |= 32;
          break;
        case 3:
          input |= 128;
          break;
        default:
          break;  
      }                    
    }
    else if (controllers.isControlDown(0, CIDS.LEFT)) {      
      switch(rotValue) {
        case 0:
          input |= 32;
          break;
        case 1:
          input |= 128;
          break;
        case 2:
          input |= 16;
          break;
        case 3:
          input |= 64;
          break;
        default:
          break;  
      }                    
    }
    if (controllers.isControlDown(0, CIDS.B) || controllers.isControlDown(0, CIDS.X) ) {
      input |= 1;
    }
    if (controllers.isControlDown(0, CIDS.A) || controllers.isControlDown(0, CIDS.Y)) {
      input |= 2;
    }
    if (controllers.isControlDown(0, CIDS.SELECT)) {
      input |= 4;
    }
    if (controllers.isControlDown(0, CIDS.START)) {
      input |= 8;
    }
    if (controllers.isControlDown(0, CIDS.LBUMP)) {
      input |= 512;
    }
    if (controllers.isControlDown(0, CIDS.RBUMP)) {
      input |= 256;
    }

    this.controllerState = input;
  }
                             
  loadEmscriptenModule() {
    const { app } = this;

    window.Module = {
      preRun: [],
      postRun: [],
      onAbort: msg => app.exit(msg),
      onExit: () => app.exit(),
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.src = 'js/emu.js';
      script.async = true;
      script.onload = () => {
        LOG.info('Script loaded.');
        if (window.gbaninja) {
          window.gbaninja.then(vba => {
            this.vba = vba;
            resolve();
          });
        } else {
          reject("An error occurred attempting to load the GBA engine.");
        }
      };
    });
  }

  async loadState() {
    const { saveStatePath, storage, vbaInterface } = this;
    
    // Write the save state (if applicable)
    try {
      // Create the save path (MEM FS)
      const s = await storage.get(saveStatePath);
      if (s) {
        LOG.info('reading sram.');
        vbaInterface.setSaveBuffer(s);
      }
    } catch (e) {
      LOG.error(e);
    } 
  }

  async saveState() {
    const { checkSaves, saveStatePath, started, storage, vbaInterface } = this;
    if (!started || !saveStatePath) {
      return;
    }

    try {
      if (checkSaves && vbaInterface.VBA_get_systemSaveUpdateCounter()) {
        LOG.info('saving sram.');
  
        // Wrate state
        vbaInterface.VBA_emuWriteBattery();
        
        // Store it
        await storage.put(saveStatePath, vbaInterface.getSaveBuffer());
  
        // Reset the storage update counter
        vbaInterface.VBA_reset_systemSaveUpdateCounter();
      }  
    } catch (e) {
      LOG.error(e);
    } 
  }

  GBA_CYCLES_PER_SECOND = 16777216;
  GBA_CYCLES_PER_FRAME = this.GBA_CYCLES_PER_SECOND / 60;

  frame() {
    const { vbaInterface, GBA_CYCLES_PER_SECOND, GBA_CYCLES_PER_FRAME } = this;

    const now = Date.now();
    const elapsed = now - this.lastTime;
    this.lastTime = now;

    let cycles = GBA_CYCLES_PER_FRAME;
    if (elapsed < 50) {
      cycles = GBA_CYCLES_PER_SECOND / (1000 / elapsed);
    } 

    vbaInterface.VBA_do_cycles(cycles);
  }

  async onStart(canvas) {
    const { app, audioProcessor, debug, romBytes, romMd5, vba } = this;

    this.vbaGraphics = new VbaGraphics(vba, canvas);
    this.vbaGraphics.initScreen();
    this.vbaInterface = new VbaInterface(
      vba,
      romBytes,
      this.vbaGraphics,
      () => { return this.controllerState; },
      audioProcessor
    );

    // For callbacks from Emscripten
    window.VBAInterface = this.vbaInterface;
        
    // Load save state
    this.saveStatePath = app.getStoragePath(`${romMd5}/sav`);
    await this.loadState();

    // Create display loop
    this.displayLoop = new DisplayLoop(60, true, debug);

    // Start VBA
    this.vbaInterface.VBA_start(this.flashSize, this.saveType, 
      this.rtc, this.mirroring);

    // Hack to ignore always saving
    setTimeout(() => {
      this.vbaInterface.VBA_reset_systemSaveUpdateCounter();      
      this.checkSaves = true;
    }, 5 * 1000 );    
    
    // Audio configuration    
    const samples = (audioProcessor.getFrequency() / 
      this.displayLoop.getFrequency()) | 0;
    LOG.info("Samples: " + samples);

    // Start the audio processor
    this.audioProcessor.start();

    this.lastTime = Date.now();

    // Start the display loop
    this.displayLoop.start(() => {      
      this.frame();      
      this.pollControls();
    });
  }
}
