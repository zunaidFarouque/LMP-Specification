/* LMP-Core v1 — Lean Musical Protocol compiler */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/midi-file/lib/midi-parser.js
var require_midi_parser = __commonJS({
  "node_modules/midi-file/lib/midi-parser.js"(exports, module) {
    function parseMidi3(data) {
      var p = new Parser(data);
      var headerChunk = p.readChunk();
      if (headerChunk.id != "MThd")
        throw "Bad MIDI file.  Expected 'MHdr', got: '" + headerChunk.id + "'";
      var header = parseHeader(headerChunk.data);
      var tracks = [];
      for (var i = 0; !p.eof() && i < header.numTracks; i++) {
        var trackChunk = p.readChunk();
        if (trackChunk.id != "MTrk")
          throw "Bad MIDI file.  Expected 'MTrk', got: '" + trackChunk.id + "'";
        var track = parseTrack(trackChunk.data);
        tracks.push(track);
      }
      return {
        header,
        tracks
      };
    }
    function parseHeader(data) {
      var p = new Parser(data);
      var format = p.readUInt16();
      var numTracks = p.readUInt16();
      var result = {
        format,
        numTracks
      };
      var timeDivision = p.readUInt16();
      if (timeDivision & 32768) {
        result.framesPerSecond = 256 - (timeDivision >> 8);
        result.ticksPerFrame = timeDivision & 255;
      } else {
        result.ticksPerBeat = timeDivision;
      }
      return result;
    }
    function parseTrack(data) {
      var p = new Parser(data);
      var events = [];
      while (!p.eof()) {
        var event = readEvent();
        events.push(event);
      }
      return events;
      var lastEventTypeByte = null;
      function readEvent() {
        var event2 = {};
        event2.deltaTime = p.readVarInt();
        var eventTypeByte = p.readUInt8();
        if ((eventTypeByte & 240) === 240) {
          if (eventTypeByte === 255) {
            event2.meta = true;
            var metatypeByte = p.readUInt8();
            var length = p.readVarInt();
            switch (metatypeByte) {
              case 0:
                event2.type = "sequenceNumber";
                if (length !== 2) throw "Expected length for sequenceNumber event is 2, got " + length;
                event2.number = p.readUInt16();
                return event2;
              case 1:
                event2.type = "text";
                event2.text = p.readString(length);
                return event2;
              case 2:
                event2.type = "copyrightNotice";
                event2.text = p.readString(length);
                return event2;
              case 3:
                event2.type = "trackName";
                event2.text = p.readString(length);
                return event2;
              case 4:
                event2.type = "instrumentName";
                event2.text = p.readString(length);
                return event2;
              case 5:
                event2.type = "lyrics";
                event2.text = p.readString(length);
                return event2;
              case 6:
                event2.type = "marker";
                event2.text = p.readString(length);
                return event2;
              case 7:
                event2.type = "cuePoint";
                event2.text = p.readString(length);
                return event2;
              case 32:
                event2.type = "channelPrefix";
                if (length != 1) throw "Expected length for channelPrefix event is 1, got " + length;
                event2.channel = p.readUInt8();
                return event2;
              case 33:
                event2.type = "portPrefix";
                if (length != 1) throw "Expected length for portPrefix event is 1, got " + length;
                event2.port = p.readUInt8();
                return event2;
              case 47:
                event2.type = "endOfTrack";
                if (length != 0) throw "Expected length for endOfTrack event is 0, got " + length;
                return event2;
              case 81:
                event2.type = "setTempo";
                if (length != 3) throw "Expected length for setTempo event is 3, got " + length;
                event2.microsecondsPerBeat = p.readUInt24();
                return event2;
              case 84:
                event2.type = "smpteOffset";
                if (length != 5) throw "Expected length for smpteOffset event is 5, got " + length;
                var hourByte = p.readUInt8();
                var FRAME_RATES = { 0: 24, 32: 25, 64: 29, 96: 30 };
                event2.frameRate = FRAME_RATES[hourByte & 96];
                event2.hour = hourByte & 31;
                event2.min = p.readUInt8();
                event2.sec = p.readUInt8();
                event2.frame = p.readUInt8();
                event2.subFrame = p.readUInt8();
                return event2;
              case 88:
                event2.type = "timeSignature";
                if (length != 2 && length != 4) throw "Expected length for timeSignature event is 4 or 2, got " + length;
                event2.numerator = p.readUInt8();
                event2.denominator = 1 << p.readUInt8();
                if (length === 4) {
                  event2.metronome = p.readUInt8();
                  event2.thirtyseconds = p.readUInt8();
                } else {
                  event2.metronome = 36;
                  event2.thirtyseconds = 8;
                }
                return event2;
              case 89:
                event2.type = "keySignature";
                if (length != 2) throw "Expected length for keySignature event is 2, got " + length;
                event2.key = p.readInt8();
                event2.scale = p.readUInt8();
                return event2;
              case 127:
                event2.type = "sequencerSpecific";
                event2.data = p.readBytes(length);
                return event2;
              default:
                event2.type = "unknownMeta";
                event2.data = p.readBytes(length);
                event2.metatypeByte = metatypeByte;
                return event2;
            }
          } else if (eventTypeByte == 240) {
            event2.type = "sysEx";
            var length = p.readVarInt();
            event2.data = p.readBytes(length);
            return event2;
          } else if (eventTypeByte == 247) {
            event2.type = "endSysEx";
            var length = p.readVarInt();
            event2.data = p.readBytes(length);
            return event2;
          } else {
            throw "Unrecognised MIDI event type byte: " + eventTypeByte;
          }
        } else {
          var param1;
          if ((eventTypeByte & 128) === 0) {
            if (lastEventTypeByte === null)
              throw "Running status byte encountered before status byte";
            param1 = eventTypeByte;
            eventTypeByte = lastEventTypeByte;
            event2.running = true;
          } else {
            param1 = p.readUInt8();
            lastEventTypeByte = eventTypeByte;
          }
          var eventType = eventTypeByte >> 4;
          event2.channel = eventTypeByte & 15;
          switch (eventType) {
            case 8:
              event2.type = "noteOff";
              event2.noteNumber = param1;
              event2.velocity = p.readUInt8();
              return event2;
            case 9:
              var velocity = p.readUInt8();
              event2.type = velocity === 0 ? "noteOff" : "noteOn";
              event2.noteNumber = param1;
              event2.velocity = velocity;
              if (velocity === 0) event2.byte9 = true;
              return event2;
            case 10:
              event2.type = "noteAftertouch";
              event2.noteNumber = param1;
              event2.amount = p.readUInt8();
              return event2;
            case 11:
              event2.type = "controller";
              event2.controllerType = param1;
              event2.value = p.readUInt8();
              return event2;
            case 12:
              event2.type = "programChange";
              event2.programNumber = param1;
              return event2;
            case 13:
              event2.type = "channelAftertouch";
              event2.amount = param1;
              return event2;
            case 14:
              event2.type = "pitchBend";
              event2.value = param1 + (p.readUInt8() << 7) - 8192;
              return event2;
            default:
              throw "Unrecognised MIDI event type: " + eventType;
          }
        }
      }
    }
    function Parser(data) {
      this.buffer = data;
      this.bufferLen = this.buffer.length;
      this.pos = 0;
    }
    Parser.prototype.eof = function() {
      return this.pos >= this.bufferLen;
    };
    Parser.prototype.readUInt8 = function() {
      var result = this.buffer[this.pos];
      this.pos += 1;
      return result;
    };
    Parser.prototype.readInt8 = function() {
      var u = this.readUInt8();
      if (u & 128)
        return u - 256;
      else
        return u;
    };
    Parser.prototype.readUInt16 = function() {
      var b0 = this.readUInt8(), b1 = this.readUInt8();
      return (b0 << 8) + b1;
    };
    Parser.prototype.readInt16 = function() {
      var u = this.readUInt16();
      if (u & 32768)
        return u - 65536;
      else
        return u;
    };
    Parser.prototype.readUInt24 = function() {
      var b0 = this.readUInt8(), b1 = this.readUInt8(), b2 = this.readUInt8();
      return (b0 << 16) + (b1 << 8) + b2;
    };
    Parser.prototype.readInt24 = function() {
      var u = this.readUInt24();
      if (u & 8388608)
        return u - 16777216;
      else
        return u;
    };
    Parser.prototype.readUInt32 = function() {
      var b0 = this.readUInt8(), b1 = this.readUInt8(), b2 = this.readUInt8(), b3 = this.readUInt8();
      return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3;
    };
    Parser.prototype.readBytes = function(len) {
      var bytes = this.buffer.slice(this.pos, this.pos + len);
      this.pos += len;
      return bytes;
    };
    Parser.prototype.readString = function(len) {
      var bytes = this.readBytes(len);
      return String.fromCharCode.apply(null, bytes);
    };
    Parser.prototype.readVarInt = function() {
      var result = 0;
      while (!this.eof()) {
        var b = this.readUInt8();
        if (b & 128) {
          result += b & 127;
          result <<= 7;
        } else {
          return result + b;
        }
      }
      return result;
    };
    Parser.prototype.readChunk = function() {
      var id = this.readString(4);
      var length = this.readUInt32();
      var data = this.readBytes(length);
      return {
        id,
        length,
        data
      };
    };
    module.exports = parseMidi3;
  }
});

