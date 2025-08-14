require('dotenv').config();

// Mock the twilio module
jest.mock('twilio', () => {
  return jest.fn(() => ({
    calls: jest.fn((callSid) => ({
      update: jest.fn().mockResolvedValue({
        status: 'queued',
        sid: callSid
      })
    }))
  }));
});

const transferCall = require('../functions/transferCall');

test('Expect transferCall to successfully redirect call', async () => {
  const mockCallSid = 'CA1234567890abcdef1234567890abcdef';
  
  const transferResult = await transferCall({ callSid: mockCallSid });

  expect(transferResult).toBe('The call was transferred successfully, say goodbye to the customer.');
});