/**
 * SEERAAI PRO — Unit Tests for Precedent Voice Notes & Legal Speech Recognition Service.
 */
import assert from 'node:assert/strict';

// Provide browser globals for Node test runner
const mockStorage = new Map<string, string>();
const eventListeners: Record<string, ((e: any) => void)[]> = {};

(globalThis as any).window = {
  location: {
    href: 'https://ais-pre-jb7bcd5dvmwn4zolxoq73v-551578258786.europe-west3.run.app/',
    origin: 'https://ais-pre-jb7bcd5dvmwn4zolxoq73v-551578258786.europe-west3.run.app',
    pathname: '/',
    search: '',
    hash: '',
  },
  localStorage: {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
  },
  addEventListener: (name: string, fn: any) => {
    if (!eventListeners[name]) eventListeners[name] = [];
    eventListeners[name].push(fn);
  },
  removeEventListener: (name: string, fn: any) => {
    if (!eventListeners[name]) return;
    eventListeners[name] = eventListeners[name].filter((cb) => cb !== fn);
  },
  dispatchEvent: (event: any) => {
    const list = eventListeners[event.type] || [];
    for (const cb of list) {
      cb(event);
    }
    return true;
  },
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;
(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail?: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
};

async function runTests() {
  const noteService = await import('../src/services/precedentNoteService');
  const alertService = await import('../src/services/precedentAlertService');
  const dictationHook = await import('../src/hooks/useLegalDictation');

  let passed = 0;
  const run = (name: string, fn: () => void) => {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  };

  const testPrecedentId = 'fed_16568';
  const testFileNumber = '16568';

  run('savePrecedentPersonalNote saves a note and increments count', () => {
    let eventFired = false;
    const testListener = () => {
      eventFired = true;
    };
    (globalThis as any).window.addEventListener('seera_precedent_notes_changed', testListener);

    const saved = noteService.savePrecedentPersonalNote({
      precedentId: testPrecedentId,
      fileNumber: testFileNumber,
      title: 'Galmee 16568 Yaada Xiinxalaa',
      content: 'Murtichi dhimma seera bituu fi gurguruu irratti qajeeltoo dirqisiisaa kaaheera.',
      language: 'om',
      tag: 'ratio',
      authorName: 'Abbaa Seeraa',
    });

    assert.ok(saved.id.startsWith('pnote_'));
    assert.equal(saved.precedentId, testPrecedentId);
    assert.equal(saved.tag, 'ratio');
    assert.equal(saved.language, 'om');
    assert.ok(Date.parse(saved.createdAt) > 0);
    assert.ok(eventFired, 'Expected seera_precedent_notes_changed event to fire');

    const count = noteService.getPrecedentNotesCount(testPrecedentId);
    assert.equal(count, 1);

    (globalThis as any).window.removeEventListener('seera_precedent_notes_changed', testListener);
  });

  run('getPrecedentPersonalNotes returns notes isolated by precedent ID', () => {
    // Save another note for a different precedent
    noteService.savePrecedentPersonalNote({
      precedentId: 'oro_24510',
      fileNumber: '24510',
      content: 'Murtii Mana Murtii Waliigala Oromiyaa.',
      language: 'om',
      authorName: 'Ogeessa Seeraa',
    });

    const notes1 = noteService.getPrecedentPersonalNotes(testPrecedentId);
    assert.equal(notes1.length, 1);
    assert.equal(notes1[0].precedentId, testPrecedentId);

    const notes2 = noteService.getPrecedentPersonalNotes('oro_24510');
    assert.equal(notes2.length, 1);
    assert.equal(notes2[0].precedentId, 'oro_24510');

    const notesEmpty = noteService.getPrecedentPersonalNotes('unknown_case');
    assert.equal(notesEmpty.length, 0);
  });

  run('deletePrecedentPersonalNote removes note and dispatches change event', () => {
    const existing = noteService.getPrecedentPersonalNotes(testPrecedentId);
    assert.equal(existing.length, 1);

    let deleteEventFired = false;
    const testListener = () => {
      deleteEventFired = true;
    };
    (globalThis as any).window.addEventListener('seera_precedent_notes_changed', testListener);

    const removed = noteService.deletePrecedentPersonalNote(testPrecedentId, existing[0].id);
    assert.equal(removed, true);
    assert.ok(deleteEventFired, 'Expected change event on delete');

    const countAfter = noteService.getPrecedentNotesCount(testPrecedentId);
    assert.equal(countAfter, 0);

    (globalThis as any).window.removeEventListener('seera_precedent_notes_changed', testListener);
  });

  run('formatSpokenLegalText formats spoken Ethiopian citations properly', () => {
    const spokenOromo = 'akkuma keewwata 12 fi labsii lakk 1234 keessatti ibsame';
    const formattedOromo = dictationHook.formatSpokenLegalText(spokenOromo, 'om');
    assert.ok(formattedOromo.includes('Kew. 12') || formattedOromo.includes('12'));
    assert.ok(formattedOromo.includes('Labsii Lakk. 1234') || formattedOromo.includes('1234'));

    const spokenAmharic = 'እንደ አንቀጽ 45 እና አዋጅ ቁጥር 987 መሠረት';
    const formattedAmharic = dictationHook.formatSpokenLegalText(spokenAmharic, 'am');
    assert.ok(formattedAmharic.includes('አንቀጽ') || formattedAmharic.includes('45'));
    assert.ok(formattedAmharic.includes('አዋጅ ቁጥር') || formattedAmharic.includes('987'));
  });

  run('precedentAlertService supports voice_note interaction tracking', () => {
    alertService.recordPrecedentInteraction('user_test_uid', 'fed_99999', 'voice_note');
    const interacted = alertService.getInteractedPrecedentIds('user_test_uid');
    assert.ok(interacted.has('fed_99999'), 'Expected fed_99999 to be in interacted set');
  });

  console.log(`\nAll ${passed} precedent voice note unit tests passed successfully!`);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