// node_modules/midi-file/lib/midi-writer.js
var require_midi_writer = __commonJS({
  "node_modules/midi-file/lib/midi-writer.js"(exports, module) {
    function writeMidi2(data, opts) {
      if (typeof data !== "object")
        throw "Invalid MIDI data";
      opts = opts || {};
      var header = data.header || {};
      var tracks = data.tracks || [];
      var i, len = tracks.length;
      var w = new Writer();
      writeHeader(w, header, len);
      for (i = 0; i < len; i++) {
        writeTrack(w, tracks[i], opts);
      }
      return w.buffer;
    }
    function writeHeader(w, header, numTracks) {
      var format = header.format == null ? 1 : header.format;
      var timeDivision = 128;
      if (header.timeDivision) {
        timeDivision = header.timeDivision;
      } else if (header.ticksPerFrame && header.framesPerSecond) {
        timeDivision = -(header.framesPerSecond & 255) << 8 | header.ticksPerFrame & 255;
      } else if (header.ticksPerBeat) {
        timeDivision = header.ticksPerBeat & 32767;
      }
      var h = new Writer();
      h.writeUInt16(format);
      h.writeUInt16(numTracks);
      h.writeUInt16(timeDivision);
      w.writeChunk("MThd", h.buffer);
    }
    function writeTrack(w, track, opts) {
      var t = new Writer();
      var i, len = track.length;
      var eventTypeByte = null;
      for (i = 0; i < len; i++) {
        if (opts.running === false || !opts.running && !track[i].running) eventTypeByte = null;
        eventTypeByte = writeEvent(t, track[i], eventTypeByte, opts.useByte9ForNoteOff);
      }
      w.writeChunk("MTrk", t.buffer);
    }
    function writeEvent(w, event, lastEventTypeByte, useByte9ForNoteOff) {
      var type = event.type;
      var deltaTime = event.deltaTime;
      var text = event.text || "";
      var data = event.data || [];
      var eventTypeByte = null;
      w.writeVarInt(deltaTime);
      switch (type) {
        // meta events
        case "sequenceNumber":
          w.writeUInt8(255);
          w.writeUInt8(0);
          w.writeVarInt(2);
          w.writeUInt16(event.number);
          break;
        case "text":
          w.writeUInt8(255);
          w.writeUInt8(1);
          w.writeVarInt(text.length);
          w.writeString(text);
          break;
        case "copyrightNotice":
          w.writeUInt8(255);
          w.writeUInt8(2);
          w.writeVarInt(text.length);
          w.writeString(text);
          break;
        case "trackName":
          w.writeUInt8(255);
          w.writeUInt8(3);
          w.writeVarInt(text.length);
          w.writeString(text);
          break;
        case "instrumentName":
          w.writeUInt8(255);
          w.writeUInt8(4);
          w.writeVarInt(text.length);
          w.writeString(text);
          break;
        case "lyrics":
          w.writeUInt8(255);
          w.writeUInt8(5);
          w.writeVarInt(text.length);
          w.writeString(text);
          break;
        case "marker":
          w.writeUInt8(255);
          w.writeUInt8(6);
          w.writeVarInt(text.length);
          w.writeString(text);
          break;
        case "cuePoint":
          w.writeUInt8(255);
          w.writeUInt8(7);
          w.writeVarInt(text.length);
          w.writeString(text);
          break;
        case "channelPrefix":
          w.writeUInt8(255);
          w.writeUInt8(32);
          w.writeVarInt(1);
          w.writeUInt8(event.channel);
          break;
        case "portPrefix":
          w.writeUInt8(255);
          w.writeUInt8(33);
          w.writeVarInt(1);
          w.writeUInt8(event.port);
          break;
        case "endOfTrack":
          w.writeUInt8(255);
          w.writeUInt8(47);
          w.writeVarInt(0);
          break;
        case "setTempo":
          w.writeUInt8(255);
          w.writeUInt8(81);
          w.writeVarInt(3);
          w.writeUInt24(event.microsecondsPerBeat);
          break;
        case "smpteOffset":
          w.writeUInt8(255);
          w.writeUInt8(84);
          w.writeVarInt(5);
          var FRAME_RATES = { 24: 0, 25: 32, 29: 64, 30: 96 };
          var hourByte = event.hour & 31 | FRAME_RATES[event.frameRate];
          w.writeUInt8(hourByte);
          w.writeUInt8(event.min);
          w.writeUInt8(event.sec);
          w.writeUInt8(event.frame);
          w.writeUInt8(event.subFrame);
          break;
        case "timeSignature":
          w.writeUInt8(255);
          w.writeUInt8(88);
          w.writeVarInt(4);
          w.writeUInt8(event.numerator);
          var denominator = Math.floor(Math.log(event.denominator) / Math.LN2) & 255;
          w.writeUInt8(denominator);
          w.writeUInt8(event.metronome);
          w.writeUInt8(event.thirtyseconds || 8);
          break;
        case "keySignature":
          w.writeUInt8(255);
          w.writeUInt8(89);
          w.writeVarInt(2);
          w.writeInt8(event.key);
          w.writeUInt8(event.scale);
          break;
        case "sequencerSpecific":
          w.writeUInt8(255);
          w.writeUInt8(127);
          w.writeVarInt(data.length);
          w.writeBytes(data);
          break;
        case "unknownMeta":
          if (event.metatypeByte != null) {
            w.writeUInt8(255);
            w.writeUInt8(event.metatypeByte);
            w.writeVarInt(data.length);
            w.writeBytes(data);
          }
          break;
        // system-exclusive
        case "sysEx":
          w.writeUInt8(240);
          w.writeVarInt(data.length);
          w.writeBytes(data);
          break;
        case "endSysEx":
          w.writeUInt8(247);
          w.writeVarInt(data.length);
          w.writeBytes(data);
          break;
        // channel events
        case "noteOff":
          var noteByte = useByte9ForNoteOff !== false && event.byte9 || useByte9ForNoteOff && event.velocity == 0 ? 144 : 128;
          eventTypeByte = noteByte | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
          w.writeUInt8(event.noteNumber);
          w.writeUInt8(event.velocity);
          break;
        case "noteOn":
          eventTypeByte = 144 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
          w.writeUInt8(event.noteNumber);
          w.writeUInt8(event.velocity);
          break;
        case "noteAftertouch":
          eventTypeByte = 160 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
          w.writeUInt8(event.noteNumber);
          w.writeUInt8(event.amount);
          break;
        case "controller":
          eventTypeByte = 176 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
          w.writeUInt8(event.controllerType);
          w.writeUInt8(event.value);
          break;
        case "programChange":
          eventTypeByte = 192 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
          w.writeUInt8(event.programNumber);
          break;
        case "channelAftertouch":
          eventTypeByte = 208 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
          w.writeUInt8(event.amount);
          break;
        case "pitchBend":
          eventTypeByte = 224 | event.channel;
          if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
          var value14 = 8192 + event.value;
          var lsb14 = value14 & 127;
          var msb14 = value14 >> 7 & 127;
          w.writeUInt8(lsb14);
          w.writeUInt8(msb14);
          break;
        default:
          throw "Unrecognized event type: " + type;
      }
      return eventTypeByte;
    }
    function Writer() {
      this.buffer = [];
    }
    Writer.prototype.writeUInt8 = function(v) {
      this.buffer.push(v & 255);
    };
    Writer.prototype.writeInt8 = Writer.prototype.writeUInt8;
    Writer.prototype.writeUInt16 = function(v) {
      var b0 = v >> 8 & 255, b1 = v & 255;
      this.writeUInt8(b0);
      this.writeUInt8(b1);
    };
    Writer.prototype.writeInt16 = Writer.prototype.writeUInt16;
    Writer.prototype.writeUInt24 = function(v) {
      var b0 = v >> 16 & 255, b1 = v >> 8 & 255, b2 = v & 255;
      this.writeUInt8(b0);
      this.writeUInt8(b1);
      this.writeUInt8(b2);
    };
    Writer.prototype.writeInt24 = Writer.prototype.writeUInt24;
    Writer.prototype.writeUInt32 = function(v) {
      var b0 = v >> 24 & 255, b1 = v >> 16 & 255, b2 = v >> 8 & 255, b3 = v & 255;
      this.writeUInt8(b0);
      this.writeUInt8(b1);
      this.writeUInt8(b2);
      this.writeUInt8(b3);
    };
    Writer.prototype.writeInt32 = Writer.prototype.writeUInt32;
    Writer.prototype.writeBytes = function(arr) {
      this.buffer = this.buffer.concat(Array.prototype.slice.call(arr, 0));
    };
    Writer.prototype.writeString = function(str) {
      var i, len = str.length, arr = [];
      for (i = 0; i < len; i++) {
        arr.push(str.codePointAt(i));
      }
      this.writeBytes(arr);
    };
    Writer.prototype.writeVarInt = function(v) {
      if (v < 0) throw "Cannot write negative variable-length integer";
      if (v <= 127) {
        this.writeUInt8(v);
      } else {
        var i = v;
        var bytes = [];
        bytes.push(i & 127);
        i >>= 7;
        while (i) {
          var b = i & 127 | 128;
          bytes.push(b);
          i >>= 7;
        }
        this.writeBytes(bytes.reverse());
      }
    };
    Writer.prototype.writeChunk = function(id, data) {
      this.writeString(id);
      this.writeUInt32(data.length);
      this.writeBytes(data);
    };
    module.exports = writeMidi2;
  }
});

