const { MarkCompletionService } = require('../services/mark-completion-service');

describe('MarkCompletionService', () => {
  let service;

  beforeEach(() => {
    service = new MarkCompletionService();
  });

  test('should start with no active marks', () => {
    expect(service.getActiveMarkCount()).toBe(0);
  });

  test('should add and remove marks correctly', () => {
    service.addMark('mark1');
    service.addMark('mark2');
    expect(service.getActiveMarkCount()).toBe(2);

    service.removeMark('mark1');
    expect(service.getActiveMarkCount()).toBe(1);

    service.removeMark('mark2');
    expect(service.getActiveMarkCount()).toBe(0);
  });

  test('should resolve immediately when no marks are active', async () => {
    const result = await service.waitForAllMarks();
    expect(result).toBeUndefined();
  });

  test('should wait for all marks to complete', async () => {
    service.addMark('mark1');
    service.addMark('mark2');

    let resolved = false;
    const promise = service.waitForAllMarks().then(() => {
      resolved = true;
    });

    // Should not be resolved yet
    expect(resolved).toBe(false);

    // Remove first mark
    service.removeMark('mark1');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(resolved).toBe(false);

    // Remove second mark - should resolve now
    service.removeMark('mark2');
    await promise;
    expect(resolved).toBe(true);
  });

  test('should emit event when all marks complete', (done) => {
    service.addMark('mark1');
    
    service.on('all-marks-complete', () => {
      expect(service.getActiveMarkCount()).toBe(0);
      done();
    });

    service.removeMark('mark1');
  });

  test('clearAll should remove all marks and resolve pending callbacks', async () => {
    service.addMark('mark1');
    service.addMark('mark2');
    
    let resolved = false;
    service.waitForAllMarks().then(() => {
      resolved = true;
    });

    service.clearAll();
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(service.getActiveMarkCount()).toBe(0);
    expect(resolved).toBe(true);
  });
});