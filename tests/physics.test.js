import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTS, equilibrium, nextOverflow } from '../src/physics.js';

const cases = [
  { densityGcm3: 1, appliedForceN: 0, disp: 600, force: 5.88 },
  { densityGcm3: 1.2, appliedForceN: 0, disp: 500, force: 5.88 },
  { densityGcm3: 1, appliedForceN: 2, disp: 804.081632653, force: 7.88 },
  { densityGcm3: 1.2, appliedForceN: 2, disp: 670.06802721, force: 7.88 }
];

for (const c of cases) test(`wood: density=${c.densityGcm3} downward=${c.appliedForceN}N`, () => {
  const actual = equilibrium({ object: OBJECTS.wood, ...c });
  assert.ok(Math.abs(actual.displacedCm3 - c.disp) < 0.001);
  assert.ok(Math.abs(actual.buoyancyN - c.force) < 0.00001);
});

test('iron fully immersed, resting at bottom with support', () => {
  const iron = equilibrium({ object: OBJECTS.iron, densityGcm3: 1, appliedForceN: 0 });
  assert.equal(iron.displacedCm3, 1000);
  assert.ok(Math.abs(iron.weightN - 76.44) < 1e-8);
  assert.ok(Math.abs(iron.buoyancyN - 9.8) < 1e-8);
  assert.ok(Math.abs(iron.bottomReactionN - 66.64) < 1e-8);
});

test('iron can be suspended by upward force', () => {
  const iron = equilibrium({ object: OBJECTS.iron, densityGcm3: 1, appliedForceN: -70 });
  assert.ok(iron.displacedCm3 < 1000);
  assert.equal(iron.bottomReactionN, 0);
});

test('collected water does not flow back when wood rises', () => {
  const down = nextOverflow({ previouslyCollectedCm3: 600, displacedCm3: 1000 });
  assert.equal(down.collectedCm3, 1000);
  const released = nextOverflow({ previouslyCollectedCm3: down.collectedCm3, displacedCm3: 600 });
  assert.equal(released.collectedCm3, 1000);
  assert.ok(released.levelCm < 16);
  assert.ok(Math.abs(released.levelCm - (16 - 400/600)) < 1e-9);
});

test('cup water does not disappear when object leaves tank', () => {
  const result = nextOverflow({ previouslyCollectedCm3: 700, displacedCm3: 0 });
  assert.equal(result.collectedCm3, 700);
  assert.ok(result.levelCm < 16);
});
