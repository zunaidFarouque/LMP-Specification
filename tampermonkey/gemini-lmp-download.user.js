// ==UserScript==
// @name         AI to MIDI / LMP Playground & Downloader
// @namespace    https://github.com/zunaidFarouque/LMP-Specification
// @version      2.0.0
// @description  Detects Lean Musical Protocol (LMP) blocks on Gemini, ChatGPT, and Claude. Injects instant Play (WebAudio synth) and MIDI download buttons directly into the chat interface!
// @author       Zunaid Farouque
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @grant        GM_download
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  // --- 1. Bundled LMP Compiler Core ---
  /* LMP-Core v1 — Lean Musical Protocol compiler */
var LMP=(()=>{var De=Object.create;var J=Object.defineProperty;var $e=Object.getOwnPropertyDescriptor;var _e=Object.getOwnPropertyNames;var Ve=Object.getPrototypeOf,Ge=Object.prototype.hasOwnProperty;var ne=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports),qe=(e,t)=>{for(var r in t)J(e,r,{get:t[r],enumerable:!0})},ke=(e,t,r,a)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of _e(t))!Ge.call(e,i)&&i!==r&&J(e,i,{get:()=>t[i],enumerable:!(a=$e(t,i))||a.enumerable});return e};var re=(e,t,r)=>(r=e!=null?De(Ve(e)):{},ke(t||!e||!e.__esModule?J(r,"default",{value:e,enumerable:!0}):r,e)),He=e=>ke(J({},"__esModule",{value:!0}),e);var Fe=ne((Et,we)=>{function rt(e){var t=new O(e),r=t.readChunk();if(r.id!="MThd")throw"Bad MIDI file.  Expected 'MHdr', got: '"+r.id+"'";for(var a=it(r.data),i=[],o=0;!t.eof()&&o<a.numTracks;o++){var n=t.readChunk();if(n.id!="MTrk")throw"Bad MIDI file.  Expected 'MTrk', got: '"+n.id+"'";var f=ot(n.data);i.push(f)}return{header:a,tracks:i}}function it(e){var t=new O(e),r=t.readUInt16(),a=t.readUInt16(),i={format:r,numTracks:a},o=t.readUInt16();return o&32768?(i.framesPerSecond=256-(o>>8),i.ticksPerFrame=o&255):i.ticksPerBeat=o,i}function ot(e){for(var t=new O(e),r=[];!t.eof();){var a=o();r.push(a)}return r;var i;function o(){var n={};n.deltaTime=t.readVarInt();var f=t.readUInt8();if((f&240)===240)if(f===255){n.meta=!0;var d=t.readUInt8(),l=t.readVarInt();switch(d){case 0:if(n.type="sequenceNumber",l!==2)throw"Expected length for sequenceNumber event is 2, got "+l;return n.number=t.readUInt16(),n;case 1:return n.type="text",n.text=t.readString(l),n;case 2:return n.type="copyrightNotice",n.text=t.readString(l),n;case 3:return n.type="trackName",n.text=t.readString(l),n;case 4:return n.type="instrumentName",n.text=t.readString(l),n;case 5:return n.type="lyrics",n.text=t.readString(l),n;case 6:return n.type="marker",n.text=t.readString(l),n;case 7:return n.type="cuePoint",n.text=t.readString(l),n;case 32:if(n.type="channelPrefix",l!=1)throw"Expected length for channelPrefix event is 1, got "+l;return n.channel=t.readUInt8(),n;case 33:if(n.type="portPrefix",l!=1)throw"Expected length for portPrefix event is 1, got "+l;return n.port=t.readUInt8(),n;case 47:if(n.type="endOfTrack",l!=0)throw"Expected length for endOfTrack event is 0, got "+l;return n;case 81:if(n.type="setTempo",l!=3)throw"Expected length for setTempo event is 3, got "+l;return n.microsecondsPerBeat=t.readUInt24(),n;case 84:if(n.type="smpteOffset",l!=5)throw"Expected length for smpteOffset event is 5, got "+l;var s=t.readUInt8(),c={0:24,32:25,64:29,96:30};return n.frameRate=c[s&96],n.hour=s&31,n.min=t.readUInt8(),n.sec=t.readUInt8(),n.frame=t.readUInt8(),n.subFrame=t.readUInt8(),n;case 88:if(n.type="timeSignature",l!=2&&l!=4)throw"Expected length for timeSignature event is 4 or 2, got "+l;return n.numerator=t.readUInt8(),n.denominator=1<<t.readUInt8(),l===4?(n.metronome=t.readUInt8(),n.thirtyseconds=t.readUInt8()):(n.metronome=36,n.thirtyseconds=8),n;case 89:if(n.type="keySignature",l!=2)throw"Expected length for keySignature event is 2, got "+l;return n.key=t.readInt8(),n.scale=t.readUInt8(),n;case 127:return n.type="sequencerSpecific",n.data=t.readBytes(l),n;default:return n.type="unknownMeta",n.data=t.readBytes(l),n.metatypeByte=d,n}}else if(f==240){n.type="sysEx";var l=t.readVarInt();return n.data=t.readBytes(l),n}else if(f==247){n.type="endSysEx";var l=t.readVarInt();return n.data=t.readBytes(l),n}else throw"Unrecognised MIDI event type byte: "+f;else{var u;if(f&128)u=t.readUInt8(),i=f;else{if(i===null)throw"Running status byte encountered before status byte";u=f,f=i,n.running=!0}var p=f>>4;switch(n.channel=f&15,p){case 8:return n.type="noteOff",n.noteNumber=u,n.velocity=t.readUInt8(),n;case 9:var m=t.readUInt8();return n.type=m===0?"noteOff":"noteOn",n.noteNumber=u,n.velocity=m,m===0&&(n.byte9=!0),n;case 10:return n.type="noteAftertouch",n.noteNumber=u,n.amount=t.readUInt8(),n;case 11:return n.type="controller",n.controllerType=u,n.value=t.readUInt8(),n;case 12:return n.type="programChange",n.programNumber=u,n;case 13:return n.type="channelAftertouch",n.amount=u,n;case 14:return n.type="pitchBend",n.value=u+(t.readUInt8()<<7)-8192,n;default:throw"Unrecognised MIDI event type: "+p}}}}function O(e){this.buffer=e,this.bufferLen=this.buffer.length,this.pos=0}O.prototype.eof=function(){return this.pos>=this.bufferLen};O.prototype.readUInt8=function(){var e=this.buffer[this.pos];return this.pos+=1,e};O.prototype.readInt8=function(){var e=this.readUInt8();return e&128?e-256:e};O.prototype.readUInt16=function(){var e=this.readUInt8(),t=this.readUInt8();return(e<<8)+t};O.prototype.readInt16=function(){var e=this.readUInt16();return e&32768?e-65536:e};O.prototype.readUInt24=function(){var e=this.readUInt8(),t=this.readUInt8(),r=this.readUInt8();return(e<<16)+(t<<8)+r};O.prototype.readInt24=function(){var e=this.readUInt24();return e&8388608?e-16777216:e};O.prototype.readUInt32=function(){var e=this.readUInt8(),t=this.readUInt8(),r=this.readUInt8(),a=this.readUInt8();return(e<<24)+(t<<16)+(r<<8)+a};O.prototype.readBytes=function(e){var t=this.buffer.slice(this.pos,this.pos+e);return this.pos+=e,t};O.prototype.readString=function(e){var t=this.readBytes(e);return String.fromCharCode.apply(null,t)};O.prototype.readVarInt=function(){for(var e=0;!this.eof();){var t=this.readUInt8();if(t&128)e+=t&127,e<<=7;else return e+t}return e};O.prototype.readChunk=function(){var e=this.readString(4),t=this.readUInt32(),r=this.readBytes(t);return{id:e,length:t,data:r}};we.exports=rt});var Ee=ne((Rt,Pe)=>{function st(e,t){if(typeof e!="object")throw"Invalid MIDI data";t=t||{};var r=e.header||{},a=e.tracks||[],i,o=a.length,n=new C;for(at(n,r,o),i=0;i<o;i++)ct(n,a[i],t);return n.buffer}function at(e,t,r){var a=t.format==null?1:t.format,i=128;t.timeDivision?i=t.timeDivision:t.ticksPerFrame&&t.framesPerSecond?i=-(t.framesPerSecond&255)<<8|t.ticksPerFrame&255:t.ticksPerBeat&&(i=t.ticksPerBeat&32767);var o=new C;o.writeUInt16(a),o.writeUInt16(r),o.writeUInt16(i),e.writeChunk("MThd",o.buffer)}function ct(e,t,r){var a=new C,i,o=t.length,n=null;for(i=0;i<o;i++)(r.running===!1||!r.running&&!t[i].running)&&(n=null),n=ut(a,t[i],n,r.useByte9ForNoteOff);e.writeChunk("MTrk",a.buffer)}function ut(e,t,r,a){var i=t.type,o=t.deltaTime,n=t.text||"",f=t.data||[],d=null;switch(e.writeVarInt(o),i){case"sequenceNumber":e.writeUInt8(255),e.writeUInt8(0),e.writeVarInt(2),e.writeUInt16(t.number);break;case"text":e.writeUInt8(255),e.writeUInt8(1),e.writeVarInt(n.length),e.writeString(n);break;case"copyrightNotice":e.writeUInt8(255),e.writeUInt8(2),e.writeVarInt(n.length),e.writeString(n);break;case"trackName":e.writeUInt8(255),e.writeUInt8(3),e.writeVarInt(n.length),e.writeString(n);break;case"instrumentName":e.writeUInt8(255),e.writeUInt8(4),e.writeVarInt(n.length),e.writeString(n);break;case"lyrics":e.writeUInt8(255),e.writeUInt8(5),e.writeVarInt(n.length),e.writeString(n);break;case"marker":e.writeUInt8(255),e.writeUInt8(6),e.writeVarInt(n.length),e.writeString(n);break;case"cuePoint":e.writeUInt8(255),e.writeUInt8(7),e.writeVarInt(n.length),e.writeString(n);break;case"channelPrefix":e.writeUInt8(255),e.writeUInt8(32),e.writeVarInt(1),e.writeUInt8(t.channel);break;case"portPrefix":e.writeUInt8(255),e.writeUInt8(33),e.writeVarInt(1),e.writeUInt8(t.port);break;case"endOfTrack":e.writeUInt8(255),e.writeUInt8(47),e.writeVarInt(0);break;case"setTempo":e.writeUInt8(255),e.writeUInt8(81),e.writeVarInt(3),e.writeUInt24(t.microsecondsPerBeat);break;case"smpteOffset":e.writeUInt8(255),e.writeUInt8(84),e.writeVarInt(5);var l={24:0,25:32,29:64,30:96},s=t.hour&31|l[t.frameRate];e.writeUInt8(s),e.writeUInt8(t.min),e.writeUInt8(t.sec),e.writeUInt8(t.frame),e.writeUInt8(t.subFrame);break;case"timeSignature":e.writeUInt8(255),e.writeUInt8(88),e.writeVarInt(4),e.writeUInt8(t.numerator);var c=Math.floor(Math.log(t.denominator)/Math.LN2)&255;e.writeUInt8(c),e.writeUInt8(t.metronome),e.writeUInt8(t.thirtyseconds||8);break;case"keySignature":e.writeUInt8(255),e.writeUInt8(89),e.writeVarInt(2),e.writeInt8(t.key),e.writeUInt8(t.scale);break;case"sequencerSpecific":e.writeUInt8(255),e.writeUInt8(127),e.writeVarInt(f.length),e.writeBytes(f);break;case"unknownMeta":t.metatypeByte!=null&&(e.writeUInt8(255),e.writeUInt8(t.metatypeByte),e.writeVarInt(f.length),e.writeBytes(f));break;case"sysEx":e.writeUInt8(240),e.writeVarInt(f.length),e.writeBytes(f);break;case"endSysEx":e.writeUInt8(247),e.writeVarInt(f.length),e.writeBytes(f);break;case"noteOff":var u=a!==!1&&t.byte9||a&&t.velocity==0?144:128;d=u|t.channel,d!==r&&e.writeUInt8(d),e.writeUInt8(t.noteNumber),e.writeUInt8(t.velocity);break;case"noteOn":d=144|t.channel,d!==r&&e.writeUInt8(d),e.writeUInt8(t.noteNumber),e.writeUInt8(t.velocity);break;case"noteAftertouch":d=160|t.channel,d!==r&&e.writeUInt8(d),e.writeUInt8(t.noteNumber),e.writeUInt8(t.amount);break;case"controller":d=176|t.channel,d!==r&&e.writeUInt8(d),e.writeUInt8(t.controllerType),e.writeUInt8(t.value);break;case"programChange":d=192|t.channel,d!==r&&e.writeUInt8(d),e.writeUInt8(t.programNumber);break;case"channelAftertouch":d=208|t.channel,d!==r&&e.writeUInt8(d),e.writeUInt8(t.amount);break;case"pitchBend":d=224|t.channel,d!==r&&e.writeUInt8(d);var p=8192+t.value,m=p&127,h=p>>7&127;e.writeUInt8(m),e.writeUInt8(h);break;default:throw"Unrecognized event type: "+i}return d}function C(){this.buffer=[]}C.prototype.writeUInt8=function(e){this.buffer.push(e&255)};C.prototype.writeInt8=C.prototype.writeUInt8;C.prototype.writeUInt16=function(e){var t=e>>8&255,r=e&255;this.writeUInt8(t),this.writeUInt8(r)};C.prototype.writeInt16=C.prototype.writeUInt16;C.prototype.writeUInt24=function(e){var t=e>>16&255,r=e>>8&255,a=e&255;this.writeUInt8(t),this.writeUInt8(r),this.writeUInt8(a)};C.prototype.writeInt24=C.prototype.writeUInt24;C.prototype.writeUInt32=function(e){var t=e>>24&255,r=e>>16&255,a=e>>8&255,i=e&255;this.writeUInt8(t),this.writeUInt8(r),this.writeUInt8(a),this.writeUInt8(i)};C.prototype.writeInt32=C.prototype.writeUInt32;C.prototype.writeBytes=function(e){this.buffer=this.buffer.concat(Array.prototype.slice.call(e,0))};C.prototype.writeString=function(e){var t,r=e.length,a=[];for(t=0;t<r;t++)a.push(e.codePointAt(t));this.writeBytes(a)};C.prototype.writeVarInt=function(e){if(e<0)throw"Cannot write negative variable-length integer";if(e<=127)this.writeUInt8(e);else{var t=e,r=[];for(r.push(t&127),t>>=7;t;){var a=t&127|128;r.push(a),t>>=7}this.writeBytes(r.reverse())}};C.prototype.writeChunk=function(e,t){this.writeString(e),this.writeUInt32(t.length),this.writeBytes(t)};Pe.exports=st});var ee=ne(pe=>{pe.parseMidi=Fe();pe.writeMidi=Ee()});var Nt={};qe(Nt,{compile:()=>Le,decompile:()=>de,default:()=>xt,parseMidi:()=>me.parseMidi});function Ke(e){let t=e.indexOf("//");return t===-1?e:e.slice(0,t)}function je(e){if(!e.length)return"blank";let t=e[0];return t.startsWith("@")?"header":t==="+"?"continuation":t==="|"?"modifier":"event"}var ze=/^\s*\d+[\.)](?!\d)/;function be(e){let t=e.split(/\r?\n/),r=[],a=!1,i=!1;for(let o=0;o<t.length;o++){let n=t[o];if(n.trim()===""){a=!0,i=!0;continue}let d=Ke(n),l=d.trim();if(!l)continue;if(a){if(ze.test(d)||!/^\s*(@|\d|\+|\|)/.test(d))continue;a=!1}let s=l.split(/\s+/);if(s.length===0)continue;let c=je(s),u=n.match(/^\s*/),p=(u?u[0].length:0)+1;r.push({type:c,tokens:s,sourceLine:o+1,sourceCol:p,blankBefore:i}),i=!1}return r}var Ze={num:4,denom:4},Xe=2,Qe=/^[A-Za-z0-9_]+$/,We=/^[A-Za-z_][A-Za-z0-9_]*$/,z=class extends Error{constructor(t,r={}){super(t),this.name="LMPError",r.sourceLine!=null?this.line=r.sourceLine:r.line!=null&&(this.line=r.line),r.sourceCol!=null?this.col=r.sourceCol:r.col!=null&&(this.col=r.col)}};function _(e,t){return new z(e,t)}function Ie(e,t={}){let{loose:r=!1,warnings:a=[]}=t,i={version:void 0,bpm:void 0,timesig:{...Ze},ppqn:480,origin:void 0,seed:void 0,tracks:[],map:Object.create(null)},o=-1;for(let n of e){let{type:f,tokens:d}=n;if(f==="event"||f==="continuation"||f==="modifier"){if(i.tracks.length===0)throw _("LMP: Events must appear after at least one @TRACK declaration.",n);let c=i.tracks[o];if(c&&c.channel===void 0)if(r)c.channel=1,a.push(`LMP [loose]: Track ${c.id} (${c.name}) missing @CHANNEL; assuming channel 1`);else throw _("LMP: Each track must declare @CHANNEL before events.",n);continue}if(f!=="header"||!d.length)continue;let l=d[0].toUpperCase(),s=d.slice(1);switch(l){case"@LMP":s[0]&&(i.version=s[0]);break;case"@BPM":s[0]!==void 0&&(i.bpm=parseFloat(s[0],10));break;case"@ORIGIN":if(s[0]!==void 0){let c=parseInt(s[0],10);if(c===0||c===1)i.origin=c;else throw _("LMP: @ORIGIN must be 0 or 1.",n)}break;case"@SEED":if(s[0]!==void 0){let c=parseInt(s[0],10);isNaN(c)||(i.seed=c)}break;case"@TIMESIG":if(s[0]){let c=s[0].split("/");if(c.length>=2){let u=parseInt(c[0],10),p=parseInt(c[1],10);!isNaN(u)&&!isNaN(p)&&(i.timesig={num:u,denom:p})}}break;case"@PPQN":if(s[0]!==void 0){let c=parseInt(s[0],10);isNaN(c)||(i.ppqn=c)}break;case"@TRACK":{let c=s[0]!==void 0?parseInt(s[0],10):NaN,u=s[1];if(!u||!Qe.test(u))throw _("LMP: @TRACK requires a name (alphanumeric and underscores only).",n);if(isNaN(c))throw _("LMP: @TRACK requires a track number.",n);let p=o>=0?i.tracks[o]:null;i.tracks.push({id:c,name:u,channel:void 0,program:void 0,pbrange:Xe,defaultVel:p?.defaultVel,defaultDur:p?.defaultDur,rules:p?.rules?p.rules.map(m=>({...m})):[]}),o=i.tracks.length-1;break}case"@CHANNEL":if(o>=0&&s[0]!==void 0){let c=parseInt(s[0],10);c>=1&&c<=16&&(i.tracks[o].channel=c)}break;case"@PROGRAM":if(o>=0&&s[0]!==void 0){let c=parseInt(s[0],10);c>=0&&c<=127&&(i.tracks[o].program=c)}break;case"@PBRANGE":if(o>=0&&s[0]!==void 0){let c=parseInt(s[0],10);isNaN(c)||(i.tracks[o].pbrange=c)}break;case"@MAP":{let c=s[0];if(!c||!c.includes("="))break;let[u,p]=c.split("=").map(h=>h.trim());if(!u||!We.test(u))throw _("LMP: @MAP name must be alphanumeric and underscores only, and cannot start with a digit.",n);let m=parseInt(p,10);!Number.isNaN(m)&&m>=0&&m<=127&&(i.map[u]=m);break}case"@INHERIT":{if(o<0||s[0]===void 0)break;let c=parseInt(s[0],10),u=i.tracks.findIndex(T=>T.id===c);if(u<0){if(r){a.push(`LMP [loose]: @INHERIT from non-existent track ${c}; skipping`);break}throw _("LMP: @INHERIT from non-existent track.",n)}if(u===o){if(r){a.push(`LMP [loose]: @INHERIT from same track (${c}) is invalid; skipping`);break}throw _("LMP: @INHERIT from same track is invalid.",n)}if(u>o){if(r){a.push(`LMP [loose]: @INHERIT from track ${c} declared later is invalid; skipping`);break}throw _("LMP: @INHERIT from track declared later is invalid.",n)}let p=i.tracks[u],m=s[1]?s[1].toUpperCase().split(",").map(T=>T.trim()):["VEL","DUR","CHANNEL","PROGRAM","PBRANGE","RULE"],h=i.tracks[o];m.includes("VEL")&&(h.defaultVel=p.defaultVel),m.includes("DUR")&&(h.defaultDur=p.defaultDur),m.includes("CHANNEL")&&(h.channel=p.channel),m.includes("PROGRAM")&&(h.program=p.program),m.includes("PBRANGE")&&(h.pbrange=p.pbrange),m.includes("RULE")&&(h.rules=[...p.rules||[]]);break}case"@RESET_TRACK":o>=0&&(i.tracks[o].defaultVel=void 0,i.tracks[o].defaultDur=void 0,i.tracks[o].rules=[]);break;case"@DEFAULT_VEL":if(o>=0&&s[0]!==void 0){let c=parseInt(s[0],10);isNaN(c)||(i.tracks[o].defaultVel=Math.max(1,Math.min(127,c)))}break;case"@DEFAULT_DUR":if(o>=0&&s[0]!==void 0){let c=parseFloat(s[0],10);isNaN(c)||(i.tracks[o].defaultDur=c)}break;case"@RULE":if(o>=0&&s.length>=1){if(s.join(" ").toUpperCase().includes("LEGATO=TRUE")){i.tracks[o].legato=!0;break}let u=s[0],p=s.slice(1).join(" ").toUpperCase(),m=p.match(/VEL=(\d+)-(\d+)/),h=p.match(/DUR=([\d.]+)/),T={};m&&(T.velRange=[parseInt(m[1],10),parseInt(m[2],10)]),h&&(T.dur=parseFloat(h[1],10)),Object.keys(T).length&&(i.tracks[o].rules=i.tracks[o].rules||[],i.tracks[o].rules.push({pitch:u,...T}))}break;default:break}}return i}var ye=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],Ye=/^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/i;function ge(e){if(!e||typeof e!="string")return;let t=e.trim().match(Ye);if(!t)return;let r=ye.indexOf(t[1].toUpperCase());if(r===-1)return;let a=t[2];a&&(a.startsWith("b")?r-=a.length:r+=a.length),r=(r%12+12)%12;let o=(parseInt(t[3],10)+1)*12+r;if(!(o<0||o>127))return o}function xe(e,t,r){if(t<=0)return 0;let i=1/(t/60),n=e*r;return Math.round(n)}function ie(e){if(typeof e!="number"||e<0||e>127)return;let t=Math.round(e),r=ye[t%12],a=Math.floor(t/12)-1;return`${r}${a}`}function Ne(e,t){if(t<=0)return 0;let r=e/t;return Math.round(r*1e3)/1e3}var oe=100,K=.25,Je=new Set(["R","CC","PB","TEMPO","TS"]),ve={cc:0,pb:1,note:2,rest:3,tempo:4,ts:5};function V(e,t){return new z(e,t)}function et(e){let t=(e??123456789)>>>0;return function(){t=t+1831565813>>>0;let r=Math.imul(t^t>>>15,1|t);return r=r+Math.imul(r^r>>>7,61|r)^r,((r^r>>>14)>>>0)/4294967296}}function tt(e){let t=parseFloat(e,10);return Number.isNaN(t)||t<0?null:Math.round(t*1e3)/1e3}function X(e,t){let r=(e||"").toUpperCase();if(Je.has(r))return{reserved:r};let a=ge(e);if(a!==void 0)return{midi:a};let i=parseInt(e,10);return!Number.isNaN(i)&&i>=0&&i<=127?{midi:i}:t&&t[e]!==void 0?{midi:t[e]}:null}function Ue(e,t){if(!e.rules||!e.rules.length)return null;let r=(t||"").toString().trim(),a=r.toUpperCase();for(let i of e.rules){let o=(i.pitch||"").toString().trim().toUpperCase();if(o===a||o===r)return i;let n=X(i.pitch,{});if(n&&n.midi!==void 0&&X(r,{})?.midi===n.midi)return i}return null}function se(e,t,r){let a=Ue(e,t);if(!a||!a.velRange)return;let[i,o]=a.velRange;return Math.floor(r?i+r()*(o-i+1):(i+o)/2)}function ae(e,t){let r=Ue(e,t);if(!(!r||r.dur===void 0))return r.dur}function ce(e){return e&&e.legato===!0}var Te=/^([\d.]+)-([\d.]+):(.+)$/;function nt(e){let t=(e||"").match(Te);if(!t)return null;let r=parseFloat(t[1],10),a=parseFloat(t[2],10),i=t[3].trim();if(r>=a||Number.isNaN(r)||Number.isNaN(a))return null;let o;if(i.includes("/")){let[f,d]=i.split("/").map(l=>parseInt(l.trim(),10));if(!f||!d||f<=0||d<=0)return null;o=f/d}else if(o=parseFloat(i,10),Number.isNaN(o)||o<=0)return null;let n=[];for(let f=r;f<a-1e-9;f+=o)n.push(Math.round(f*1e3)/1e3);return{start:r,end:a,interval:o,beats:n}}var Z=.01;function ue(e,t){return Math.abs(e-t)<=Z}function fe(e,t){let r=[],a=[],i=[];for(let{tokens:o}of t){let n=o[1];if(n==="R")for(let f=2;f<o.length;f++){let d=parseFloat(o[f],10);Number.isNaN(d)||i.push(d)}else if(n==="V"){let d=o.slice(2).join(" ").split(",").map(l=>l.trim());for(let l of d){let s=l.split(/\s+/),c=parseInt(s[s.length-1],10);if(!Number.isNaN(c))for(let u=0;u<s.length-1;u++){let p=s[u],m=p.match(/^\[([\d.]+)-([\d.]+)\]$/);if(m){let h=parseFloat(m[1],10),T=parseFloat(m[2],10);r.push({type:"range",start:h,end:T,val:c})}else{let h=parseFloat(p.replace(/[\[\]]/g,""),10);Number.isNaN(h)||r.push({type:"single",target:h,val:c})}}}}else if(n==="D"){let d=o.slice(2).join(" ").split(",").map(l=>l.trim());for(let l of d){let s=l.split(/\s+/),c=parseFloat(s[s.length-1],10);if(!Number.isNaN(c))for(let u=0;u<s.length-1;u++){let p=s[u],m=p.match(/^\[([\d.]+)-([\d.]+)\]$/);if(m){let h=parseFloat(m[1],10),T=parseFloat(m[2],10);a.push({type:"range",start:h,end:T,val:c})}else{let h=parseFloat(p.replace(/[\[\]]/g,""),10);Number.isNaN(h)||a.push({type:"single",target:h,val:c})}}}}}for(let o of e){for(let n of r)n.type==="single"?ue(o.beat,n.target)&&(o.velocity=n.val):n.type==="range"&&o.beat>=n.start-Z&&o.beat<n.end-Z&&(o.velocity=n.val);for(let n of a)n.type==="single"?ue(o.beat,n.target)&&(o.duration=n.val):n.type==="range"&&o.beat>=n.start-Z&&o.beat<n.end-Z&&(o.duration=n.val)}return e.filter(o=>{for(let n of i)if(ue(o.beat,n))return!1;return!0})}function Me(e,t,r={}){let{loose:a=!1,warnings:i=[]}=r,o=t.seed!==void 0?et(t.seed):void 0,n=[],f=-1,d=t.map||{},l=null,s=null,c=[];for(let m=0;m<e.length;m++){let h=e[m],{type:T,tokens:k,sourceLine:y,blankBefore:A}=h;if(k.length){if(A){if(s){let N=fe(s,c);n.push(...N),s=null,c=[]}l=null}if(T==="header"){let N=k[0].toUpperCase(),U=k.slice(1);if(N==="@TRACK"&&k[1]!==void 0){let R=parseInt(k[1],10),v=t.tracks.findIndex(x=>x.id===R);v>=0&&(f=v)}if(f>=0){if(N==="@CHANNEL"&&U[0]!==void 0){let R=parseInt(U[0],10);R>=1&&R<=16&&(t.tracks[f].channel=R)}if(N==="@PROGRAM"&&U[0]!==void 0){let R=parseInt(U[0],10);R>=0&&R<=127&&(t.tracks[f].program=R)}}l=null,s=null,c=[];continue}if(T==="continuation"){if(l===null)throw V("LMP: Orphaned same-beat continuation (+).",h);if(f<0)continue;let N=k[1];if(!N)continue;let U=t.tracks[f],R=U.defaultVel!==void 0?U.defaultVel:oe,v=U.defaultDur!==void 0?U.defaultDur:K;if(k[2]!==void 0&&k[2]!=="_"){let F=parseInt(k[2],10);Number.isNaN(F)||(R=Math.max(1,Math.min(127,F)))}if(k[3]!==void 0){let F=parseFloat(k[3],10);Number.isNaN(F)||(v=F)}let x=N.includes(",")?N.split(",").map(F=>F.trim()):[N];for(let F of x){let B=X(F,d);B&&!B.reserved&&n.push({type:"note",trackIndex:f,channel:t.tracks[f]?.channel,beat:l,midi:B.midi,velocity:R,duration:v,sourceLine:y})}continue}if(T==="modifier"){if(s===null)throw V("LMP: Orphaned modifier (|) \u2014 must follow a repeating note.",h);c.push({type:T,tokens:k});continue}if(T==="event"){if(s){let I=fe(s,c);n.push(...I),s=null,c=[]}if(f<0){let I=(k[1]||"").toUpperCase();if(I==="TEMPO"||I==="TS")throw V("LMP: TEMPO and TS must appear after at least one @TRACK.",h);continue}let N=nt(k[0]);if((k[0]||"").match(Te)&&!N){a&&i.push(`LMP [loose]: Invalid repeating range '${k[0]}' (start >= end or invalid interval); skipping`);continue}let U=N?null:tt(k[0]);if(!N&&U===null)continue;let R=(k[1]||"").toUpperCase(),v=X(k[1],d);if(v&&v.reserved){if(v.reserved==="R"){n.push({type:"rest",trackIndex:f,beat:U??N.beats[0]});continue}if(v.reserved==="CC"){if(k[2]==="_"||k[3]==="_"){if(a){i.push(`LMP [loose]: Invalid CC row at beat ${U??k[0]} (underscore invalid); skipping`);continue}throw V("LMP: CC requires numeric controller number and value; underscore is invalid.",h)}if(k[2]===void 0||k[3]===void 0){if(a){i.push(`LMP [loose]: Invalid CC row at beat ${U??k[0]} (missing controller number or value); skipping`);continue}throw V("LMP: CC requires both controller number (column 3) and value (column 4).",h)}let I=parseInt(k[2],10),w=parseInt(k[3],10);if(Number.isNaN(I)||Number.isNaN(w)){if(a){i.push(`LMP [loose]: Invalid CC row at beat ${U??k[0]} (non-numeric controller/value); skipping`);continue}continue}n.push({type:"cc",trackIndex:f,channel:t.tracks[f]?.channel,beat:U??0,number:Math.max(0,Math.min(127,I)),value:Math.max(0,Math.min(127,w))});continue}if(v.reserved==="PB"){let I=k[2]!==void 0?parseFloat(k[2],10):NaN;if(k[2]===void 0||Number.isNaN(I)){if(a){i.push(`LMP [loose]: Invalid PB row at beat ${U??k[0]} (missing or invalid bend value); skipping`);continue}throw V("LMP: PB requires a valid bend value in column 3.",h)}let w=I,P=t.tracks[f]?.pbrange??2,D=Math.max(-P,Math.min(P,w));n.push({type:"pb",trackIndex:f,channel:t.tracks[f]?.channel,beat:U??0,semitones:D});continue}if(v.reserved==="TEMPO"){if(t.tracks.length===0)throw V("LMP: TEMPO must appear after at least one @TRACK.",h);let I=parseFloat(k[2],10);n.push({type:"tempo",trackIndex:0,beat:U??0,bpm:Number.isNaN(I)?120:I});continue}if(v.reserved==="TS"){if(t.tracks.length===0)throw V("LMP: Time signature (TS) must appear after at least one @TRACK.",h);let I=parseInt(k[2],10),w=parseInt(k[3],10);n.push({type:"ts",trackIndex:0,beat:U??0,num:Number.isNaN(I)?4:I,denom:Number.isNaN(w)?4:w});continue}}let x=t.tracks[f],F=k[2]!==void 0&&k[2]!=="_"?(()=>{let I=parseInt(k[2],10);return Number.isNaN(I)?se(x,k[1],o)??x.defaultVel??oe:Math.max(1,Math.min(127,I))})():se(x,k[1],o)??x.defaultVel??oe,B=k[3]!==void 0?(()=>{let I=parseFloat(k[3],10);return Number.isNaN(I)?ae(x,k[1])??x.defaultDur??K:I})():ae(x,k[1])??(ce(x)?void 0:x.defaultDur??K);if(!N&&(k[1]||"").includes(",")){let I=k[1].split(",").map(P=>P.trim()),w=I.map(P=>X(P,d)).filter(P=>P&&!P.reserved);for(let P=0;P<w.length;P++){let D=w[P],Q=se(x,I[P],o)??F,te=ae(x,I[P])??B??x.defaultDur??K;n.push({type:"note",trackIndex:f,channel:x.channel,beat:U,midi:D.midi,velocity:Q,duration:te,sourceLine:y})}l=U;continue}if(N&&v&&!v.reserved){let I=v.midi,w=t.tracks[f]?.channel;s=N.beats.map(D=>({type:"note",trackIndex:f,channel:w,beat:D,midi:I,velocity:F,duration:B,sourceLine:y})),l=null,c=[];continue}if(!v||v.reserved)continue;let b=ce(x)&&B===void 0,M=B!==void 0?B:b?void 0:x.defaultDur??K;n.push({type:"note",trackIndex:f,channel:x.channel,beat:U,midi:v.midi,velocity:F,duration:M,_legato:b,sourceLine:y}),l=U}}}if(s){let m=fe(s,c);n.push(...m)}let p=2/(t.ppqn??480);for(let m=0;m<(t.tracks||[]).length;m++){let h=t.tracks[m];if(!ce(h))continue;let T=n.filter(y=>y.type==="note"&&y.trackIndex===m),k=n.filter(y=>(y.type==="note"||y.type==="rest")&&y.trackIndex===m).map(y=>y.beat).sort((y,A)=>y-A);for(let y of T){if(!y._legato)continue;let A=k.find(N=>N>y.beat);A!==void 0?y.duration=Math.max(.001,A-y.beat-p):y.duration=h.defaultDur??K,delete y._legato}}return n.sort((m,h)=>m.beat!==h.beat?m.beat-h.beat:m.type==="note"&&h.type==="note"?(m.midi??0)-(h.midi??0):(ve[m.type]??9)-(ve[h.type]??9)),n}var Re=re(ee(),1);var ft=120,pt=6e7;function lt(e,t){let r=t||2;return Math.max(-r,Math.min(r,e))/r}function dt(e){let t=Math.max(-1,Math.min(1,e));return Math.round((t+1)*8191.5)-8192}function Se(e,t){let r=t.bpm??ft,a=t.ppqn??480,i=t.tracks||[],o=t.timesig||{num:4,denom:4},n=[];for(let l=0;l<i.length;l++){let s=i[l],c=(s.channel??1)-1,u=s.pbrange??2,p=e.filter(b=>(b.type==="note"||b.type==="cc"||b.type==="pb")&&b.trackIndex===l),m=p.some(b=>b.type==="pb"),h=e.filter(b=>(b.type==="tempo"||b.type==="ts")&&b.trackIndex===0),T=t.origin;T===void 0&&(T=e.some(M=>M.beat!==void 0&&M.beat<1)?0:1);let k=b=>Math.max(0,xe(b-T,r,a)),y=[];if(l===0){h.some(I=>k(I.beat)===0&&I.type==="tempo")||y.push({type:"tempo",tick:0,bpm:r}),h.some(I=>k(I.beat)===0&&I.type==="ts")||y.push({type:"ts",tick:0,num:o.num,denom:o.denom});for(let I of h)y.push({...I,tick:k(I.beat)})}(m||s.pbrange!==void 0&&s.pbrange!==2)&&(y.push({type:"cc",tick:0,channel:s.channel,number:101,value:0}),y.push({type:"cc",tick:0,channel:s.channel,number:100,value:0}),y.push({type:"cc",tick:0,channel:s.channel,number:6,value:u}),y.push({type:"cc",tick:0,channel:s.channel,number:38,value:0}));let A=p.some(b=>b.type==="pb"&&k(b.beat)===0);m&&!A&&y.push({type:"pb",tick:0,semitones:0,trackIndex:l});for(let b of p)y.push({...b,tick:k(b.beat)});let N=p.filter(b=>b.type==="note").map(b=>k(b.beat+(b.duration??.25))),U=y.map(b=>b.tick),R=Math.max(0,...N,...U);m&&y.push({type:"pb",tick:R+1,semitones:0,trackIndex:l});let v=[];for(let b of y)if(b.type==="note"){let M=k(b.beat),I=k(b.beat+(b.duration??.25)),w=Math.max(1,I-M);v.push({type:"noteOn",tick:M,ev:b,durationTicks:w}),v.push({type:"noteOff",tick:M+w,ev:b})}else v.push({type:b.type,tick:b.tick,ev:b});let x={tempo:0,ts:0,cc:1,pb:2,noteOff:3,noteOn:4};v.sort((b,M)=>{if(b.tick!==M.tick)return b.tick-M.tick;let I=x[b.type]??99,w=x[M.type]??99;return I!==w?I-w:b.type==="noteOn"&&M.type==="noteOn"||b.type==="noteOff"&&M.type==="noteOff"?(b.ev.midi??0)-(M.ev.midi??0):0});let F=[],B=0;F.push({deltaTime:0,type:"trackName",text:s.name??`Track_${l+1}`}),s.program!==void 0&&F.push({deltaTime:0,type:"programChange",channel:c,programNumber:s.program});for(let{type:b,tick:M,ev:I}of v){let w=M-B;if(b==="tempo"){F.push({deltaTime:w,type:"setTempo",microsecondsPerBeat:Math.round(pt/(I.bpm??r))}),B=M;continue}if(b==="ts"){F.push({deltaTime:w,type:"timeSignature",numerator:I.num??4,denominator:I.denom??4,metronome:24,thirtyseconds:8}),B=M;continue}if(b==="cc"){F.push({deltaTime:w,type:"controller",channel:(I.channel??s.channel??1)-1,controllerType:I.number,value:I.value}),B=M;continue}if(b==="pb"){let P=(I.channel??s.channel??1)-1,D=lt(I.semitones??0,u);F.push({deltaTime:w,type:"pitchBend",channel:P,value:dt(D)}),B=M;continue}if(b==="noteOn"){let P=(I.channel??s.channel??1)-1,D=Math.max(1,Math.min(127,I.velocity??100));F.push({deltaTime:w,type:"noteOn",channel:P,noteNumber:I.midi,velocity:D}),B=M;continue}if(b==="noteOff"){let P=(I.channel??s.channel??1)-1;F.push({deltaTime:w,type:"noteOff",channel:P,noteNumber:I.midi,velocity:0}),B=M}}F.push({deltaTime:0,type:"endOfTrack"}),n.push(F)}let f={header:{format:1,numTracks:n.length,ticksPerBeat:a},tracks:n},d=(0,Re.writeMidi)(f);return new Uint8Array(d)}var Ce=re(ee(),1);function Be(e,t){return Ne(e,t)+1}var Ae=120,mt=480,le=2;function ht(e){return!e||e<=0?Ae:Math.round(6e7/e)}function kt(e,t=le){let r=e/8192;return Math.round(r*t*100)/100}function bt(e,t){if(!e||typeof e!="string")return t;let r=e.trim().replace(/[^A-Za-z0-9_]/g,"_");return r.length>0?r:t}function It(e,t,r=3){if(e<=0)return 0;let a=[1,2,3,4,5,6,7,8,12,16,.5,.25,.75,1.5,2.5,3.5,.125,.375,.625,.875,.0625,.1875,.3125,1/3,2/3,4/3,1/6,5/6,1/12,1/24];for(let i of a){let o=Math.round(i*t);if(Math.abs(e-o)<=r)return o}return e}function yt(e){let t=e.header?.ticksPerBeat??mt,r=Ae,a={num:4,denom:4},i=[],o=[],n=[],f=new Map;for(let d=0;d<e.tracks.length;d++){let l=e.tracks[d],s=0,c={msb:null,lsb:null};for(let u of l){if(s+=u.deltaTime??0,u.type==="trackName"||u.type==="sequenceTrackName"){let p=u.text||u.name;p&&!o[d]&&(o[d]=p);continue}if(u.type==="setTempo"){let p=ht(u.microsecondsPerBeat);s===0&&i.filter(m=>m.type==="tempo"&&m.tick===0).length===0&&(r=p),i.push({type:"tempo",trackIndex:d,tick:s,bpm:p});continue}if(u.type==="timeSignature"){let p={num:u.numerator??4,denom:u.denominator??4};s===0&&i.filter(m=>m.type==="ts"&&m.tick===0).length===0&&(a=p),i.push({type:"ts",trackIndex:d,tick:s,numerator:p.num,denominator:p.denom});continue}if(u.type==="programChange"){i.push({type:"programChange",trackIndex:d,tick:s,channel:u.channel,programNumber:u.programNumber});continue}if(u.type==="controller"){if(u.controllerType===101){c.msb=u.value;continue}if(u.controllerType===100){c.lsb=u.value;continue}if(u.controllerType===6&&c.msb===0&&c.lsb===0){n[d]=u.value;continue}if(u.controllerType===38&&c.msb===0&&c.lsb===0)continue;i.push({type:"cc",trackIndex:d,tick:s,channel:u.channel,controllerType:u.controllerType,value:u.value});continue}if(u.type==="pitchBend"){i.push({type:"pb",trackIndex:d,tick:s,channel:u.channel,value:u.value});continue}if(u.type==="noteOn"){let p=u.channel??0;f.has(d)||f.set(d,new Map);let m=f.get(d);if(m.has(p)||m.set(p,new Map),(u.velocity??64)===0){let h=m.get(u.noteNumber);h&&(i.push({type:"note",trackIndex:d,tick:h.tick,channel:p,noteNumber:u.noteNumber,velocity:h.velocity,durationTicks:s-h.tick}),m.delete(u.noteNumber))}else m.get(p).set(u.noteNumber,{tick:s,velocity:u.velocity??64});continue}if(u.type==="noteOff"){let p=u.channel??0,m=f.get(d)?.get(p),h=m?.get(u.noteNumber);h&&(i.push({type:"note",trackIndex:d,tick:h.tick,channel:p,noteNumber:u.noteNumber,velocity:h.velocity,durationTicks:s-h.tick}),m.delete(u.noteNumber));continue}}}return{events:i,ppqn:t,bpm:r,timesig:a,trackNames:o,trackPbranges:n}}function gt(e){let t=new Map;for(let a of e){let i=a.trackIndex;t.has(i)||t.set(i,[]),t.get(i).push(a)}let r={cc:0,pb:1,note:2,tempo:3,ts:4,programChange:5};for(let a of t.values())a.sort((i,o)=>i.tick!==o.tick?i.tick-o.tick:(r[i.type]??6)-(r[o.type]??6));return t}function de(e,t={}){let r=t?.preferSpn!==!1,a=t?.precision??3,i=e instanceof Uint8Array?e:typeof Buffer<"u"&&Buffer.isBuffer(e)?new Uint8Array(e):new Uint8Array(Array.from(e)),o=(0,Ce.parseMidi)(i),{events:n,ppqn:f,bpm:d,timesig:l,trackNames:s,trackPbranges:c}=yt(o),u=gt(n),p=[];p.push("@LMP 1.0"),p.push(`@BPM ${d}`),p.push(`@TIMESIG ${l.num}/${l.denom}`),p.push(`@PPQN ${f}`),p.push("");let m=y=>Math.round(y*Math.pow(10,a))/Math.pow(10,a),h=[],T=[];for(let y=0;y<o.tracks.length;y++){let A=u.get(y)??[],N=A.some(x=>x.type==="note"),U=A.some(x=>x.type==="cc"),R=A.some(x=>x.type==="pb"),v=A.some(x=>x.type==="programChange");if(N||U||R||v)h.push(y);else for(let x of A)(x.type==="tempo"||x.type==="ts")&&T.push(x)}if(h.length===0)for(let y=0;y<o.tracks.length;y++)(u.get(y)??[]).length>0&&h.push(y);let k=1;for(let y=0;y<h.length;y++){let A=h[y],N=u.get(A)??[];if(y===0&&T.length>0){for(let g of T)N.some(S=>S.type===g.type&&S.tick===g.tick)||N.push(g);N.sort((g,S)=>g.tick-S.tick)}let R=(N.find(g=>g.channel!==void 0)?.channel??0)+1,v=N.find(g=>g.type==="programChange")?.programNumber,x=c[A]??le,F=s[A],B=bt(F,`Track_${k}`);p.push(`@TRACK ${k} ${B}`),p.push(`@CHANNEL ${R}`),v!==void 0&&p.push(`@PROGRAM ${v}`),x!==le&&p.push(`@PBRANGE ${x}`),p.push("");let b=new Map,M=[],I=[],w=[],P=[],D=0;for(let g of N){let S=m(Be(g.tick,f));if(g.type==="note"){let q=g.tick+(g.durationTicks??0);q>D&&(D=q),b.has(S)||b.set(S,[]),b.get(S).push({noteNumber:g.noteNumber,velocity:g.velocity,durationTicks:g.durationTicks})}else g.type==="cc"?M.push({beat:S,...g}):g.type==="pb"?I.push({beat:S,...g}):g.type==="tempo"?w.push({beat:S,...g}):g.type==="ts"&&P.push({beat:S,...g})}let Q=new Set;for(let g of N){let S=m(Be(g.tick,f));["note","cc","pb","tempo","ts"].includes(g.type)&&Q.add(S)}let te=[...Q].sort((g,S)=>g-S);for(let g of te){for(let E of w.filter(L=>L.beat===g))E.tick===0&&E.bpm===d||p.push(`${g} TEMPO ${E.bpm}`);for(let E of P.filter(L=>L.beat===g))E.tick===0&&E.numerator===l.num&&E.denominator===l.denom||p.push(`${g} TS ${E.numerator??4} ${E.denominator??4}`);for(let E of M.filter(L=>L.beat===g))p.push(`${g} CC ${E.controllerType} ${E.value}`);let S=I.filter(E=>E.beat===g);for(let E=0;E<S.length;E++){let L=S[E];if(L.value===0&&L.tick>D&&D>0||E<S.length-1)continue;let j=kt(L.value,x);p.push(`${g} PB ${j}`)}let q=b.get(g)??[];if(q.length>0){q.sort(($,G)=>$.noteNumber-G.noteNumber);let E=R===10,L=[];for(let $ of q){let G=It($.durationTicks??f/4,f),W=Math.round(G/f*1e3)/1e3,H=$.velocity,Y=L.find(he=>he.velocity===H&&he.durBeats===W);Y||(Y={velocity:H,durBeats:W,notes:[]},L.push(Y)),Y.notes.push($)}let j=L[0],Oe=j.notes.map($=>E||!r?String($.noteNumber):ie($.noteNumber)??String($.noteNumber)).join(",");p.push(`${g} ${Oe} ${j.velocity} ${j.durBeats}`);for(let $=1;$<L.length;$++){let G=L[$],W=G.notes.map(H=>E||!r?String(H.noteNumber):ie(H.noteNumber)??String(H.noteNumber)).join(",");p.push(`+ ${W} ${G.velocity} ${G.durBeats}`)}}}p.push(""),k++}return p.join(`
`).trimEnd()}var me=re(ee(),1);function Le(e,t={}){let r=t?.loose===!0,a=t?.sourceMap===!0,i=r?[]:void 0,o=r?{loose:!0,warnings:i}:{},n=be(e),f=Ie(n,o),d=Me(n,f,o),l=Se(d,f);if(a){let s=new Map;for(let c of d)if(c.type==="note"&&c.sourceLine!=null){let p=`${Math.round(c.beat*1e3)/1e3}_${c.trackIndex}_${c.midi}`;s.set(p,c.sourceLine)}return r?{midi:l,warnings:i,sourceMap:s}:{midi:l,sourceMap:s}}return r?{midi:l,warnings:i}:l}var xt={compile:Le,decompile:de,parseMidi:me.parseMidi};return He(Nt);})();


  const LMP_CORE = typeof LMP !== 'undefined' ? LMP : (globalThis.LMP || window.LMP);
  if (!LMP_CORE) {
    console.error('[LMP Userscript] Failed to initialize bundled LMP compiler.');
    return;
  }

  // --- 2. Audio Engine (WebAudio Polyphonic Synthesizer + Drum Engine) ---
  let activeAudioCtx = null;
  let activePlayBtn = null;
  let playbackTimer = null;

  function stopPlayback() {
    if (playbackTimer) {
      clearTimeout(playbackTimer);
      playbackTimer = null;
    }
    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch (e) {
        // AudioContext already closed
      }
      activeAudioCtx = null;
    }
    if (activePlayBtn) {
      activePlayBtn.textContent = '▶ Play';
      activePlayBtn.style.background = '#2563eb';
      activePlayBtn = null;
    }
  }

  function playMidi(midiBytes, onFinish, btn) {
    stopPlayback();
    activePlayBtn = btn;
    if (btn) {
      btn.textContent = '⏹ Stop';
      btn.style.background = '#dc2626';
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      alert('WebAudio API is not supported in this browser.');
      stopPlayback();
      return;
    }

    const ctx = new AudioContextClass();
    activeAudioCtx = ctx;

    let parsed;
    try {
      parsed = LMP_CORE.parseMidi(midiBytes);
    } catch (err) {
      alert('MIDI parsing error: ' + (err.message || String(err)));
      stopPlayback();
      return;
    }

    const ppqn = parsed.header.ticksPerBeat || 480;
    let tempoUs = 500000; // default 120 bpm

    // Check for setTempo in meta events
    for (const track of parsed.tracks) {
      for (const evt of track) {
        if (evt.type === 'setTempo' && evt.microsecondsPerBeat) {
          tempoUs = evt.microsecondsPerBeat;
          break;
        }
      }
    }

    const secondsPerTick = (tempoUs / 1000000) / ppqn;
    const now = ctx.currentTime + 0.05;
    let maxEndTime = now;

    // Track active notes per channel+pitch
    for (const track of parsed.tracks) {
      let tick = 0;
      const activeNotes = new Map();

      for (const evt of track) {
        tick += evt.deltaTime || 0;
        const ch = evt.channel ?? 0;
        const pitch = evt.noteNumber;

        if (evt.type === 'noteOn' && evt.velocity > 0) {
          activeNotes.set(ch + ':' + pitch, { tick, velocity: evt.velocity });
        } else if (evt.type === 'noteOff' || (evt.type === 'noteOn' && evt.velocity === 0)) {
          const key = ch + ':' + pitch;
          const noteStart = activeNotes.get(key);
          if (noteStart) {
            activeNotes.delete(key);
            const startTime = now + noteStart.tick * secondsPerTick;
            const duration = Math.max(0.04, (tick - noteStart.tick) * secondsPerTick);
            const velRatio = (noteStart.velocity || 80) / 127;
            const endTime = startTime + duration;
            if (endTime > maxEndTime) maxEndTime = endTime;

            if (ch === 9) {
              playDrumVoice(ctx, pitch, startTime, velRatio);
            } else {
              playMelodicVoice(ctx, pitch, startTime, duration, velRatio);
            }
          }
        }
      }
    }

    const totalDuration = maxEndTime - now;
    if (totalDuration > 0) {
      playbackTimer = setTimeout(() => {
        stopPlayback();
        if (onFinish) onFinish();
      }, (totalDuration + 0.1) * 1000);
    } else {
      stopPlayback();
    }
  }

  function playMelodicVoice(ctx, pitch, startTime, duration, velRatio) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 440 * Math.pow(2, (pitch - 69) / 12);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      const peak = 0.22 * velRatio;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
      gain.gain.setValueAtTime(peak * 0.75, startTime + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      // Audio scheduling edge-case guard
    }
  }

  function playDrumVoice(ctx, pitch, startTime, velRatio) {
    try {
      if (pitch === 35 || pitch === 36) {
        // Bass Drum / Kick: Pitch sweep sine oscillator
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(140, startTime);
        osc.frequency.exponentialRampToValueAtTime(36, startTime + 0.12);

        gain.gain.setValueAtTime(0.45 * velRatio, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.16);
      } else if (pitch === 38 || pitch === 40) {
        // Snare: Filtered white noise
        const bufferSize = Math.floor(ctx.sampleRate * 0.14);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(800, startTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3 * velRatio, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(startTime);
        noise.stop(startTime + 0.14);
      } else {
        // Hi-Hat / Percussion / Cymbals
        const bufferSize = Math.floor(ctx.sampleRate * 0.05);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(6500, startTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18 * velRatio, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(startTime);
        noise.stop(startTime + 0.05);
      }
    } catch (e) {
      // Ignore drum synthesis scheduling errors
    }
  }

  // --- 3. Utilities & Detection ---
  const LMP_HEADER_REGEX = /@LMPs+[d.]+/i;
  const TRACK_HEADER_REGEX = /@TRACKs+d+/i;

  function isLmpContent(text) {
    if (!text || typeof text !== 'string') return false;
    const firstLines = text.split('\n').slice(0, 15).join('\n');
    return LMP_HEADER_REGEX.test(firstLines) || (TRACK_HEADER_REGEX.test(firstLines) && /@CHANNELs+d+/i.test(firstLines));
  }

  function extractLmpText(el) {
    const clone = el.cloneNode(true);
    const elementsToRemove = clone.querySelectorAll('.lmp-action-toolbar, button, [role="button"]');
    elementsToRemove.forEach(e => e.remove());
    const raw = clone.innerText || clone.textContent || '';

    const lines = raw.split(/\r?\n/);
    const startIdx = lines.findIndex(l => /^\s*@(LMP|BPM|TIMESIG|PPQN|ORIGIN|SEED|TRACK|MAP|RULE|DEFAULT_)/i.test(l));
    if (startIdx === -1) return raw.trim();
    return lines.slice(startIdx).join('\n').trim();
  }

  function getFilename(text) {
    const m = text.match(/@TRACK\s+\d+\s+([^\r\n]+)/i);
    let name = m ? m[1].trim().replace(/[/\\:*?"<>|]/g, '_') : 'LMP_Composition';
    name = name.replace(/\s+/g, '_');
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    return `${name}_${date}_${time}.mid`;
  }

  function triggerDownload(midiBytes, filename) {
    const blob = new Blob([midiBytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // --- 4. DOM Injection & UI ---
  function attachToolbar(block) {
    if (block.dataset.lmpInjected === 'true') return;

    const rawText = block.innerText || block.textContent || '';
    if (!isLmpContent(rawText)) return;

    block.dataset.lmpInjected = 'true';

    // Position container relatively if needed
    const computedPos = window.getComputedStyle(block).position;
    if (computedPos === 'static') {
      block.style.position = 'relative';
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'lmp-action-toolbar';
    toolbar.style.cssText = [
      'position: absolute',
      'top: 8px',
      'right: 56px',
      'z-index: 1000',
      'display: flex',
      'align-items: center',
      'gap: 6px',
      'background: rgba(15, 23, 42, 0.92)',
      'border: 1px solid rgba(255, 255, 255, 0.16)',
      'border-radius: 6px',
      'padding: 3px 6px',
      'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 11px',
      'color: #e2e8f0',
      'backdrop-filter: blur(6px)'
    ].join(';');

    const badge = document.createElement('span');
    badge.textContent = 'LMP';
    badge.style.cssText = 'background:#0f766e;color:#5eead4;padding:2px 5px;border-radius:4px;font-weight:700;font-size:10px;letter-spacing:0.5px;';

    const playBtn = document.createElement('button');
    playBtn.textContent = '▶ Play';
    playBtn.style.cssText = [
      'background: #2563eb',
      'color: #ffffff',
      'border: none',
      'border-radius: 4px',
      'padding: 3px 8px',
      'font-size: 11px',
      'font-weight: 500',
      'cursor: pointer',
      'transition: background 0.15s ease'
    ].join(';');

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (activePlayBtn === playBtn) {
        stopPlayback();
        return;
      }

      const lmpText = extractLmpText(block);
      try {
        const res = LMP_CORE.compile(lmpText, { loose: true });
        const midiBytes = res.midi || res;
        playMidi(midiBytes, () => {
          playBtn.textContent = '▶ Play';
          playBtn.style.background = '#2563eb';
        }, playBtn);
      } catch (err) {
        alert('LMP Compile Error: ' + (err.message || String(err)));
      }
    });

    const dlBtn = document.createElement('button');
    dlBtn.textContent = '⬇ MIDI';
    dlBtn.style.cssText = [
      'background: #334155',
      'color: #f8fafc',
      'border: none',
      'border-radius: 4px',
      'padding: 3px 8px',
      'font-size: 11px',
      'font-weight: 500',
      'cursor: pointer',
      'transition: background 0.15s ease'
    ].join(';');

    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const lmpText = extractLmpText(block);
      try {
        const res = LMP_CORE.compile(lmpText, { loose: true });
        const midiBytes = res.midi || res;
        const filename = getFilename(lmpText);
        triggerDownload(midiBytes, filename);
      } catch (err) {
        alert('LMP Compile Error: ' + (err.message || String(err)));
      }
    });

    toolbar.appendChild(badge);
    toolbar.appendChild(playBtn);
    toolbar.appendChild(dlBtn);
    block.appendChild(toolbar);
  }

  function scanCodeBlocks() {
    const candidates = document.querySelectorAll('pre, [class*="code-block"], [class*="codeblock"], code-block');
    for (const el of candidates) {
      attachToolbar(el);
    }
  }

  // --- 5. Observer & Initialization ---
  let scanDebounce = null;
  function scheduleScan() {
    if (scanDebounce) return;
    scanDebounce = setTimeout(() => {
      scanDebounce = null;
      scanCodeBlocks();
    }, 250);
  }

  const observer = new MutationObserver((mutations) => {
    scheduleScan();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial scan on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanCodeBlocks);
  } else {
    scanCodeBlocks();
  }

  console.log('[LMP Userscript] Initialized with local compiler & WebAudio engine on', window.location.hostname);
})();
