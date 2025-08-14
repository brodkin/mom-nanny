/**
 * Query Builder utility for constructing clean SQL queries
 * Provides a fluent interface for building complex queries safely
 */
class QueryBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this._select = [];
    this._from = null;
    this._joins = [];
    this._where = [];
    this._groupBy = [];
    this._having = [];
    this._orderBy = [];
    this._limit = null;
    this._offset = null;
    this._params = [];
    return this;
  }

  select(columns) {
    if (Array.isArray(columns)) {
      this._select.push(...columns);
    } else {
      this._select.push(columns);
    }
    return this;
  }

  from(table) {
    this._from = table;
    return this;
  }

  join(table, condition) {
    this._joins.push({ type: 'INNER JOIN', table, condition });
    return this;
  }

  leftJoin(table, condition) {
    this._joins.push({ type: 'LEFT JOIN', table, condition });
    return this;
  }

  rightJoin(table, condition) {
    this._joins.push({ type: 'RIGHT JOIN', table, condition });
    return this;
  }

  where(condition, params = []) {
    this._where.push(condition);
    if (Array.isArray(params)) {
      this._params.push(...params);
    } else {
      this._params.push(params);
    }
    return this;
  }

  whereIn(column, values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereIn requires a non-empty array of values');
    }
    
    const placeholders = values.map(() => '?').join(', ');
    this._where.push(`${column} IN (${placeholders})`);
    this._params.push(...values);
    return this;
  }

  whereBetween(column, start, end) {
    this._where.push(`${column} BETWEEN ? AND ?`);
    this._params.push(start, end);
    return this;
  }

  whereDate(column, operator, date) {
    if (typeof date === 'string') {
      this._where.push(`DATE(${column}) ${operator} ?`);
      this._params.push(date);
    } else if (date instanceof Date) {
      this._where.push(`DATE(${column}) ${operator} ?`);
      this._params.push(date.toISOString().split('T')[0]);
    } else {
      throw new Error('Date must be a string or Date object');
    }
    return this;
  }

  groupBy(columns) {
    if (Array.isArray(columns)) {
      this._groupBy.push(...columns);
    } else {
      this._groupBy.push(columns);
    }
    return this;
  }

  having(condition, params = []) {
    this._having.push(condition);
    if (Array.isArray(params)) {
      this._params.push(...params);
    } else {
      this._params.push(params);
    }
    return this;
  }

  orderBy(column, direction = 'ASC') {
    const validDirections = ['ASC', 'DESC'];
    if (!validDirections.includes(direction.toUpperCase())) {
      throw new Error('Order direction must be ASC or DESC');
    }
    this._orderBy.push(`${column} ${direction.toUpperCase()}`);
    return this;
  }

  limit(count) {
    this._limit = parseInt(count);
    return this;
  }

  offset(count) {
    this._offset = parseInt(count);
    return this;
  }

  build() {
    if (!this._from) {
      throw new Error('FROM clause is required');
    }

    let query = 'SELECT ';
    
    // SELECT clause
    if (this._select.length === 0) {
      query += '*';
    } else {
      query += this._select.join(', ');
    }

    // FROM clause
    query += ` FROM ${this._from}`;

    // JOIN clauses
    for (const join of this._joins) {
      query += ` ${join.type} ${join.table} ON ${join.condition}`;
    }

    // WHERE clause
    if (this._where.length > 0) {
      query += ` WHERE ${this._where.join(' AND ')}`;
    }

    // GROUP BY clause
    if (this._groupBy.length > 0) {
      query += ` GROUP BY ${this._groupBy.join(', ')}`;
    }

    // HAVING clause
    if (this._having.length > 0) {
      query += ` HAVING ${this._having.join(' AND ')}`;
    }

    // ORDER BY clause
    if (this._orderBy.length > 0) {
      query += ` ORDER BY ${this._orderBy.join(', ')}`;
    }

    // LIMIT clause
    if (this._limit !== null) {
      query += ` LIMIT ${this._limit}`;
    }

    // OFFSET clause
    if (this._offset !== null) {
      query += ` OFFSET ${this._offset}`;
    }

    return {
      sql: query,
      params: this._params
    };
  }

  // Convenience methods for common patterns
  findById(table, id) {
    return this.reset()
      .select('*')
      .from(table)
      .where('id = ?', [id])
      .build();
  }

  findByCallSid(callSid) {
    return this.reset()
      .select('c.*, s.summary_text, a.sentiment_scores, a.keywords, a.patterns')
      .from('conversations c')
      .leftJoin('summaries s', 'c.id = s.conversation_id')
      .leftJoin('analytics a', 'c.id = a.conversation_id')
      .where('c.call_sid = ?', [callSid])
      .build();
  }

  findConversationsInDateRange(startDate, endDate) {
    return this.reset()
      .select('*')
      .from('conversations')
      .whereBetween('start_time', startDate, endDate)
      .orderBy('start_time', 'ASC')
      .build();
  }

  getDailyStats(date) {
    return this.reset()
      .select([
        'DATE(start_time) as call_date',
        'COUNT(*) as total_calls',
        'AVG(duration) as avg_duration',
        'SUM(duration) as total_duration'
      ])
      .from('conversations')
      .whereDate('start_time', '=', date)
      .groupBy('DATE(start_time)')
      .build();
  }

  getWeeklyStats(startDate, endDate) {
    return this.reset()
      .select([
        'DATE(start_time) as call_date',
        'COUNT(*) as total_calls',
        'AVG(duration) as avg_duration',
        'SUM(duration) as total_duration',
        'MIN(start_time) as first_call',
        'MAX(start_time) as last_call'
      ])
      .from('conversations')
      .whereBetween('start_time', startDate, endDate)
      .groupBy('DATE(start_time)')
      .orderBy('call_date', 'ASC')
      .build();
  }

  getRecentConversations(limit = 10) {
    return this.reset()
      .select(['id', 'call_sid', 'start_time', 'duration'])
      .from('conversations')
      .orderBy('start_time', 'DESC')
      .limit(limit)
      .build();
  }

  // Insert query builder
  insertInto(table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);

    return {
      sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      params: values
    };
  }

  // Update query builder
  update(table, data, whereClause, whereParams = []) {
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = Object.values(data);

    return {
      sql: `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
      params: [...values, ...whereParams]
    };
  }

  // Delete query builder
  deleteFrom(table, whereClause, whereParams = []) {
    return {
      sql: `DELETE FROM ${table} WHERE ${whereClause}`,
      params: whereParams
    };
  }

  // Utility method to escape identifiers
  escapeIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  // Utility method to validate SQL injection attempts
  validateInput(input) {
    if (typeof input !== 'string') {
      return true; // Non-strings are safe with parameterized queries
    }

    // Basic SQL injection patterns (for additional safety)
    const dangerousPatterns = [
      /;\s*(drop|delete|insert|update|create|alter)\s+/i,
      /union\s+select/i,
      /\/\*.*\*\//,
      /--/,
      /<script/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(input));
  }
}

module.exports = QueryBuilder;