const QueryBuilder = require('../utils/query-builder');

describe('QueryBuilder', () => {
  let qb;

  beforeEach(() => {
    qb = new QueryBuilder();
  });

  describe('basic SELECT queries', () => {
    test('should build simple SELECT query', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations');
      expect(result.params).toEqual([]);
    });

    test('should build SELECT with specific columns', () => {
      const result = qb
        .select(['id', 'call_sid', 'start_time'])
        .from('conversations')
        .build();

      expect(result.sql).toBe('SELECT id, call_sid, start_time FROM conversations');
    });

    test('should default to SELECT * when no columns specified', () => {
      const result = qb
        .from('conversations')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations');
    });
  });

  describe('WHERE clauses', () => {
    test('should build WHERE with single condition', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .where('call_sid = ?', ['test-123'])
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations WHERE call_sid = ?');
      expect(result.params).toEqual(['test-123']);
    });

    test('should build WHERE with multiple conditions', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .where('call_sid = ?', ['test-123'])
        .where('duration > ?', [300])
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations WHERE call_sid = ? AND duration > ?');
      expect(result.params).toEqual(['test-123', 300]);
    });

    test('should handle WHERE IN clause', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .whereIn('id', [1, 2, 3])
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations WHERE id IN (?, ?, ?)');
      expect(result.params).toEqual([1, 2, 3]);
    });

    test('should handle WHERE BETWEEN clause', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .whereBetween('start_time', '2024-01-01', '2024-01-31')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations WHERE start_time BETWEEN ? AND ?');
      expect(result.params).toEqual(['2024-01-01', '2024-01-31']);
    });

    test('should handle WHERE date with string', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .whereDate('start_time', '=', '2024-01-15')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations WHERE DATE(start_time) = ?');
      expect(result.params).toEqual(['2024-01-15']);
    });

    test('should handle WHERE date with Date object', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = qb
        .select('*')
        .from('conversations')
        .whereDate('start_time', '=', date)
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations WHERE DATE(start_time) = ?');
      expect(result.params).toEqual(['2024-01-15']);
    });
  });

  describe('JOIN clauses', () => {
    test('should build INNER JOIN', () => {
      const result = qb
        .select('*')
        .from('conversations c')
        .join('summaries s', 'c.id = s.conversation_id')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations c INNER JOIN summaries s ON c.id = s.conversation_id');
    });

    test('should build LEFT JOIN', () => {
      const result = qb
        .select('*')
        .from('conversations c')
        .leftJoin('summaries s', 'c.id = s.conversation_id')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations c LEFT JOIN summaries s ON c.id = s.conversation_id');
    });

    test('should build multiple JOINs', () => {
      const result = qb
        .select('*')
        .from('conversations c')
        .leftJoin('summaries s', 'c.id = s.conversation_id')
        .leftJoin('analytics a', 'c.id = a.conversation_id')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations c LEFT JOIN summaries s ON c.id = s.conversation_id LEFT JOIN analytics a ON c.id = a.conversation_id');
    });
  });

  describe('GROUP BY and HAVING', () => {
    test('should build GROUP BY clause', () => {
      const result = qb
        .select(['DATE(start_time)', 'COUNT(*)'])
        .from('conversations')
        .groupBy('DATE(start_time)')
        .build();

      expect(result.sql).toBe('SELECT DATE(start_time), COUNT(*) FROM conversations GROUP BY DATE(start_time)');
    });

    test('should build HAVING clause', () => {
      const result = qb
        .select(['DATE(start_time)', 'COUNT(*) as call_count'])
        .from('conversations')
        .groupBy('DATE(start_time)')
        .having('COUNT(*) > ?', [5])
        .build();

      expect(result.sql).toBe('SELECT DATE(start_time), COUNT(*) as call_count FROM conversations GROUP BY DATE(start_time) HAVING COUNT(*) > ?');
      expect(result.params).toEqual([5]);
    });
  });

  describe('ORDER BY clause', () => {
    test('should build ORDER BY ASC', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .orderBy('start_time', 'ASC')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations ORDER BY start_time ASC');
    });

    test('should build ORDER BY DESC', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .orderBy('start_time', 'DESC')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations ORDER BY start_time DESC');
    });

    test('should default to ASC when direction not specified', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .orderBy('start_time')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations ORDER BY start_time ASC');
    });

    test('should handle multiple ORDER BY clauses', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .orderBy('start_time', 'DESC')
        .orderBy('duration', 'ASC')
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations ORDER BY start_time DESC, duration ASC');
    });
  });

  describe('LIMIT and OFFSET', () => {
    test('should build LIMIT clause', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .limit(10)
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations LIMIT 10');
    });

    test('should build LIMIT with OFFSET', () => {
      const result = qb
        .select('*')
        .from('conversations')
        .limit(10)
        .offset(20)
        .build();

      expect(result.sql).toBe('SELECT * FROM conversations LIMIT 10 OFFSET 20');
    });
  });

  describe('convenience methods', () => {
    test('should build findById query', () => {
      const result = qb.findById('conversations', 123);

      expect(result.sql).toBe('SELECT * FROM conversations WHERE id = ?');
      expect(result.params).toEqual([123]);
    });

    test('should build findByCallSid query', () => {
      const result = qb.findByCallSid('test-123');

      expect(result.sql).toContain('SELECT c.*, s.summary_text, a.sentiment_scores, a.keywords, a.patterns');
      expect(result.sql).toContain('FROM conversations c');
      expect(result.sql).toContain('LEFT JOIN summaries s ON c.id = s.conversation_id');
      expect(result.sql).toContain('LEFT JOIN analytics a ON c.id = a.conversation_id');
      expect(result.sql).toContain('WHERE c.call_sid = ?');
      expect(result.params).toEqual(['test-123']);
    });

    test('should build date range query', () => {
      const result = qb.findConversationsInDateRange('2024-01-01', '2024-01-31');

      expect(result.sql).toContain('SELECT * FROM conversations');
      expect(result.sql).toContain('WHERE start_time BETWEEN ? AND ?');
      expect(result.sql).toContain('ORDER BY start_time ASC');
      expect(result.params).toEqual(['2024-01-01', '2024-01-31']);
    });

    test('should build daily stats query', () => {
      const result = qb.getDailyStats('2024-01-15');

      expect(result.sql).toContain('SELECT DATE(start_time) as call_date, COUNT(*) as total_calls');
      expect(result.sql).toContain('WHERE DATE(start_time) = ?');
      expect(result.sql).toContain('GROUP BY DATE(start_time)');
      expect(result.params).toEqual(['2024-01-15']);
    });

    test('should build recent conversations query', () => {
      const result = qb.getRecentConversations(5);

      expect(result.sql).toContain('SELECT id, call_sid, start_time, duration');
      expect(result.sql).toContain('ORDER BY start_time DESC');
      expect(result.sql).toContain('LIMIT 5');
    });
  });

  describe('INSERT queries', () => {
    test('should build INSERT query', () => {
      const data = {
        call_sid: 'test-123',
        start_time: '2024-01-15T10:00:00Z',
        duration: 300
      };

      const result = qb.insertInto('conversations', data);

      expect(result.sql).toBe('INSERT INTO conversations (call_sid, start_time, duration) VALUES (?, ?, ?)');
      expect(result.params).toEqual(['test-123', '2024-01-15T10:00:00Z', 300]);
    });
  });

  describe('UPDATE queries', () => {
    test('should build UPDATE query', () => {
      const data = {
        end_time: '2024-01-15T10:05:00Z',
        duration: 300
      };

      const result = qb.update('conversations', data, 'id = ?', [123]);

      expect(result.sql).toBe('UPDATE conversations SET end_time = ?, duration = ? WHERE id = ?');
      expect(result.params).toEqual(['2024-01-15T10:05:00Z', 300, 123]);
    });
  });

  describe('DELETE queries', () => {
    test('should build DELETE query', () => {
      const result = qb.deleteFrom('conversations', 'id = ?', [123]);

      expect(result.sql).toBe('DELETE FROM conversations WHERE id = ?');
      expect(result.params).toEqual([123]);
    });
  });

  describe('error handling', () => {
    test('should throw error when FROM clause is missing', () => {
      expect(() => {
        qb.select('*').build();
      }).toThrow('FROM clause is required');
    });

    test('should throw error for invalid ORDER BY direction', () => {
      expect(() => {
        qb.select('*').from('conversations').orderBy('id', 'INVALID');
      }).toThrow('Order direction must be ASC or DESC');
    });

    test('should throw error for whereIn with empty array', () => {
      expect(() => {
        qb.select('*').from('conversations').whereIn('id', []);
      }).toThrow('whereIn requires a non-empty array of values');
    });

    test('should throw error for whereDate with invalid date type', () => {
      expect(() => {
        qb.select('*').from('conversations').whereDate('start_time', '=', 123);
      }).toThrow('Date must be a string or Date object');
    });
  });

  describe('reset functionality', () => {
    test('should reset query builder state', () => {
      qb.select('*').from('conversations').where('id = ?', [123]);
      
      const result1 = qb.build();
      expect(result1.params).toEqual([123]);

      qb.reset();
      const result2 = qb.select('name').from('users').build();
      
      expect(result2.sql).toBe('SELECT name FROM users');
      expect(result2.params).toEqual([]);
    });
  });

  describe('input validation', () => {
    test('should validate safe inputs', () => {
      expect(qb.validateInput('normal text')).toBe(true);
      expect(qb.validateInput(123)).toBe(true);
      expect(qb.validateInput(null)).toBe(true);
    });

    test('should detect potentially dangerous SQL injection patterns', () => {
      expect(qb.validateInput('; DROP TABLE users')).toBe(false);
      expect(qb.validateInput('UNION SELECT * FROM passwords')).toBe(false);
      expect(qb.validateInput('/* comment */ DELETE')).toBe(false);
      expect(qb.validateInput('-- comment')).toBe(false);
      expect(qb.validateInput('<script>alert("xss")</script>')).toBe(false);
    });
  });

  describe('identifier escaping', () => {
    test('should escape SQL identifiers', () => {
      expect(qb.escapeIdentifier('column')).toBe('"column"');
      expect(qb.escapeIdentifier('column"with"quotes')).toBe('"column""with""quotes"');
    });
  });
});