// node_modules/midi-file/index.js
var require_midi_file = __commonJS({
  "node_modules/midi-file/index.js"(exports) {
    exports.parseMidi = require_midi_parser();
    exports.writeMidi = require_midi_writer();
  }
});

// src/preprocess.js
function isBlank(line) {
  return line.trim() === "";
}
function stripComment(line) {
  const i = line.indexOf("//");
  return i === -1 ? line : line.slice(0, i);
}
function classify(tokens) {
  if (!tokens.length) return "blank";
  const first = tokens[0];
  if (first.startsWith("@")) return "header";
  if (first === "+") return "continuation";
  if (first === "|") return "modifier";
  return "event";
}
function preprocess(lmpText) {
  const lines = lmpText.split(/\n/);
  const result = [];
  let trailing = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = stripComment(lines[i]);
    const trimmed = raw.trim();
    const tokens = trimmed ? trimmed.split(/\s+/) : [];
    if (isBlank(raw)) {
      trailing = true;
      continue;
    }
    if (trailing) {
      const startsLMP = /^\s*@|^\s*\d|^\s*\+|^\s*\|/.test(raw);
      if (!startsLMP) continue;
      trailing = false;
    }
    if (tokens.length === 0) continue;
    const type = classify(tokens);
    result.push({ type, tokens, sourceLine: i + 1 });
  }
  return result;
}

