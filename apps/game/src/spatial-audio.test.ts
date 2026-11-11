import { expect, test, vi } from "vitest";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { audibleGain, SpatialAudio } from "./spatial-audio";
import { weaponSoundRange } from "./audio";
import { roomImpulse } from "./room-acoustics";

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

function roomFixture(sampleRate = 8000) {
  const node = () => ({ connect: vi.fn((target: unknown) => target), disconnect: vi.fn() });
  const convolvers: (ReturnType<typeof node> & { normalize: boolean; buffer?: AudioBuffer })[] = [];
  const sends: (ReturnType<typeof node> & { gain: { value: number } })[] = [];
  const context = {
    sampleRate,
    createBuffer: vi.fn((channels: number, length: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { getChannelData: (channel: number) => data[channel] } as AudioBuffer;
    }),
    createConvolver: () => {
      const convolver = {
        ...node(),
        normalize: true,
        buffer: undefined as AudioBuffer | undefined,
      };
      convolvers.push(convolver);
      return convolver;
    },
    createGain: () => {
      const send = { ...node(), gain: { value: 0 } };
      sends.push(send);
      return send;
    },
  };
  return {
    context,
    contextNode: context as unknown as AudioContext,
    convolvers,
    sends,
    input: node() as unknown as AudioNode,
    output: node() as unknown as AudioNode,
  };
}

test("room resets rebuild the graph with unchanged cached impulse samples", () => {
  const fixture = roomFixture();
  const audio = new SpatialAudio();
  audio.connectRoom(fixture.contextNode, fixture.input, fixture.output);
  const buffers = fixture.convolvers.map((node) => node.buffer!);
  expect(fixture.context.createBuffer).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 2; i++) {
    const expected = roomImpulse(fixture.contextNode, i === 1);
    for (let channel = 0; channel < 2; channel++)
      expect(buffers[i].getChannelData(channel)).toEqual(expected.getChannelData(channel));
  }
  fixture.context.createBuffer.mockClear();
  audio.resetRooms();
  expect(audio.convolverCount).toBe(0);
  for (const node of [...fixture.convolvers, ...fixture.sends])
    expect(node.disconnect).toHaveBeenCalledOnce();
  audio.connectRoom(fixture.contextNode, fixture.input, fixture.output);
  expect(fixture.context.createBuffer).not.toHaveBeenCalled();
  expect(audio.convolverCount).toBe(2);
  for (let i = 0; i < 2; i++) {
    const convolver = fixture.convolvers[i + 2];
    const send = fixture.sends[i + 2];
    expect(convolver.buffer).toBe(buffers[i]);
    expect(convolver.normalize).toBe(false);
    expect(convolver.connect).toHaveBeenCalledWith(fixture.output);
    expect(send.connect).toHaveBeenCalledWith(convolver);
    expect(send.gain.value).toBe(i === 0 ? audio.roomState.short : audio.roomState.long);
  }
});

test("room impulse buffers stay separate for different audio contexts", () => {
  const first = roomFixture();
  const second = roomFixture(16000);
  const audio = new SpatialAudio();
  audio.connectRoom(first.contextNode, first.input, first.output);
  audio.connectRoom(second.contextNode, second.input, second.output);
  expect(first.context.createBuffer).toHaveBeenCalledTimes(2);
  expect(second.context.createBuffer).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 2; i++) {
    expect(second.convolvers[i].buffer).not.toBe(first.convolvers[i].buffer);
    expect(second.convolvers[i].buffer!.getChannelData(0).length).toBe(
      first.convolvers[i].buffer!.getChannelData(0).length * 2,
    );
  }
});

test("listener matrix extraction matches camera getters with one world update", () => {
  const fixture = audioFixture();
  const parent = new Group();
  parent.position.set(7, 3, -8);
  parent.rotation.set(0.2, 0.8, -0.3);
  parent.scale.set(1.2, 0.8, 1.5);
  const camera = new PerspectiveCamera();
  parent.add(camera);
  camera.position.set(2, 4, 5);
  camera.rotation.set(-0.4, 0.5, 0.1);
  const expectedPosition = camera.getWorldPosition(new Vector3());
  const expectedForward = camera.getWorldDirection(new Vector3());
  const expectedUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const update = vi.spyOn(camera, "updateWorldMatrix");
  fixture.audio.update(fixture.contextNode, camera);
  expect(update).toHaveBeenCalledExactlyOnceWith(true, false);
  expect(fixture.audio.position).toEqual(expectedPosition);
  for (const [prefix, expected] of [
    ["position", expectedPosition],
    ["forward", expectedForward],
    ["up", expectedUp],
  ] as const)
    for (const axis of ["x", "y", "z"] as const)
      expect(fixture.context.listener[`${prefix}${axis.toUpperCase()}`].value).toBe(expected[axis]);
});
