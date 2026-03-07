/**
 * Cubase drum map (.drm) parser and default GM drum map.
 */
(function () {
  /** Default GM drum map: note number -> display name */
  const DEFAULT_GM_MAP = {
    35: 'Acoustic Bass Drum',
    36: 'Bass Drum 1',
    37: 'Side Stick',
    38: 'Acoustic Snare',
    39: 'Hand Clap',
    40: 'Electric Snare',
    41: 'Low Floor Tom',
    42: 'Closed Hi-Hat',
    43: 'High Floor Tom',
    44: 'Pedal Hi-Hat',
    45: 'Low Tom',
    46: 'Open Hi-Hat',
    47: 'Low-Mid Tom',
    48: 'Hi-Mid Tom',
    49: 'Crash Cymbal 1',
    50: 'High Tom',
    51: 'Ride Cymbal 1',
    52: 'Chinese Cymbal',
    53: 'Ride Bell',
    54: 'Tambourine',
    55: 'Splash Cymbal',
    56: 'Cowbell',
    57: 'Crash Cymbal 2',
    58: 'Vibraslap',
    59: 'Ride Cymbal 2',
    60: 'Hi Bongo',
    61: 'Low Bongo',
    62: 'Mute Hi Conga',
    63: 'Open Hi Conga',
    64: 'Low Conga',
    65: 'High Timbale',
    66: 'Low Timbale',
    67: 'High Agogo',
    68: 'Low Agogo',
    69: 'Cabasa',
    70: 'Maracas',
    71: 'Short Whistle',
    72: 'Long Whistle',
    73: 'Short Guiro',
    74: 'Long Guiro',
    75: 'Claves',
    76: 'Hi Wood Block',
    77: 'Low Wood Block',
    78: 'Mute Cuica',
    79: 'Open Cuica',
    80: 'Mute Triangle',
    81: 'Open Triangle',
  };

  /** Shorter labels for compact display */
  const GM_SHORT_NAMES = {
    35: 'Kick 2',
    36: 'Kick',
    37: 'Side Stick',
    38: 'Snare',
    39: 'Clap',
    40: 'Snare 2',
    41: 'Low Tom',
    42: 'Hi-Hat',
    43: 'Floor Tom',
    44: 'Pedal HH',
    45: 'Low Tom',
    46: 'Open HH',
    47: 'Mid Tom',
    48: 'Mid Tom',
    49: 'Crash',
    50: 'High Tom',
    51: 'Ride',
    52: 'China',
    53: 'Ride Bell',
    54: 'Tambourine',
    55: 'Splash',
    56: 'Cowbell',
    57: 'Crash 2',
    58: 'Vibraslap',
    59: 'Ride 2',
    60: 'Hi Bongo',
    61: 'Low Bongo',
    62: 'Mute Conga',
    63: 'Open Conga',
    64: 'Low Conga',
    65: 'Hi Timbale',
    66: 'Low Timbale',
    67: 'Hi Agogo',
    68: 'Low Agogo',
    69: 'Cabasa',
    70: 'Maracas',
    71: 'Short Whistle',
    72: 'Long Whistle',
    73: 'Short Guiro',
    74: 'Long Guiro',
    75: 'Claves',
    76: 'Hi Wood',
    77: 'Low Wood',
    78: 'Mute Cuica',
    79: 'Open Cuica',
    80: 'Mute Tri',
    81: 'Open Tri',
  };

  /**
   * Parse Cubase .drm XML.
   * @param {string} xmlText - Raw XML content
   * @returns {{ noteToName: Map<number, string>, displayOrder: number[] }}
   */
  function parseDrumMap(xmlText) {
    const noteToName = new Map();
    let displayOrder = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const root = doc.querySelector('DrumMap');
      if (!root) return { noteToName: new Map(DEFAULT_GM_MAP), displayOrder: getDefaultOrder() };

      const mapList = root.querySelector('list[name="Map"]') || root.querySelector('list[name="map"]');
      if (mapList) {
        const items = mapList.querySelectorAll('item');
        items.forEach((item) => {
          const inoteEl = item.querySelector('[name="INote"]') || item.querySelector('[name="inote"]');
          const nameEl = item.querySelector('[name="Name"]') || item.querySelector('[name="name"]');
          const inote = inoteEl ? parseInt(inoteEl.getAttribute('value') || '0', 10) : 0;
          const name = nameEl ? (nameEl.getAttribute('value') || '').trim() : '';
          if (name) noteToName.set(inote, name);
        });
      }

      const orderList = root.querySelector('list[name="Order"]') || root.querySelector('list[name="order"]');
      if (orderList) {
        const items = orderList.querySelectorAll('item');
        displayOrder = Array.from(items).map((item) => parseInt(item.getAttribute('value') || '0', 10));
      }
    } catch (e) {
      console.warn('Drum map parse error:', e);
    }

    if (noteToName.size === 0) {
      Object.entries(DEFAULT_GM_MAP).forEach(([n, name]) => noteToName.set(parseInt(n, 10), name));
    }
    if (displayOrder.length === 0) {
      displayOrder = getDefaultOrder();
    }

    return { noteToName, displayOrder };
  }

  function getDefaultOrder() {
    return [
      36, 38, 42, 46, 41, 43, 45, 47, 48, 50, 35, 37, 39, 40, 44, 49, 51, 52, 53, 54, 55, 56, 57, 58, 59,
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
    ];
  }

  /**
   * Get default GM drum map (no file load).
   * @param {{ short?: boolean }} [opts] - short: use compact names
   */
  function getDefaultDrumMap(opts = {}) {
    const src = opts.short ? GM_SHORT_NAMES : DEFAULT_GM_MAP;
    const noteToName = new Map(Object.entries(src).map(([n, name]) => [parseInt(n, 10), name]));
    const displayOrder = getDefaultOrder();
    return { noteToName, displayOrder };
  }

  window.DrumMap = {
    parseDrumMap,
    getDefaultDrumMap,
  };
})();