// src/state.js
var DEFAULT_PPQN = 480;
var DEFAULT_TIMESIG = { num: 4, denom: 4 };
var DEFAULT_PBRANGE = 2;
var TRACK_NAME_REGEX = /^[A-Za-z0-9_]+$/;
var MAP_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
function buildState(lines, options = {}) {
  const { loose = false, warnings = [] } = options;
  const state = {
    version: void 0,
    bpm: void 0,
    timesig: { ...DEFAULT_TIMESIG },
    ppqn: DEFAULT_PPQN,
    tracks: [],
    map: /* @__PURE__ */ Object.create(null)
  };
  let currentTrackIndex = -1;
  for (const { type, tokens } of lines) {
    if (type === "event" || type === "continuation" || type === "modifier") {
      if (state.tracks.length === 0) {
        throw new Error("LMP: Events must appear after at least one @TRACK declaration.");
      }
      const track = state.tracks[currentTrackIndex];
      if (track && track.channel === void 0) {
        if (loose) {
          track.channel = 1;
          warnings.push(`LMP [loose]: Track ${track.id} (${track.name}) missing @CHANNEL; assuming channel 1`);
        } else {
          throw new Error("LMP: Each track must declare @CHANNEL before events.");
        }
      }
      continue;
    }
    if (type !== "header" || !tokens.length) continue;
    const key = tokens[0].toUpperCase();
    const args = tokens.slice(1);
    switch (key) {
      case "@LMP":
        if (args[0]) state.version = args[0];
        break;
      case "@BPM":
        if (args[0] !== void 0) state.bpm = parseFloat(args[0], 10);
        break;
      case "@TIMESIG":
        if (args[0]) {
          const parts = args[0].split("/");
          if (parts.length >= 2) {
            const num = parseInt(parts[0], 10);
            const denom = parseInt(parts[1], 10);
            if (!isNaN(num) && !isNaN(denom)) state.timesig = { num, denom };
          }
        }
        break;
      case "@PPQN":
        if (args[0] !== void 0) {
          const n = parseInt(args[0], 10);
          if (!isNaN(n)) state.ppqn = n;
        }
        break;
      case "@TRACK": {
        const id = args[0] !== void 0 ? parseInt(args[0], 10) : NaN;
        const name = args[1];
        if (!name || !TRACK_NAME_REGEX.test(name)) {
          throw new Error("LMP: @TRACK requires a name (alphanumeric and underscores only).");
        }
        if (isNaN(id)) {
          throw new Error("LMP: @TRACK requires a track number.");
        }
        state.tracks.push({
          id,
          name,
          channel: void 0,
          program: void 0,
          pbrange: DEFAULT_PBRANGE,
          defaultVel: void 0,
          defaultDur: void 0,
          rules: []
        });
        currentTrackIndex = state.tracks.length - 1;
        break;
      }
      case "@CHANNEL":
        if (currentTrackIndex >= 0 && args[0] !== void 0) {
          const ch = parseInt(args[0], 10);
          if (ch >= 1 && ch <= 16) state.tracks[currentTrackIndex].channel = ch;
        }
        break;
      case "@PROGRAM":
        if (currentTrackIndex >= 0 && args[0] !== void 0) {
          const p = parseInt(args[0], 10);
          if (p >= 0 && p <= 127) state.tracks[currentTrackIndex].program = p;
        }
        break;
      case "@PBRANGE":
        if (currentTrackIndex >= 0 && args[0] !== void 0) {
          const r = parseInt(args[0], 10);
          if (!isNaN(r)) state.tracks[currentTrackIndex].pbrange = r;
        }
        break;
      case "@MAP": {
        const pair = args[0];
        if (!pair || !pair.includes("=")) break;
        const [name, val] = pair.split("=").map((s) => s.trim());
        if (!name || !MAP_NAME_REGEX.test(name)) {
          throw new Error("LMP: @MAP name must be alphanumeric and underscores only, and cannot start with a digit.");
        }
        const midi = parseInt(val, 10);
        if (!Number.isNaN(midi) && midi >= 0 && midi <= 127) state.map[name] = midi;
        break;
      }
      case "@INHERIT": {
        if (currentTrackIndex < 0 || args[0] === void 0) break;
        const fromId = parseInt(args[0], 10);
        const fromIdx = state.tracks.findIndex((t) => t.id === fromId);
        if (fromIdx < 0) {
          if (loose) {
            warnings.push(`LMP [loose]: @INHERIT from non-existent track ${fromId}; skipping`);
            break;
          }
          throw new Error("LMP: @INHERIT from non-existent track.");
        }
        if (fromIdx === currentTrackIndex) {
          if (loose) {
            warnings.push(`LMP [loose]: @INHERIT from same track (${fromId}) is invalid; skipping`);
            break;
          }
          throw new Error("LMP: @INHERIT from same track is invalid.");
        }
        if (fromIdx > currentTrackIndex) {
          if (loose) {
            warnings.push(`LMP [loose]: @INHERIT from track ${fromId} declared later is invalid; skipping`);
            break;
          }
          throw new Error("LMP: @INHERIT from track declared later is invalid.");
        }
        const from = state.tracks[fromIdx];
        const list = args[1] ? args[1].toUpperCase().split(",").map((s) => s.trim()) : ["VEL", "DUR", "CHANNEL", "PROGRAM", "PBRANGE", "RULE"];
        const cur = state.tracks[currentTrackIndex];
        if (list.includes("VEL")) cur.defaultVel = from.defaultVel;
        if (list.includes("DUR")) cur.defaultDur = from.defaultDur;
        if (list.includes("CHANNEL")) cur.channel = from.channel;
        if (list.includes("PROGRAM")) cur.program = from.program;
        if (list.includes("PBRANGE")) cur.pbrange = from.pbrange;
        if (list.includes("RULE")) cur.rules = [...from.rules || []];
        break;
      }
      case "@RESET_TRACK":
        if (currentTrackIndex >= 0) {
          state.tracks[currentTrackIndex].defaultVel = void 0;
          state.tracks[currentTrackIndex].defaultDur = void 0;
          state.tracks[currentTrackIndex].rules = [];
        }
        break;
      case "@DEFAULT_VEL":
        if (currentTrackIndex >= 0 && args[0] !== void 0) {
          const v = parseInt(args[0], 10);
          if (!isNaN(v)) state.tracks[currentTrackIndex].defaultVel = Math.max(1, Math.min(127, v));
        }
        break;
      case "@DEFAULT_DUR":
        if (currentTrackIndex >= 0 && args[0] !== void 0) {
          const d = parseFloat(args[0], 10);
          if (!isNaN(d)) state.tracks[currentTrackIndex].defaultDur = d;
        }
        break;
      case "@RULE":
        if (currentTrackIndex >= 0 && args.length >= 1) {
          const full = args.join(" ").toUpperCase();
          if (full.includes("LEGATO=TRUE")) {
            state.tracks[currentTrackIndex].legato = true;
            break;
          }
          const pitch = args[0];
          const ruleStr = args.slice(1).join(" ").toUpperCase();
          const velMatch = ruleStr.match(/VEL=(\d+)-(\d+)/);
          const durMatch = ruleStr.match(/DUR=([\d.]+)/);
          const rule = {};
          if (velMatch) rule.velRange = [parseInt(velMatch[1], 10), parseInt(velMatch[2], 10)];
          if (durMatch) rule.dur = parseFloat(durMatch[1], 10);
          if (Object.keys(rule).length) {
            state.tracks[currentTrackIndex].rules = state.tracks[currentTrackIndex].rules || [];
            state.tracks[currentTrackIndex].rules.push({ pitch, ...rule });
          }
        }
        break;
      default:
        break;
    }
  }
  return state;
}

