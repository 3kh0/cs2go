import { afterEach, expect, it, vi } from "vitest";
import { Vector3 } from "three";
import { clipSoundRange, WeaponAudio } from "./audio";
import { Soundscape } from "./soundscape";

afterEach(() => vi.unstubAllGlobals());

function audioContext() {
  const node = () => ({
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    gain: { value: 0 },
    pan: { value: 0 },
    playbackRate: { value: 1 },
    start: vi.fn(),
    stop: vi.fn(),
    onended: undefined as undefined | (() => void),
  });
  const context = {
    currentTime: 1,
    destination: node(),
    createBufferSource: vi.fn(node),
    createGain: vi.fn(node),
    createStereoPanner: vi.fn(node),
  };
  return { context, audio: context as unknown as AudioContext };
}

it("keeps positional weapon voices on their spatial graph and cleans up the selected route", () => {
  const { context, audio } = audioContext();
  const weapons = new WeaponAudio();
  weapons.buffers.set("ak47-1", {} as AudioBuffer);
  const disconnectSpatial = vi.fn();
  weapons.spatial = {
    position: new Vector3(),
    connect: vi.fn(() => disconnectSpatial),
    connectRoom: vi.fn(),
  } as unknown as NonNullable<WeaponAudio["spatial"]>;
  weapons.play(audio, "shot", 0, 100, 0, 0, new Vector3(1, 0, 0));
  expect(context.createStereoPanner).not.toHaveBeenCalled();
  expect(weapons.voices.size).toBe(1);
  context.createBufferSource.mock.results[0].value.onended!();
  expect(disconnectSpatial).toHaveBeenCalledOnce();
  expect(weapons.voices.size).toBe(0);

  weapons.play(audio, "shot", 0, 100, 2);
  const panner = context.createStereoPanner.mock.results[0].value;
  expect(panner.pan.value).toBe(1);
  context.createBufferSource.mock.results[1].value.onended!();
  expect(panner.disconnect).toHaveBeenCalledOnce();
  expect(weapons.voices.size).toBe(0);
});

it("reuses authored range conversion while preserving attenuation metadata", () => {
  const range = clipSoundRange("ak47-1");
  expect(clipSoundRange("ak47-1")).toBe(range);
  expect(range.curve?.[0]).toEqual([0.635, 0.8]);
  expect(range.curve?.at(-1)?.[0]).toBe(range.maxDistance);
  expect(range.maxDistance).toBeGreaterThan(35);
  expect(clipSoundRange("missing")).toEqual({ refDistance: 1.5, maxDistance: 35 });
});

it("preserves objective voices at capacity, evicting ordinary effects before objectives", () => {
  vi.stubGlobal("Audio", class {});
  const { context, audio } = audioContext();
  const sound = new Soundscape();
  sound.context = audio;
  sound.effects = context.createGain() as unknown as GainNode;
  sound.spatial.connectRoom = vi.fn();
  for (const name of ["step-sand-1", "bomb-initiate", "bomb-explode"])
    sound.buffers.set(name, {} as AudioBuffer);
  sound.play("step");
  for (let i = 0; i < 15; i++) sound.play("bomb-initiate");
  sound.play("bomb-initiate");
  expect(context.createBufferSource.mock.results[0].value.stop).toHaveBeenCalledOnce();
  expect(sound.voices.size).toBe(16);
  const sources = context.createBufferSource.mock.results.map(({ value }) => value);
  expect(sound.play("bomb-initiate")).toBeUndefined();
  expect(context.createBufferSource).toHaveBeenCalledTimes(17);
  expect(sound.play("bomb-explode")).toBeDefined();
  expect(sources[1].stop).toHaveBeenCalledOnce();
  expect(sound.voices.size).toBe(16);
});

it("preserves C4 speaker height and native attenuation across repeated positional cues", () => {
  vi.stubGlobal("Audio", class {});
  const { context, audio } = audioContext();
  const sound = new Soundscape();
  sound.context = audio;
  sound.effects = context.createGain() as unknown as GainNode;
  sound.buffers.set("bomb-beep", {} as AudioBuffer);
  const connect = vi.spyOn(sound.spatial, "connect").mockReturnValue(vi.fn());
  const position = new Vector3(4, 2, 6);
  sound.play("bomb-beep", false, "sand", position);
  sound.play("bomb-beep", false, "sand", position);
  const [, , , speaker, range] = connect.mock.calls[0];
  expect(position.toArray()).toEqual([4, 2, 6]);
  expect(speaker.toArray()).toEqual([4, 2.508, 6]);
  expect(range).toEqual({
    refDistance: 1,
    maxDistance: 33.019999999999996,
    curve: [
      [0, 1],
      [33.019999999999996, 0],
    ],
    occlusionMix: 0.2,
  });
  expect(connect.mock.calls[1][4]).toBe(range);
});
