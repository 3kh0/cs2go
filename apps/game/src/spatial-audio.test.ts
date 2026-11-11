import { expect, test, vi } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { audibleGain, SpatialAudio } from "./spatial-audio";
import { weaponSoundRange } from "./audio";

test("suppressed weapon ranges fade continuously to silence and respect attachment state", () => {
  const quiet = weaponSoundRange(2, true),
    loud = weaponSoundRange(2, false);
  expect(quiet.maxDistance).toBeLessThan(loud.maxDistance);
  expect(quiet.maxDistance).toBeCloseTo(35.56);
  expect(audibleGain(30 * 0.0254, quiet)).toBe(1);
  const gains = [3, 8, 16, 24, 35.56, 70].map((distance) => audibleGain(distance, quiet));
  expect(gains).toEqual([...gains].sort((a, b) => b - a));
  expect(gains.slice(-2)).toEqual([0, 0]);
  expect(audibleGain(50, loud)).toBeGreaterThan(0);
  expect(weaponSoundRange(1, true).maxDistance).toBeLessThan(
    weaponSoundRange(1, false).maxDistance,
  );
  // Inherently suppressed MP5-SD stays quiet regardless of the optional flag.
  expect(weaponSoundRange(28, false)).toEqual(weaponSoundRange(28, true));
});

function audioFixture() {
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn((target: unknown) => target), disconnect: vi.fn() });
  const gains: { gain: ReturnType<typeof parameter> }[] = [];
  const panners: { positionX: ReturnType<typeof parameter> }[] = [];
  const context = {
    currentTime: 1,
    listener: Object.fromEntries(
      [
        "positionX",
        "positionY",
        "positionZ",
        "forwardX",
        "forwardY",
        "forwardZ",
        "upX",
        "upY",
        "upZ",
      ].map((name) => [name, parameter()]),
    ),
    createPanner: () => {
      const panner = {
        ...node(),
        positionX: parameter(),
        positionY: parameter(),
        positionZ: parameter(),
      };
      panners.push(panner);
      return panner;
    },
    createBiquadFilter: () => ({ ...node(), frequency: parameter() }),
    createGain: () => {
      const gain = { ...node(), gain: parameter() };
      gains.push(gain);
      return gain;
    },
  };
  const audio = new SpatialAudio();
  // Convolution construction is orthogonal to voice audibility/occlusion.
  vi.spyOn(audio, "connectRoom").mockImplementation(() => {});
  const obstructed = vi.fn(() => false);
  audio.obstructed = obstructed;
  const input = node() as unknown as AudioNode;
  return {
    audio,
    context,
    contextNode: context as unknown as AudioContext,
    obstructed,
    gains,
    panners,
    connect: (x: number) =>
      audio.connect(context as unknown as AudioContext, input, input, new Vector3(x, 0, 0)),
  };
}

test("inaudible voices leave the occlusion budget available for nearby voices", () => {
  const fixture = audioFixture();
  for (let i = 0; i < 16; i++) fixture.connect(100 + i);
  expect(fixture.obstructed).not.toHaveBeenCalled();
  fixture.connect(5);
  fixture.obstructed.mockClear();
  fixture.audio.update(fixture.contextNode, new PerspectiveCamera());
  // One room sample and the nearby source, rather than spending the voice
  // budget on silent distant sources and postponing the audible source.
  expect(fixture.obstructed).toHaveBeenCalledTimes(2);
  expect(fixture.panners[16].positionX.setTargetAtTime).toHaveBeenCalledWith(5, 1, 0.04);
  expect(fixture.gains[16].gain.setTargetAtTime).toHaveBeenCalledWith(
    audibleGain(5, { refDistance: 1.5, maxDistance: 35 }),
    1,
    0.04,
  );
});

test("an inaudible voice returns when the listener moves into range and fades out again", () => {
  const fixture = audioFixture();
  fixture.connect(100);
  const camera = new PerspectiveCamera();
  fixture.audio.update(fixture.contextNode, camera);
  expect(fixture.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, 0.04);
  camera.position.x = 90;
  fixture.context.currentTime = 1.13;
  fixture.audio.update(fixture.contextNode, camera);
  expect(fixture.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
    audibleGain(10, { refDistance: 1.5, maxDistance: 35 }),
    1.13,
    0.04,
  );
  expect(fixture.panners[0].positionX.setTargetAtTime).toHaveBeenLastCalledWith(100, 1.13, 0.04);
  camera.position.x = 0;
  fixture.context.currentTime = 1.26;
  fixture.obstructed.mockClear();
  fixture.audio.update(fixture.contextNode, camera);
  expect(fixture.obstructed).toHaveBeenCalledTimes(1); // Room only.
  expect(fixture.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1.26, 0.04);
});