// src/utils.js
var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var SPN_REGEX = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/i;
function spnToMidi(spn) {
  if (!spn || typeof spn !== "string") return void 0;
  const m = spn.trim().match(SPN_REGEX);
  if (!m) return void 0;
  let noteIndex = NOTE_NAMES.indexOf(m[1].toUpperCase());
  if (noteIndex === -1) return void 0;
  const acc = m[2];
  if (acc) {
    if (acc.startsWith("b")) {
      noteIndex -= acc.length;
    } else {
      noteIndex += acc.length;
    }
  }
  noteIndex = (noteIndex % 12 + 12) % 12;
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + noteIndex;
  if (midi < 0 || midi > 127) return void 0;
  return midi;
}
function beatToTicks(beat, bpm, ppqn) {
  if (bpm <= 0) return 0;
  const beatsPerSec = bpm / 60;
  const secPerBeat = 1 / beatsPerSec;
  const ticksPerBeat = ppqn;
  const ticks = beat * ticksPerBeat;
  return Math.round(ticks);
}
function midiToSpn(midi) {
  if (typeof midi !== "number" || midi < 0 || midi > 127) return void 0;
  const n = Math.round(midi);
  const noteName = NOTE_NAMES[n % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${noteName}${octave}`;
}
function ticksToBeat(tick, ppqn) {
  if (ppqn <= 0) return 0;
  const beat = tick / ppqn;
  return Math.round(beat * 1e3) / 1e3;
}

// src/expand.js
var DEFAULT_VEL = 100;
var DEFAULT_DUR = 0.25;
var RESERVED_PITCH = /* @__PURE__ */ new Set(["R", "CC", "PB", "TEMPO", "TS"]);
var TYPE_ORDER = { cc: 0, pb: 1, note: 2, rest: 3, tempo: 4, ts: 5 };
function parseBeat(token) {
  const b = parseFloat(token, 10);
  if (Number.isNaN(b) || b < 0) return null;
  return Math.round(b * 1e3) / 1e3;
}
function resolvePitch(token, map) {
  const upper = (token || "").toUpperCase();
  if (RESERVED_PITCH.has(upper)) return { reserved: upper };
  const spn = spnToMidi(token);
  if (spn !== void 0) return { midi: spn };
  const num = parseInt(token, 10);
  if (!Number.isNaN(num) && num >= 0 && num <= 127) return { midi: num };
  if (map && map[token] !== void 0) return { midi: map[token] };
  return null;
}
function getRuleForPitch(track, pitchToken) {
  if (!track.rules || !track.rules.length) return null;
  const token = (pitchToken || "").toString().trim();
  const upper = token.toUpperCase();
  for (const r of track.rules) {
    const rp = (r.pitch || "").toString().trim().toUpperCase();
    if (rp === upper || rp === token) return r;
    const rMidi = resolvePitch(r.pitch, {});
    if (rMidi && rMidi.midi !== void 0 && resolvePitch(token, {})?.midi === rMidi.midi) return r;
  }
  return null;
}
function velocityFromRule(track, pitchToken) {
  const rule = getRuleForPitch(track, pitchToken);
  if (!rule || !rule.velRange) return void 0;
  const [min, max] = rule.velRange;
  return Math.floor((min + max) / 2);
}
function durationFromRule(track, pitchToken) {
  const rule = getRuleForPitch(track, pitchToken);
  if (!rule || rule.dur === void 0) return void 0;
  return rule.dur;
}
function hasLegato(track) {
  return track && track.legato === true;
}
var RANGE_REGEX = /^([\d.]+)-([\d.]+):(.+)$/;
function parseRepeatRange(token) {
  const m = (token || "").match(RANGE_REGEX);
  if (!m) return null;
  const start = parseFloat(m[1], 10);
  const end = parseFloat(m[2], 10);
  const intervalStr = m[3].trim();
  if (start >= end || Number.isNaN(start) || Number.isNaN(end)) return null;
  let interval;
  if (intervalStr.includes("/")) {
    const [num, denom] = intervalStr.split("/").map((s) => parseInt(s.trim(), 10));
    if (!num || !denom || num <= 0 || denom <= 0) return null;
    interval = num / denom;
  } else {
    interval = parseFloat(intervalStr, 10);
    if (Number.isNaN(interval) || interval <= 0) return null;
  }
  const beats = [];
  for (let b = start; b < end - 1e-9; b += interval) {
    beats.push(Math.round(b * 1e3) / 1e3);
  }
  return { start, end, interval, beats };
}
var TOLERANCE = 0.01;
function beatsMatch(a, b) {
  return Math.abs(a - b) <= TOLERANCE;
}
function applyModifiers(notes, modifierLines) {
  const velOverrides = /* @__PURE__ */ new Map();
  const durOverrides = /* @__PURE__ */ new Map();
  const restBeats = /* @__PURE__ */ new Set();
  for (const { tokens } of modifierLines) {
    const kind = tokens[1];
    if (kind === "R") {
      for (let k = 2; k < tokens.length; k++) {
        const b = parseFloat(tokens[k], 10);
        if (!Number.isNaN(b)) restBeats.add(b);
      }
    } else if (kind === "V") {
      const rest = tokens.slice(2).join(" ");
      const groups = rest.split(",").map((s) => s.trim());
      for (const g of groups) {
        const parts = g.split(/\s+/);
        const val = parseInt(parts[parts.length - 1], 10);
        if (Number.isNaN(val)) continue;
        for (let p = 0; p < parts.length - 1; p++) {
          const spec = parts[p];
          const range = spec.match(/^\[([\d.]+)-([\d.]+)\]$/);
          if (range) {
            const start = parseFloat(range[1], 10);
            const end = parseFloat(range[2], 10);
            for (const n of notes) {
              if (n.beat >= start && n.beat < end) velOverrides.set(n.beat, val);
            }
          } else {
            const single = parseFloat(spec.replace(/[\[\]]/g, ""), 10);
            if (!Number.isNaN(single)) velOverrides.set(single, val);
          }
        }
      }
    } else if (kind === "D") {
      const rest = tokens.slice(2).join(" ");
      const groups = rest.split(",").map((s) => s.trim());
      for (const g of groups) {
        const parts = g.split(/\s+/);
        const val = parseFloat(parts[parts.length - 1], 10);
        if (Number.isNaN(val)) continue;
        for (let p = 0; p < parts.length - 1; p++) {
          const spec = parts[p];
          const range = spec.match(/^\[([\d.]+)-([\d.]+)\]$/);
          if (range) {
            const start = parseFloat(range[1], 10);
            const end = parseFloat(range[2], 10);
            for (const n of notes) {
              if (n.beat >= start && n.beat < end) durOverrides.set(n.beat, val);
            }
          } else {
            const single = parseFloat(spec.replace(/[\[\]]/g, ""), 10);
            if (!Number.isNaN(single)) durOverrides.set(single, val);
          }
        }
      }
    }
  }
  for (const n of notes) {
    if (velOverrides.has(n.beat)) n.velocity = velOverrides.get(n.beat);
    if (durOverrides.has(n.beat)) n.duration = durOverrides.get(n.beat);
  }
  return notes.filter((n) => {
    for (const rb of restBeats) {
      if (beatsMatch(n.beat, rb)) return false;
    }
    return true;
  });
}
function expand(lines, state, options = {}) {
  const { loose = false, warnings = [] } = options;
  const events = [];
  let currentTrackIndex = -1;
  const map = state.map || {};
  let lastBaseBeat = null;
  let lastRepeatingNotes = null;
  let pendingModifiers = [];
  for (let i = 0; i < lines.length; i++) {
    const { type, tokens, sourceLine } = lines[i];
    if (!tokens.length) continue;
    if (type === "header") {
      const key = tokens[0].toUpperCase();
      const args = tokens.slice(1);
      if (key === "@TRACK" && tokens[1] !== void 0) {
        const id = parseInt(tokens[1], 10);
        const idx = state.tracks.findIndex((t) => t.id === id);
        if (idx >= 0) currentTrackIndex = idx;
      }
      if (currentTrackIndex >= 0) {
        if (key === "@CHANNEL" && args[0] !== void 0) {
          const ch = parseInt(args[0], 10);
          if (ch >= 1 && ch <= 16) state.tracks[currentTrackIndex].channel = ch;
        }
        if (key === "@PROGRAM" && args[0] !== void 0) {
          const p = parseInt(args[0], 10);
          if (p >= 0 && p <= 127) state.tracks[currentTrackIndex].program = p;
        }
      }
      lastBaseBeat = null;
      lastRepeatingNotes = null;
      pendingModifiers = [];
      continue;
    }
    if (type === "continuation") {
      if (lastBaseBeat === null) throw new Error("LMP: Orphaned same-beat continuation (+).");
      if (currentTrackIndex < 0) continue;
      const pitchStr = tokens[1];
      if (!pitchStr) continue;
      const track = state.tracks[currentTrackIndex];
      let velocity = track.defaultVel !== void 0 ? track.defaultVel : DEFAULT_VEL;
      let duration = track.defaultDur !== void 0 ? track.defaultDur : DEFAULT_DUR;
      if (tokens[2] !== void 0 && tokens[2] !== "_") {
        const v = parseInt(tokens[2], 10);
        if (!Number.isNaN(v)) velocity = Math.max(1, Math.min(127, v));
      }
      if (tokens[3] !== void 0) {
        const d = parseFloat(tokens[3], 10);
        if (!Number.isNaN(d)) duration = d;
      }
      const pitches = pitchStr.includes(",") ? pitchStr.split(",").map((s) => s.trim()) : [pitchStr];
      for (const p of pitches) {
        const pitch = resolvePitch(p, map);
        if (pitch && !pitch.reserved) {
          events.push({
            type: "note",
            trackIndex: currentTrackIndex,
            channel: state.tracks[currentTrackIndex]?.channel,
            beat: lastBaseBeat,
            midi: pitch.midi,
            velocity,
            duration,
            sourceLine
          });
        }
      }
      continue;
    }
    if (type === "modifier") {
      if (lastRepeatingNotes === null) throw new Error("LMP: Orphaned modifier (|) \u2014 must follow a repeating note.");
      pendingModifiers.push({ type, tokens });
      continue;
    }
    if (type === "event") {
      if (lastRepeatingNotes) {
        const applied = applyModifiers(lastRepeatingNotes, pendingModifiers);
        events.push(...applied);
        lastRepeatingNotes = null;
        pendingModifiers = [];
      }
      if (currentTrackIndex < 0) {
        const p = (tokens[1] || "").toUpperCase();
        if (p === "TEMPO" || p === "TS") throw new Error("LMP: TEMPO and TS must appear after at least one @TRACK.");
        continue;
      }
      const range = parseRepeatRange(tokens[0]);
      if ((tokens[0] || "").match(RANGE_REGEX) && !range) {
        if (loose) warnings.push(`LMP [loose]: Invalid repeating range '${tokens[0]}' (start >= end or invalid interval); skipping`);
        continue;
      }
      const beat = range ? null : parseBeat(tokens[0]);
      if (!range && beat === null) continue;
      const pitchRaw = (tokens[1] || "").toUpperCase();
      const pitch = resolvePitch(tokens[1], map);
      if (pitch && pitch.reserved) {
        if (pitch.reserved === "R") {
          events.push({ type: "rest", trackIndex: currentTrackIndex, beat: beat ?? range.beats[0] });
          continue;
        }
        if (pitch.reserved === "CC") {
          if (tokens[2] === "_" || tokens[3] === "_") {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid CC row at beat ${beat ?? tokens[0]} (underscore invalid); skipping`);
              continue;
            }
            throw new Error("LMP: CC requires numeric controller number and value; underscore is invalid.");
          }
          if (tokens[2] === void 0 || tokens[3] === void 0) {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid CC row at beat ${beat ?? tokens[0]} (missing controller number or value); skipping`);
              continue;
            }
            throw new Error("LMP: CC requires both controller number (column 3) and value (column 4).");
          }
          const num = parseInt(tokens[2], 10);
          const val = parseInt(tokens[3], 10);
          if (Number.isNaN(num) || Number.isNaN(val)) {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid CC row at beat ${beat ?? tokens[0]} (non-numeric controller/value); skipping`);
              continue;
            }
            continue;
          }
          events.push({
            type: "cc",
            trackIndex: currentTrackIndex,
            channel: state.tracks[currentTrackIndex]?.channel,
            beat: beat ?? 0,
            number: Math.max(0, Math.min(127, num)),
            value: Math.max(0, Math.min(127, val))
          });
          continue;
        }
        if (pitch.reserved === "PB") {
          const raw = tokens[2] !== void 0 ? parseFloat(tokens[2], 10) : NaN;
          if (tokens[2] === void 0 || Number.isNaN(raw)) {
            if (loose) {
              warnings.push(`LMP [loose]: Invalid PB row at beat ${beat ?? tokens[0]} (missing or invalid bend value); skipping`);
              continue;
            }
            throw new Error("LMP: PB requires a valid bend value in column 3.");
          }
          const semitones = raw;
          const pbrange = state.tracks[currentTrackIndex]?.pbrange ?? 2;
          const clamped = Math.max(-pbrange, Math.min(pbrange, semitones));
          events.push({
            type: "pb",
            trackIndex: currentTrackIndex,
            channel: state.tracks[currentTrackIndex]?.channel,
            beat: beat ?? 0,
            semitones: clamped
          });
          continue;
        }
        if (pitch.reserved === "TEMPO") {
          if (state.tracks.length === 0) throw new Error("LMP: TEMPO must appear after at least one @TRACK.");
          const bpm = parseFloat(tokens[2], 10);
          events.push({ type: "tempo", trackIndex: 0, beat: beat ?? 0, bpm: Number.isNaN(bpm) ? 120 : bpm });
          continue;
        }
        if (pitch.reserved === "TS") {
          if (state.tracks.length === 0) throw new Error("LMP: Time signature (TS) must appear after at least one @TRACK.");
          const num = parseInt(tokens[2], 10);
          const denom = parseInt(tokens[3], 10);
          events.push({ type: "ts", trackIndex: 0, beat: beat ?? 0, num: Number.isNaN(num) ? 4 : num, denom: Number.isNaN(denom) ? 4 : denom });
          continue;
        }
      }
      const track = state.tracks[currentTrackIndex];
      let velocity = tokens[2] !== void 0 && tokens[2] !== "_" ? (() => {
        const v = parseInt(tokens[2], 10);
        return Number.isNaN(v) ? velocityFromRule(track, tokens[1]) ?? track.defaultVel ?? DEFAULT_VEL : Math.max(1, Math.min(127, v));
      })() : velocityFromRule(track, tokens[1]) ?? track.defaultVel ?? DEFAULT_VEL;
      let duration = tokens[3] !== void 0 ? (() => {
        const d = parseFloat(tokens[3], 10);
        return Number.isNaN(d) ? durationFromRule(track, tokens[1]) ?? track.defaultDur ?? DEFAULT_DUR : d;
      })() : durationFromRule(track, tokens[1]) ?? (hasLegato(track) ? void 0 : track.defaultDur ?? DEFAULT_DUR);
      if (!range && (tokens[1] || "").includes(",")) {
        const chordPitches = tokens[1].split(",").map((s) => s.trim());
        const resolved = chordPitches.map((s) => resolvePitch(s, map)).filter((p) => p && !p.reserved);
        for (let ci = 0; ci < resolved.length; ci++) {
          const p = resolved[ci];
          const vel = velocityFromRule(track, chordPitches[ci]) ?? velocity;
          const dur2 = durationFromRule(track, chordPitches[ci]) ?? duration ?? (track.defaultDur ?? DEFAULT_DUR);
          events.push({
            type: "note",
            trackIndex: currentTrackIndex,
            channel: track.channel,
            beat,
            midi: p.midi,
            velocity: vel,
            duration: dur2,
            sourceLine
          });
        }
        lastBaseBeat = beat;
        continue;
      }
      if (range && pitch && !pitch.reserved) {
        const midi = pitch.midi;
        const ch = state.tracks[currentTrackIndex]?.channel;
        const notes = range.beats.map((b) => ({
          type: "note",
          trackIndex: currentTrackIndex,
          channel: ch,
          beat: b,
          midi,
          velocity,
          duration,
          sourceLine
        }));
        lastRepeatingNotes = notes;
        lastBaseBeat = null;
        pendingModifiers = [];
        continue;
      }
      if (!pitch || pitch.reserved) continue;
      const needLegato = hasLegato(track) && duration === void 0;
      const dur = duration !== void 0 ? duration : needLegato ? void 0 : track.defaultDur ?? DEFAULT_DUR;
      events.push({
        type: "note",
        trackIndex: currentTrackIndex,
        channel: track.channel,
        beat,
        midi: pitch.midi,
        velocity,
        duration: dur,
        _legato: needLegato,
        sourceLine
      });
      lastBaseBeat = beat;
    }
  }
  if (lastRepeatingNotes) {
    const applied = applyModifiers(lastRepeatingNotes, pendingModifiers);
    events.push(...applied);
  }
  const ppqn = state.ppqn ?? 480;
  const legatoGapBeats = 2 / ppqn;
  for (let ti = 0; ti < (state.tracks || []).length; ti++) {
    const track = state.tracks[ti];
    if (!hasLegato(track)) continue;
    const trackNotes = events.filter((e) => e.type === "note" && e.trackIndex === ti);
    const trackStops = events.filter((e) => (e.type === "note" || e.type === "rest") && e.trackIndex === ti).map((e) => e.beat).sort((a, b) => a - b);
    for (const n of trackNotes) {
      if (!n._legato) continue;
      const nextStop = trackStops.find((b) => b > n.beat);
      if (nextStop !== void 0) {
        n.duration = Math.max(1e-3, nextStop - n.beat - legatoGapBeats);
      } else {
        n.duration = track.defaultDur ?? DEFAULT_DUR;
      }
      delete n._legato;
    }
  }
  events.sort((a, b) => {
    if (a.beat !== b.beat) return a.beat - b.beat;
    if (a.type === "note" && b.type === "note") return (a.midi ?? 0) - (b.midi ?? 0);
    return (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
  });
  return events;
}

