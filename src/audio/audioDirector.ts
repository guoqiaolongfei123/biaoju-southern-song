import type { AudioCue, AudioScene, AudioSettings } from "./audioState";

type BrowserWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private scene: AudioScene = "title";
  private settings: AudioSettings = { enabled: true, volume: .52 };
  private sceneSources: AudioScheduledSourceNode[] = [];
  private sceneTimer: number | null = null;
  private sequence = 0;

  configure(settings: AudioSettings) {
    this.settings = settings;
    if (!this.master || !this.context) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(settings.enabled ? settings.volume : 0, now, .08);
    if (!settings.enabled) this.stopScene();
    else if (this.context.state === "running" && this.sceneSources.length === 0) this.startScene();
  }

  async unlock() {
    if (!this.settings.enabled || typeof window === "undefined") return false;
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;
      if (!AudioContextConstructor) return false;
      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      compressor.attack.value = .01;
      compressor.release.value = .28;
      this.master.gain.value = 0;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
      this.ambientBus = this.context.createGain();
      this.ambientBus.gain.value = 1;
      this.ambientBus.connect(this.master);
    }
    if (this.context.state !== "running") await this.context.resume().catch(() => undefined);
    const now = this.context.currentTime;
    this.master?.gain.cancelScheduledValues(now);
    this.master?.gain.setTargetAtTime(this.settings.volume, now, .08);
    if (this.sceneSources.length === 0) this.startScene();
    return this.context.state === "running";
  }

  setScene(scene: AudioScene) {
    if (this.scene === scene) return;
    this.scene = scene;
    if (!this.context || this.context.state !== "running" || !this.settings.enabled) return;
    this.stopScene();
    this.startScene();
  }

  async setSuspended(suspended: boolean) {
    if (!this.context) return;
    if (suspended && this.context.state === "running") await this.context.suspend().catch(() => undefined);
    if (!suspended && this.settings.enabled && this.context.state === "suspended") await this.context.resume().catch(() => undefined);
  }

  playCue(cue: AudioCue) {
    const context = this.context;
    if (!context || context.state !== "running" || !this.settings.enabled) return;
    const now = context.currentTime + .008;
    if (cue === "ui") {
      this.tone(520, .065, now, .035, "triangle", .004, .05);
      this.tone(690, .045, now + .035, .018, "sine", .003, .035);
    } else if (cue === "city") {
      this.tone(392, .16, now, .038, "triangle", .008, .13);
      this.tone(587, .12, now + .07, .024, "sine", .006, .1);
    } else if (cue === "day") {
      this.noiseHit(.075, now, .045, 1500);
      this.tone(294, .24, now + .04, .035, "triangle", .006, .2);
    } else if (cue === "departure") {
      [196, 247, 294].forEach((frequency, index) => this.tone(frequency, .24, now + index * .11, .043 - index * .006, "triangle", .008, .18));
    } else if (cue === "alert") {
      this.tone(174, .48, now, .055, "sine", .02, .4);
      this.tone(233, .25, now + .12, .028, "triangle", .01, .2);
    } else if (cue === "battle") {
      this.noiseHit(.42, now, .07, 420);
      this.tone(82, 1.15, now, .11, "sine", .015, 1.05);
      this.tone(123, .72, now + .04, .055, "triangle", .01, .65);
    } else if (cue === "return") {
      [294, 247, 196].forEach((frequency, index) => this.tone(frequency, .28, now + index * .1, .035, "triangle", .008, .22));
    } else if (cue === "settlement") {
      [220, 330, 440, 587].forEach((frequency, index) => this.tone(frequency, .65, now + index * .075, .035, index % 2 ? "sine" : "triangle", .015, .55));
    } else if (cue === "ending-win") {
      [196, 247, 294, 392, 494].forEach((frequency, index) => this.tone(frequency, 1.2, now + index * .13, .045, "triangle", .02, 1));
    } else if (cue === "ending-loss") {
      [247, 196, 147, 110].forEach((frequency, index) => this.tone(frequency, .72, now + index * .16, .04, "sine", .025, .6));
    }
  }

  private startScene() {
    const context = this.context;
    if (!context || !this.master || !this.ambientBus || !this.settings.enabled || context.state !== "running") return;
    const profiles: Record<AudioScene, { noise: number; cutoff: number; drone: number | null; pulse: number }> = {
      title: { noise: .018, cutoff: 720, drone: 98, pulse: 6800 },
      setup: { noise: .022, cutoff: 820, drone: 110, pulse: 5200 },
      map: { noise: .026, cutoff: 960, drone: null, pulse: 5600 },
      travel: { noise: .036, cutoff: 1120, drone: 98, pulse: 2500 },
      event: { noise: .024, cutoff: 650, drone: 82, pulse: 3800 },
      battle: { noise: .04, cutoff: 520, drone: 73, pulse: 920 },
      settlement: { noise: .014, cutoff: 900, drone: null, pulse: 6200 },
      gameover: { noise: .018, cutoff: 520, drone: 73, pulse: 7200 },
    };
    const profile = profiles[this.scene];
    this.loopNoise(profile.noise, profile.cutoff);
    if (profile.drone) this.drone(profile.drone, this.scene === "battle" ? .032 : .018);
    this.sceneTimer = window.setInterval(() => this.playScenePulse(), profile.pulse);
    window.setTimeout(() => this.playScenePulse(), 420);
  }

  private stopScene() {
    if (this.sceneTimer !== null) window.clearInterval(this.sceneTimer);
    this.sceneTimer = null;
    for (const source of this.sceneSources) {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    this.sceneSources = [];
  }

  private playScenePulse() {
    if (!this.context || this.context.state !== "running" || !this.settings.enabled || document.hidden) return;
    const now = this.context.currentTime + .01;
    if (this.scene === "battle") {
      this.noiseHit(.055, now, .026, 330);
      this.tone(this.sequence++ % 4 === 3 ? 110 : 82, .18, now, .026, "sine", .004, .14);
      return;
    }
    if (this.scene === "travel") {
      this.noiseHit(.04, now, .018, 1100);
      if (this.sequence++ % 2 === 0) this.tone(196, .17, now + .08, .018, "triangle", .006, .14);
      return;
    }
    const scale = this.scene === "event" || this.scene === "gameover" ? [147, 174, 196, 220] : [220, 247, 294, 330, 392];
    const note = scale[this.sequence++ % scale.length];
    this.tone(note, this.scene === "title" ? 1.2 : .82, now, .018, "triangle", .015, .72);
    this.tone(note * 2, .36, now + .045, .009, "sine", .008, .3);
  }

  private loopNoise(volume: number, cutoff: number) {
    const context = this.context!;
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;
    let seed = 173 + this.scene.length * 97;
    for (let index = 0; index < channel.length; index += 1) {
      seed = (seed * 16807) % 2147483647;
      const white = seed / 1073741824 - 1;
      previous = previous * .82 + white * .18;
      channel[index] = previous;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.Q.value = .65;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.ambientBus!);
    source.start();
    this.sceneSources.push(source);
  }

  private drone(frequency: number, volume: number) {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.value = 260;
    gain.gain.value = volume;
    oscillator.connect(filter).connect(gain).connect(this.ambientBus!);
    oscillator.start();
    this.sceneSources.push(oscillator);
  }

  private tone(frequency: number, duration: number, at: number, volume: number, type: OscillatorType, attack: number, release: number) {
    const context = this.context;
    if (!context || !this.master) return;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.detune.setValueAtTime((this.sequence % 3 - 1) * 3, at);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(2600, frequency * 5), at);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), at + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, at + Math.max(attack + .02, duration - release * .45));
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + .04);
  }

  private noiseHit(duration: number, at: number, volume: number, cutoff: number) {
    const context = this.context;
    if (!context || !this.master) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = .8;
    gain.gain.setValueAtTime(Math.max(.0002, volume), at);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(at);
  }
}

export const audioDirector = new AudioDirector();
