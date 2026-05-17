import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { diffRoutines } from '../src/platform.js';
import type { RoutineContext } from '../src/platformAccessory.js';
import type { TethralRoutine } from '../src/tethralClient.js';

type Accessory = { UUID: string; displayName: string; context: RoutineContext };

const uuidFor = (id: string) => `uuid-${id}`;

function mapOf(...entries: Array<[string, Accessory]>): Map<string, Accessory> {
  return new Map(entries);
}

function acc(id: string, name = id): Accessory {
  return { UUID: uuidFor(id), displayName: name, context: { routine: { id, name } } };
}

describe('diffRoutines', () => {
  it('classifies all incoming as create when current is empty', () => {
    const incoming: TethralRoutine[] = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diff = diffRoutines(new Map() as any, incoming, uuidFor);
    assert.equal(diff.create.length, 2);
    assert.equal(diff.update.length, 0);
    assert.equal(diff.remove.length, 0);
  });

  it('classifies matching uuid as update', () => {
    const current = mapOf([uuidFor('a'), acc('a', 'Old Name')]);
    const incoming: TethralRoutine[] = [{ id: 'a', name: 'New Name' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diff = diffRoutines(current as any, incoming, uuidFor);
    assert.equal(diff.update.length, 1);
    assert.equal(diff.update[0].routine.name, 'New Name');
    assert.equal(diff.create.length, 0);
    assert.equal(diff.remove.length, 0);
  });

  it('classifies missing uuid as remove', () => {
    const current = mapOf([uuidFor('a'), acc('a')], [uuidFor('b'), acc('b')]);
    const incoming: TethralRoutine[] = [{ id: 'a', name: 'A' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diff = diffRoutines(current as any, incoming, uuidFor);
    assert.equal(diff.update.length, 1);
    assert.equal(diff.remove.length, 1);
    assert.equal(diff.remove[0].uuid, uuidFor('b'));
  });

  it('handles mixed create + update + remove in one pass', () => {
    const current = mapOf([uuidFor('a'), acc('a')], [uuidFor('b'), acc('b')]);
    const incoming: TethralRoutine[] = [{ id: 'a', name: 'A' }, { id: 'c', name: 'C' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diff = diffRoutines(current as any, incoming, uuidFor);
    assert.deepEqual(diff.create.map(r => r.id), ['c']);
    assert.deepEqual(diff.update.map(u => u.routine.id), ['a']);
    assert.deepEqual(diff.remove.map(r => r.uuid), [uuidFor('b')]);
  });

  it('does not classify the same uuid as both update and remove', () => {
    const current = mapOf([uuidFor('a'), acc('a')]);
    const incoming: TethralRoutine[] = [{ id: 'a', name: 'A' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diff = diffRoutines(current as any, incoming, uuidFor);
    assert.equal(diff.update.length, 1);
    assert.equal(diff.remove.length, 0);
  });
});