// src/midi.js
var import_midi_file = __toESM(require_midi_file(), 1);
var DEFAULT_BPM = 120;
var MICROSECONDS_PER_MINUTE = 6e7;
function semitonesToBend(semitones, pbrange) {
  const r = pbrange || 2;
  const n = Math.max(-r, Math.min(r, semitones));
  return n / r;
}
function bendToMidi14(zeroOne) {
  const v = Math.max(-1, Math.min(1, zeroOne));
  return Math.round((v + 1) * 8191.5) - 8192;
}
function eventsToMidi(events, state) {
  const bpm = state.bpm ?? DEFAULT_BPM;
  const ppqn = state.ppqn ?? 480;
  const tracks = state.tracks || [];
  const timesig = state.timesig || { num: 4, denom: 4 };
  const midiTracks = [];
  for (let ti = 0; ti < tracks.length; ti++) {
    const trackState = tracks[ti];
    const defaultChannel = (trackState.channel ?? 1) - 1;
    const pbrange = trackState.pbrange ?? 2;
    const trackEvents = events.filter(
      (e) => (e.type === "note" || e.type === "cc" || e.type === "pb") && e.trackIndex === ti
    );
    const hasPB = trackEvents.some((e) => e.type === "pb");
    const metaEvents = events.filter((e) => (e.type === "tempo" || e.type === "ts") && e.trackIndex === 0);
    const lmpBeatToTick = (b) => Math.max(0, beatToTicks(b - 1, bpm, ppqn));
    const withTicks = [];
    for (const e of trackEvents) {
      withTicks.push({ ...e, tick: lmpBeatToTick(e.beat) });
    }
    for (const e of metaEvents) {
      if (ti === 0) withTicks.push({ ...e, tick: lmpBeatToTick(e.beat) });
    }
    if (ti === 0) {
      withTicks.push({ type: "tempo", tick: 0, bpm });
      withTicks.push({ type: "ts", tick: 0, num: timesig.num, denom: timesig.denom });
    }
    if (hasPB) {
      withTicks.push({ type: "pb", tick: 0, semitones: 0, trackIndex: ti });
    }
    const maxTick = withTicks.length ? Math.max(...withTicks.map((e) => e.tick)) : 0;
    if (hasPB) {
      withTicks.push({ type: "pb", tick: maxTick + 1, semitones: 0, trackIndex: ti });
    }
    withTicks.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      const order = { cc: 0, pb: 1, note: 2, tempo: 3, ts: 4 };
      return (order[a.type] ?? 5) - (order[b.type] ?? 5);
    });
    const flatEvents = [];
    for (const ev of withTicks) {
      if (ev.type === "note") {
        const startTick = lmpBeatToTick(ev.beat);
        const endTick = lmpBeatToTick(ev.beat + (ev.duration ?? 0.25));
        const durationTicks = Math.max(1, endTick - startTick);
        flatEvents.push({ type: "noteOn", tick: startTick, ev, durationTicks });
        flatEvents.push({ type: "noteOff", tick: startTick + durationTicks, ev });
      } else {
        flatEvents.push({ type: ev.type, tick: ev.tick, ev });
      }
    }
    flatEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return (a.type === "noteOn" ? 0 : 1) - (b.type === "noteOn" ? 0 : 1);
    });
    const trackEventsOut = [];
    let lastTick = 0;
    trackEventsOut.push({
      deltaTime: 0,
      type: "trackName",
      text: trackState.name ?? `Track_${ti + 1}`
    });
    if (trackState.program !== void 0) {
      trackEventsOut.push({
        deltaTime: 0,
        type: "programChange",
        channel: defaultChannel,
        programNumber: trackState.program
      });
    }
    for (const { type, tick, ev } of flatEvents) {
      const delta = tick - lastTick;
      if (type === "tempo") {
        trackEventsOut.push({
          deltaTime: delta,
          type: "setTempo",
          microsecondsPerBeat: Math.round(MICROSECONDS_PER_MINUTE / (ev.bpm ?? bpm))
        });
        lastTick = tick;
        continue;
      }
      if (type === "ts") {
        trackEventsOut.push({
          deltaTime: delta,
          type: "timeSignature",
          numerator: ev.num ?? 4,
          denominator: ev.denom ?? 4,
          metronome: 24,
          thirtyseconds: 8
        });
        lastTick = tick;
        continue;
      }
      if (type === "cc") {
        trackEventsOut.push({
          deltaTime: delta,
          type: "controller",
          channel: (ev.channel ?? trackState.channel ?? 1) - 1,
          controllerType: ev.number,
          value: ev.value
        });
        lastTick = tick;
        continue;
      }
      if (type === "pb") {
        const ch = (ev.channel ?? trackState.channel ?? 1) - 1;
        const bend = semitonesToBend(ev.semitones ?? 0, pbrange);
        trackEventsOut.push({
          deltaTime: delta,
          type: "pitchBend",
          channel: ch,
          value: bendToMidi14(bend)
        });
        lastTick = tick;
        continue;
      }
      if (type === "noteOn") {
        const ch = (ev.channel ?? trackState.channel ?? 1) - 1;
        const velocity = Math.max(1, Math.min(127, ev.velocity ?? 100));
        trackEventsOut.push({
          deltaTime: delta,
          type: "noteOn",
          channel: ch,
          noteNumber: ev.midi,
          velocity
        });
        lastTick = tick;
        continue;
      }
      if (type === "noteOff") {
        const ch = (ev.channel ?? trackState.channel ?? 1) - 1;
        trackEventsOut.push({
          deltaTime: delta,
          type: "noteOff",
          channel: ch,
          noteNumber: ev.midi,
          velocity: 0
        });
        lastTick = tick;
      }
    }
    trackEventsOut.push({
      deltaTime: 0,
      type: "endOfTrack"
    });
    midiTracks.push(trackEventsOut);
  }
  const midiData = {
    header: {
      format: 1,
      numTracks: midiTracks.length,
      ticksPerBeat: ppqn
    },
    tracks: midiTracks
  };
  const bytes = (0, import_midi_file.writeMidi)(midiData);
  return new Uint8Array(bytes);
}

