import React from 'react';

import { ControlsTab } from '@webrcade/app-common';

export class GamepadControlsTab extends ControlsTab {
  render() {
    const { type } = this.props;
    return (
      <>
        {type === 'vba-m-gbc' || type === 'vba-m-gb'
          ? [
              this.renderControl('start', 'Start'),
              this.renderControl('select', 'Select'),
              this.renderControl('dpad', 'Move'),
              this.renderControl('lanalog', 'Move'),
              this.renderControl('b', 'A'),
              this.renderControl('x', 'A'),
              this.renderControl('a', 'B'),
              this.renderControl('y', 'B'),
            ]
          : null}
        {type === 'vba-m-gba'
          ? [
              this.renderControl('start', 'Start'),
              this.renderControl('select', 'Select'),
              this.renderControl('dpad', 'Move'),
              this.renderControl('lanalog', 'Move'),
              this.renderControl('b', 'A'),
              this.renderControl('x', 'A'),
              this.renderControl('a', 'B'),
              this.renderControl('y', 'B'),
              this.renderControl('lbump', 'Left Shoulder'),
              this.renderControl('rbump', 'Right Shoulder'),
            ]
          : null}
      </>
    );
  }
}

export class KeyboardControlsTab extends ControlsTab {
  render() {
    const { type } = this.props;
    return (
      <>
        {type === 'vba-m-gbc' || type === 'vba-m-gb'
          ? [
              this.renderKey('Enter', 'Start'),
              this.renderKey('ShiftRight', 'Select'),
              this.renderKey('ArrowUp', 'Up'),
              this.renderKey('ArrowDown', 'Down'),
              this.renderKey('ArrowLeft', 'Left'),
              this.renderKey('ArrowRight', 'Right'),
              this.renderKey('KeyX', 'A'),
              this.renderKey('KeyA', 'A'),
              this.renderKey('KeyZ', 'B'),
              this.renderKey('KeyS', 'B'),
            ]
          : null}
        {type === 'vba-m-gba'
          ? [
              this.renderKey('Enter', 'Start'),
              this.renderKey('ShiftRight', 'Select'),
              this.renderKey('ArrowUp', 'Up'),
              this.renderKey('ArrowDown', 'Down'),
              this.renderKey('ArrowLeft', 'Left'),
              this.renderKey('ArrowRight', 'Right'),
              this.renderKey('KeyX', 'A'),
              this.renderKey('KeyA', 'A'),
              this.renderKey('KeyZ', 'B'),
              this.renderKey('KeyS', 'B'),
              this.renderKey('KeyQ', 'Left Shoulder'),
              this.renderKey('KeyW', 'Right Shoulder'),
            ]
          : null}
      </>
    );
  }
}
