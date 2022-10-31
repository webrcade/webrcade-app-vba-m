import {
  AppWrapper,
  DisplayLoop,
  ScriptAudioProcessor,
  CIDS,
  LOG,
} from '@webrcade/app-common';

import { VbaGraphics } from './vbagraphics';
import { VbaInterface } from './vbainterface';

export class Emulator extends AppWrapper {
  constructor(
    app,
    rotValue,
    debug = false,
    flashSize = -1,
    saveType = -1,
    rtc = false,
    mirroring = false,
    disableLookup = false
  ) {
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
    this.isGba = false;
    this.type = null;
    this.gbHwType = 0;
    this.gbColors = 0;
    this.gbPalette = 0;
    this.gbBorder = 0;
    this.disableLookup = disableLookup;
  }

  FPS = 59.7275;
  SRAM_FILE = '/tmp/game.srm';
  SAVE_NAME = 'sav';

  createAudioProcessor() {
    return new ScriptAudioProcessor(2, 48000).setDebug(this.debug);
  }

  setRom(
    isGba,
    type,
    name,
    bytes,
    md5,
    gbHwType,
    gbColors,
    gbPalette,
    gbBorder,
  ) {
    this.type = type;
    if (bytes.byteLength === 0) {
      throw new Error('The size is invalid (0 bytes).');
    }

    this.isGba = isGba;
    this.gbHwType = gbHwType;
    this.gbColors = gbColors;
    this.gbPalette = gbPalette;
    this.gbBorder = gbBorder;

    this.GBA_CYCLES_PER_SECOND = isGba ? 16777216 : 4194304;
    this.GBA_CYCLES_PER_FRAME = this.GBA_CYCLES_PER_SECOND / this.FPS /*60*/;

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
        controllers
          .waitUntilControlReleased(0, CIDS.ESCAPE)
          .then(() => this.showPauseMenu());
        return;
      }
    }

    let input = 0;
    if (controllers.isControlDown(0, CIDS.UP)) {
      switch (rotValue) {
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
    } else if (controllers.isControlDown(0, CIDS.DOWN)) {
      switch (rotValue) {
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
      switch (rotValue) {
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
    } else if (controllers.isControlDown(0, CIDS.LEFT)) {
      switch (rotValue) {
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
    if (
      controllers.isControlDown(0, CIDS.B) ||
      controllers.isControlDown(0, CIDS.X)
    ) {
      input |= 1;
    }
    if (
      controllers.isControlDown(0, CIDS.A) ||
      controllers.isControlDown(0, CIDS.Y)
    ) {
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
      onAbort: (msg) => app.exit(msg),
      onExit: () => app.exit(),
    };

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.src = 'js/emu.js';
      script.async = true;
      script.onload = () => {
        LOG.info('Script loaded.');
        if (window.gbaninja) {
          window.gbaninja.then((vba) => {
            this.vba = vba;
            window.vba = vba;
            resolve();
          });
        } else {
          reject('An error occurred attempting to load the GBA engine.');
        }
      };
    });
  }

  async migrateSaves() {
    const { saveStatePath, storage, SAVE_NAME } = this;

    // Load old saves (if applicable)
    const sram = await storage.get(saveStatePath);

    if (sram) {
      LOG.info('Migrating local saves.');

      await this.getSaveManager().saveLocal(saveStatePath, [
        {
          name: SAVE_NAME,
          content: sram,
        },
      ]);

      // Delete old location (and info)
      await storage.remove(saveStatePath);
      await storage.remove(`${saveStatePath}/info`);
    }
  }

  async loadState() {
    const { isGba, saveStatePath, vbaInterface, SAVE_NAME, SRAM_FILE } = this;

    // Write the save state (if applicable)
    try {
      // Migrate old save format
      await this.migrateSaves();

      // Load from new save format
      const files = await this.getSaveManager().load(
        saveStatePath,
        this.loadMessageCallback,
      );

      let s = null;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f.name === SAVE_NAME) {
            s = f.content;
            break;
          }
        }

        // Cache the initial files
        await this.getSaveManager().checkFilesChanged(files);
      }

      if (s) {
        LOG.info('reading sram.');
        if (isGba) {
          vbaInterface.setSaveBuffer(s);
        } else {
          // GB/GBC uses the file system
          // Create the save path (MEM FS)
          const FS = this.vba.FS;
          const res = FS.analyzePath(SRAM_FILE, true);
          if (!res.exists) {
            if (s) {
              FS.writeFile(SRAM_FILE, s);
            }
          }
        }
      }
    } catch (e) {
      LOG.error('Error loading save state: ' + e);
    }
  }

  async saveInOldFormat(s) {
    const { saveStatePath } = this;
    // old, for testing migration
    await this.saveStateToStorage(saveStatePath, s);
  }

  async saveInNewFormat(s) {
    const { saveStatePath, SAVE_NAME } = this;

    const files = [
      {
        name: SAVE_NAME,
        content: s,
      },
    ];

    if (await this.getSaveManager().checkFilesChanged(files)) {
      await this.getSaveManager().save(
        saveStatePath,
        files,
        this.saveMessageCallback,
      );
    }
  }

  async saveState() {
    const {
      checkSaves,
      isGba,
      saveStatePath,
      started,
      vbaInterface,
      SRAM_FILE,
    } = this;
    if (!started || !saveStatePath) {
      return;
    }

    try {
      if (checkSaves && vbaInterface.VBA_get_systemSaveUpdateCounter()) {
        LOG.info('saving sram.');
        LOG.info(saveStatePath);

        // Write state
        vbaInterface.VBA_emuWriteBattery();

        // Store it
        if (isGba) {
          //await this.saveInOldFormat(vbaInterface.getSaveBuffer());
          await this.saveInNewFormat(vbaInterface.getSaveBuffer());
        } else {
          // GB/GBC uses the file system
          const FS = this.vba.FS;
          const res = FS.analyzePath(SRAM_FILE, true);
          if (res.exists) {
            const s = FS.readFile(SRAM_FILE);
            if (s) {
              //await this.saveInOldFormat(s);
              await this.saveInNewFormat(s);
              LOG.info('sram saved: ' + s.length);
            }
          }
        }

        // Reset the storage update counter
        vbaInterface.VBA_reset_systemSaveUpdateCounter();
      }
    } catch (e) {
      LOG.error(e);
    }
  }

  frame() {
    const { vbaInterface, GBA_CYCLES_PER_FRAME } = this;
    vbaInterface.VBA_do_cycles(GBA_CYCLES_PER_FRAME);
  }

  async onStart(canvas) {
    const {
      app,
      audioProcessor,
      debug,
      gbBorder,
      isGba,
      romBytes,
      romMd5,
      vba,
    } = this;

    this.vbaGraphics = new VbaGraphics(isGba, vba, canvas, gbBorder === 1);
    this.vbaGraphics.initScreen();
    this.vbaInterface = new VbaInterface(
      this.FPS,
      vba,
      romBytes,
      this.vbaGraphics,
      () => {
        return this.controllerState;
      },
      audioProcessor,
    ).setDebug(this.debug);

    // For callbacks from Emscripten
    window.VBAInterface = this.vbaInterface;

    // Load save state
    this.saveStatePath = app.getStoragePath(`${romMd5}/sav`);
    await this.loadState();

    // Create display loop
    this.displayLoop = new DisplayLoop(60, true, debug);

    // Start VBA
    this.vbaInterface.VBA_start(
      isGba ? 1 : 0, // isGba
      this.flashSize,
      this.saveType,
      this.rtc,
      this.mirroring,
      this.gbHwType,
      this.gbColors,
      this.gbPalette,
      this.gbBorder,
      this.disableLookup
    );

    // Hack to ignore always saving
    setTimeout(() => {
      this.vbaInterface.VBA_reset_systemSaveUpdateCounter();
      this.checkSaves = true;
    }, 5 * 1000);

    // Start the audio processor
    this.audioProcessor.start();

    this.lastTime = Date.now();

    // Enabled showing messages
    this.setShowMessageEnabled(true);

    // Start the display loop
    this.displayLoop.start(() => {
      this.frame();
      this.pollControls();
    });
  }
}