// src/decompile.js
var import_midi_file2 = __toESM(require_midi_file(), 1);
function tickToLmpBeat(tick, ppqn) {
  return ticksToBeat(tick, ppqn) + 1;
}
var DEFAULT_BPM2 = 120;
var DEFAULT_PPQN2 = 480;
var DEFAULT_PBRANGE2 = 2;
function microsecondsToBpm(microsecondsPerBeat) {
  if (!microsecondsPerBeat || microsecondsPerBeat <= 0) return DEFAULT_BPM2;
  return Math.round(6e7 / microsecondsPerBeat);
}
function pitchBendToSemitones(value, pbrange = DEFAULT_PBRANGE2) {
  const normalized = value / 8192;
  return Math.round(normalized * pbrange * 100) / 100;
}
function extractEvents(parsed) {
  const ppqn = parsed.header?.ticksPerBeat ?? DEFAULT_PPQN2;
  let bpm = DEFAULT_BPM2;
  let timesig = { num: 4, denom: 4 };
  const allEvents = [];
  const pendingNoteOns = /* @__PURE__ */ new Map();
  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const track = parsed.tracks[ti];
    let tick = 0;
    for (const ev of track) {
      tick += ev.deltaTime ?? 0;
      if (ev.type === "setTempo") {
        bpm = microsecondsToBpm(ev.microsecondsPerBeat);
        allEvents.push({ type: "tempo", trackIndex: ti, tick, bpm });
        continue;
      }
      if (ev.type === "timeSignature") {
        timesig = { num: ev.numerator ?? 4, denom: ev.denominator ?? 4 };
        allEvents.push({ type: "ts", trackIndex: ti, tick, numerator: timesig.num, denominator: timesig.denom });
        continue;
      }
      if (ev.type === "programChange") {
        allEvents.push({ type: "programChange", trackIndex: ti, tick, channel: ev.channel, programNumber: ev.programNumber });
        continue;
      }
      if (ev.type === "controller") {
        allEvents.push({
          type: "cc",
          trackIndex: ti,
          tick,
          channel: ev.channel,
          controllerType: ev.controllerType,
          value: ev.value
        });
        continue;
      }
      if (ev.type === "pitchBend") {
        allEvents.push({
          type: "pb",
          trackIndex: ti,
          tick,
          channel: ev.channel,
          value: ev.value
        });
        continue;
      }
      if (ev.type === "noteOn") {
        const ch = ev.channel ?? 0;
        if (!pendingNoteOns.has(ti)) pendingNoteOns.set(ti, /* @__PURE__ */ new Map());
        const byCh = pendingNoteOns.get(ti);
        if (!byCh.has(ch)) byCh.set(ch, /* @__PURE__ */ new Map());
        byCh.get(ch).set(ev.noteNumber, { tick, velocity: ev.velocity ?? 64 });
        continue;
      }
      if (ev.type === "noteOff") {
        const ch = ev.channel ?? 0;
        const byCh = pendingNoteOns.get(ti)?.get(ch);
        const on = byCh?.get(ev.noteNumber);
        if (on) {
          allEvents.push({
            type: "note",
            trackIndex: ti,
            tick: on.tick,
            channel: ch,
            noteNumber: ev.noteNumber,
            velocity: on.velocity,
            durationTicks: tick - on.tick
          });
          byCh.delete(ev.noteNumber);
        }
        continue;
      }
    }
  }
  return { events: allEvents, ppqn, bpm, timesig };
}
function groupAndSort(events, ppqn) {
  const byTrack = /* @__PURE__ */ new Map();
  for (const e of events) {
    const ti = e.trackIndex;
    if (!byTrack.has(ti)) byTrack.set(ti, []);
    byTrack.get(ti).push(e);
  }
  const order = { cc: 0, pb: 1, note: 2, tempo: 3, ts: 4, programChange: 5 };
  for (const arr of byTrack.values()) {
    arr.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return (order[a.type] ?? 6) - (order[b.type] ?? 6);
    });
  }
  return byTrack;
}
function decompile(midiBuffer, options = {}) {
  const preferSpn = options?.preferSpn !== false;
  const precision = options?.precision ?? 3;
  const buffer = midiBuffer instanceof Uint8Array ? midiBuffer : typeof Buffer !== "undefined" && Buffer.isBuffer(midiBuffer) ? new Uint8Array(midiBuffer) : new Uint8Array(Array.from(midiBuffer));
  const parsed = (0, import_midi_file2.parseMidi)(buffer);
  const { events, ppqn, bpm, timesig } = extractEvents(parsed);
  const byTrack = groupAndSort(events, ppqn);
  const lines = [];
  lines.push("@LMP 1.0");
  lines.push(`@BPM ${bpm}`);
  lines.push(`@TIMESIG ${timesig.num}/${timesig.denom}`);
  lines.push(`@PPQN ${ppqn}`);
  lines.push("");
  const roundBeat = (b) => Math.round(b * Math.pow(10, precision)) / Math.pow(10, precision);
  for (let ti = 0; ti < parsed.tracks.length; ti++) {
    const trackEvents = byTrack.get(ti) ?? [];
    const hasNotes = trackEvents.some((e) => e.type === "note");
    const hasCC = trackEvents.some((e) => e.type === "cc");
    const hasPB = trackEvents.some((e) => e.type === "pb");
    const hasTempo = trackEvents.some((e) => e.type === "tempo");
    const hasTS = trackEvents.some((e) => e.type === "ts");
    if (!hasNotes && !hasCC && !hasPB && !hasTempo && !hasTS) continue;
    const channel = trackEvents.find((e) => e.channel !== void 0)?.channel ?? 0;
    const displayChannel = channel + 1;
    const effectiveChannel = hasNotes || hasCC || hasPB ? displayChannel : 1;
    const program = trackEvents.find((e) => e.type === "programChange")?.programNumber;
    const trackName = `Track_${ti + 1}`;
    lines.push(`@TRACK ${ti + 1} ${trackName}`);
    lines.push(`@CHANNEL ${effectiveChannel}`);
    if (program !== void 0) lines.push(`@PROGRAM ${program}`);
    lines.push("");
    const noteGroups = /* @__PURE__ */ new Map();
    const ccAtTick = [];
    const pbAtTick = [];
    const tempoAtTick = [];
    const tsAtTick = [];
    for (const e of trackEvents) {
      const beat = roundBeat(tickToLmpBeat(e.tick, ppqn));
      if (e.type === "note") {
        if (!noteGroups.has(e.tick)) noteGroups.set(e.tick, []);
        noteGroups.get(e.tick).push({
          noteNumber: e.noteNumber,
          velocity: e.velocity,
          durationTicks: e.durationTicks
        });
      } else if (e.type === "cc") {
        ccAtTick.push({ beat, ...e });
      } else if (e.type === "pb") {
        pbAtTick.push({ beat, ...e });
      } else if (e.type === "tempo") {
        tempoAtTick.push({ beat, ...e });
      } else if (e.type === "ts") {
        tsAtTick.push({ beat, ...e });
      }
    }
    const allBeats = /* @__PURE__ */ new Set();
    for (const e of trackEvents) {
      const beat = roundBeat(tickToLmpBeat(e.tick, ppqn));
      if (["note", "cc", "pb", "tempo", "ts"].includes(e.type)) allBeats.add(beat);
    }
    const sortedBeats = [...allBeats].sort((a, b) => a - b);
    for (const beat of sortedBeats) {
      const tick = Math.round((beat - 1) * ppqn);
      for (const e of tempoAtTick.filter((x) => x.beat === beat)) {
        lines.push(`${beat} TEMPO ${e.bpm}`);
      }
      for (const e of tsAtTick.filter((x) => x.beat === beat)) {
        lines.push(`${beat} TS ${e.numerator ?? 4} ${e.denominator ?? 4}`);
      }
      for (const e of ccAtTick.filter((x) => x.beat === beat)) {
        lines.push(`${beat} CC ${e.controllerType} ${e.value}`);
      }
      for (const e of pbAtTick.filter((x) => x.beat === beat)) {
        const semitones = pitchBendToSemitones(e.value);
        lines.push(`${beat} PB ${semitones}`);
      }
      const notes = noteGroups.get(tick) ?? [];
      if (notes.length > 0) {
        notes.sort((a, b) => a.noteNumber - b.noteNumber);
        const isDrum = displayChannel === 10;
        const pitchStr = notes.map((n) => isDrum || !preferSpn ? String(n.noteNumber) : midiToSpn(n.noteNumber) ?? String(n.noteNumber)).join(",");
        const vel = notes[0].velocity;
        const durTicks = notes[0].durationTicks ?? ppqn / 4;
        const durBeats = Math.round(durTicks / ppqn * 1e3) / 1e3;
        lines.push(`${beat} ${pitchStr} ${vel} ${durBeats}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

// src/index.js
var import_midi_file3 = __toESM(require_midi_file(), 1);
function compile(lmpText, options = {}) {
  const loose = options?.loose === true;
  const withSourceMap = options?.sourceMap === true;
  const warnings = loose ? [] : void 0;
  const opts = loose ? { loose: true, warnings } : {};
  const lines = preprocess(lmpText);
  const state = buildState(lines, opts);
  const events = expand(lines, state, opts);
  const midi = eventsToMidi(events, state);
  if (withSourceMap) {
    const sourceMap = /* @__PURE__ */ new Map();
    for (const e of events) {
      if (e.type === "note" && e.sourceLine != null) {
        const b = Math.round(e.beat * 1e3) / 1e3;
        const key = `${b}_${e.trackIndex}_${e.midi}`;
        sourceMap.set(key, e.sourceLine);
      }
    }
    if (loose) return { midi, warnings, sourceMap };
    return { midi, sourceMap };
  }
  if (loose) return { midi, warnings };
  return midi;
}
var index_default = { compile, decompile, parseMidi: import_midi_file3.parseMidi };
var export_parseMidi = import_midi_file3.parseMidi;
export {
  compile,
  decompile,
  index_default as default,
  export_parseMidi as parseMidi
};
//# sourceMappingURL=lmp-core.v1.js.map
