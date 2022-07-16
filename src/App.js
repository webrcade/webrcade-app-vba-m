import {
  blobToStr,
  md5,
  romNameScorer,
  settings,
  AppRegistry,
  FetchAppData,
  Resources,
  Unzip,
  UrlUtil,
  WebrcadeApp,
  APP_TYPE_KEYS,
  LOG,
  TEXT_IDS
} from '@webrcade/app-common'
import { Emulator } from './emulator'

import './App.scss';

class App extends WebrcadeApp {
  emulator = null;
  rotValue = 0;
  rotSideways = false;
  isGba = false;

  componentDidMount() {
    super.componentDidMount();

    const { appProps, ModeEnum } = this;

    try {
      // Get the ROM location that was specified
      const rom = appProps.rom;
      if (!rom) throw new Error("A ROM file was not specified.");

      // Get the ROM rotation (if applicable)
      const rot = appProps.rotation;
      if (rot) {
        const rotInt = parseInt(rot);
        if (!isNaN(rotInt)) {
          if ((rotInt % 90) === 0) {
            this.rotValue = (rotInt / 90) % 4;
            if (this.rotValue %2 !== 0) {
              this.rotSideways = true;
            }
          } else {
            LOG.error('rotation value is not a 90 degree value: ' + rot);
          }
        } else {
          LOG.error('rotation value is not a number: ' + rot);
        }
      }

      // Get flash size
      let flashSize = -1;
      const flash = appProps.flashSize;
      if (flash) {
        const flashInt = parseInt(flash);
        if (!isNaN(flashInt)) {
          flashSize = flash;
        } else {
          LOG.error('flashSize value is not a number: ' + flash);
        }
      }

      // Get save type
      let saveType = -1;
      const save = appProps.saveType;
      if (save) {
        const saveInt = parseInt(save);
        if (!isNaN(saveInt)) {
          saveType = save;
        } else {
          LOG.error('saveType value is not a number: ' + save);
        }
      }

      // Get RTC
      const rtc = appProps.rtc !== undefined ? appProps.rtc === true : false;

      // Get Mirroring
      const mirroring = appProps.mirroring !== undefined ? appProps.mirroring === true : false;

      // Get GB hardware type
      const gbHwType = appProps.hwType !== undefined ? parseInt(appProps.hwType) : 0;

      // Get GB colors
      const gbColors = appProps.colors !== undefined ? parseInt(appProps.colors) : 0;

      // Get GB palette
      const gbPalette = appProps.palette !== undefined ? parseInt(appProps.palette) : 0;

      // Get GB border
      const gbBorder = appProps.border !== undefined ? parseInt(appProps.border) : 0;

      // Get the type
      const type = appProps.type;
      if (!type) throw new Error("The application type was not specified.");
      this.isGba = (type === APP_TYPE_KEYS.VBA_M_GBA);

      // Create the emulator
      if (this.emulator === null) {
        this.emulator = new Emulator(
          this,
          this.rotValue,
          this.isDebug(),
          flashSize,
          saveType,
          rtc,
          mirroring
        );
      }

      const { emulator } = this;

      // Determine extensions
      const exts = [
        ...AppRegistry.instance.getExtensions(APP_TYPE_KEYS.VBA_M_GBA, true, false),
        ...AppRegistry.instance.getExtensions(APP_TYPE_KEYS.VBA_M_GB, true, false),
        ...AppRegistry.instance.getExtensions(APP_TYPE_KEYS.VBA_M_GBC, true, false),
      ];
      const extsNotUnique = [
        ...new Set([
          ...AppRegistry.instance.getExtensions(APP_TYPE_KEYS.VBA_M_GBA, true, true),
          ...AppRegistry.instance.getExtensions(APP_TYPE_KEYS.VBA_M_GB, true, true),
          ...AppRegistry.instance.getExtensions(APP_TYPE_KEYS.VBA_M_GBC, true, true),
        ])
      ];
      // Load emscripten and the ROM
      const uz = new Unzip().setDebug(this.isDebug());
      let romBlob = null;
      let romMd5 = null;
      emulator.loadEmscriptenModule()
        .then(() => settings.load())
        // .then(() => settings.setBilinearFilterEnabled(true))
        .then(() => new FetchAppData(rom).fetch())
        .then(response => { LOG.info('downloaded.'); return response.blob() })
        .then(blob => uz.unzip(blob, extsNotUnique, exts, romNameScorer))
        .then(blob => { romBlob = blob; return blob; })
        .then(blob => blobToStr(blob))
        .then(str => { romMd5 = md5(str); })
        .then(() => new Response(romBlob).arrayBuffer())
        .then(bytes => emulator.setRom(
          this.isGba, type, uz.getName() ? uz.getName() : UrlUtil.getFileName(rom),
          bytes, romMd5,
          (type === APP_TYPE_KEYS.VBA_M_GB ? gbHwType : 1),
          gbColors, gbPalette, gbBorder))
        .then(() => this.setState({ mode: ModeEnum.LOADED }))
        .catch(msg => {
          LOG.error(msg);
          this.exit(this.isDebug() ? msg : Resources.getText(TEXT_IDS.ERROR_RETRIEVING_GAME));
        })
    } catch (e) {
      this.exit(e);
    }
  }

  async onPreExit() {
    try {
      await super.onPreExit();
      await this.emulator.saveState();
    } catch (e) {
      LOG.error(e);
    }
  }

  componentDidUpdate() {
    const { mode } = this.state;
    const { canvas, emulator, ModeEnum } = this;

    if (mode === ModeEnum.LOADED) {
      window.focus();
      // Start the emulator
      emulator.start(canvas);
    }
  }

  renderCanvas() {
    const { rotValue, rotSideways } = this;

    let className = "";
    if (rotValue !== 0) {
      className += "rotate" + 90 * rotValue;
    }
    if (rotSideways) {
      if (className.length > 0) {
        className += " ";
      }
      className += "sideways";
    }
    if (!this.isGba) {
      if (className.length > 0) {
        className += " ";
      }
      className += "screen-gb";
    }
    return (
      <canvas style={this.getCanvasStyles()} className={className} ref={canvas => { this.canvas = canvas; }} id="screen"></canvas>
    );
  }

  render() {
    const { mode } = this.state;
    const { ModeEnum } = this;

    return (
      <>
        { super.render()}
        { mode === ModeEnum.LOADING ? this.renderLoading() : null}
        { mode === ModeEnum.PAUSE ? this.renderPauseScreen() : null}
        { mode === ModeEnum.LOADED || mode === ModeEnum.PAUSE  ? this.renderCanvas() : null}
      </>
    );
  }
}

export default App;
